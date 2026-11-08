// Copies newly fetched articles into the site's database so the admin panel,
// sitemaps and article pages see them. Runs only when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided (GitHub Actions secrets) — the key is
// never stored in the repository. Existing rows are never updated or deleted.

// ---- identity helpers (same rules as supabase/functions/fetch-news) ----
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function decodeEntities(text) {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

export function normalizeUrlKey(url) {
  if (!url) return "";
  let n = decodeEntities(url).trim().replace(/\s+/g, "");
  if (n.startsWith("//")) n = `https:${n}`;
  n = n.replace(/^http:\/\//i, "https://");
  try {
    const p = new URL(n);
    p.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "s"].forEach((k) => p.searchParams.delete(k));
    return `${p.origin}${p.pathname.replace(/\/$/, "")}${p.search}`.toLowerCase();
  } catch {
    return n.toLowerCase().replace(/\/$/, "");
  }
}

export function normalizeTitleKey(title) {
  return decodeEntities(title || "")
    .toLowerCase()
    .replace(/[\u0640]/g, "")
    .replace(/["'“”‘’`´]/g, "")
    .replace(/[\u061f؟!.,:;()\-_/\\|[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One key per story: same link even if the source later edits the headline. */
export function storyKey(url) {
  return normalizeUrlKey(String(url || "").replace(/&amp(;|%3B)/gi, "&"))
    .replace(/([?&])(at_medium|at_campaign|at_link_origin|at_ptr_name)=[^&]*/g, "$1")
    .replace(/[?&]+$/, "")
    .replace(/\?&+/, "?");
}

/** Database duplicate key: identical to the hash the backend fetcher writes. */
export function articleHash(title, url) {
  return hashString(`${normalizeTitleKey(title)}|${normalizeUrlKey(url)}`);
}

/** Stable UUID-shaped id derived from the pipeline fingerprint (16 hex chars). */
export function idFromFingerprint(fp) {
  const h = String(fp || "").toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(16, "0").slice(0, 16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-a${h.slice(15, 16)}00-000000000024`;
}

// ---- REST helpers ----
function headers(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function rest(url, key, init = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers: headers(key, init.headers), signal: ctrl.signal });
    if (!res.ok) throw new Error(`[${res.status}] ${(await res.text()).slice(0, 300)}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  } finally {
    clearTimeout(t);
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const quote = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function existingIds(base, key, column, values) {
  const map = new Map();
  for (const part of chunk(values, column === "url" ? 25 : 100)) {
    const filter = encodeURIComponent(`(${part.map(quote).join(",")})`);
    const rows = await rest(`${base}/rest/v1/articles?select=id,${column}&${column}=in.${filter}`, key);
    for (const r of rows || []) map.set(r[column], r.id);
  }
  return map;
}

/**
 * Ensures every article in `articles` exists in the database and sets `a.id`
 * to the database id. Never overwrites existing rows.
 * @param contentFor (a) => { text: string[] } | null — full body if extracted.
 */
export async function syncArticles({ url: base, key, articles, validSourceIds, contentFor }) {
  const todo = articles.filter((a) => !a.id && a.title && a.url);
  if (!base || !key || todo.length === 0) return { checked: 0, inserted: 0 };

  for (const a of todo) a._hash = articleHash(a.title, a.url);
  const byHash = await existingIds(base, key, "hash", [...new Set(todo.map((a) => a._hash))]);
  const byUrl = await existingIds(base, key, "url", [...new Set(todo.filter((a) => !byHash.has(a._hash)).map((a) => a.url))]);

  const rows = [];
  const batchIds = new Map(); // storyKey -> id, so one story is inserted once
  for (const a of todo) {
    const found = byHash.get(a._hash) || byUrl.get(a.url) || batchIds.get(storyKey(a.url));
    if (found) { a.id = found; continue; }
    a.id = idFromFingerprint(a.fingerprint);
    batchIds.set(storyKey(a.url), a.id);
    const body = contentFor ? await contentFor(a) : null;
    rows.push({
      id: a.id,
      hash: a._hash,
      title: a.title,
      description: a.description || null,
      content: body?.text?.length ? body.text.join("\n\n") : null,
      url: a.url,
      image_url: a.image_url || null,
      category: a.category,
      language: a.language,
      published_at: a.published_at || new Date().toISOString(),
      source_id: a.source_id && validSourceIds.has(a.source_id) ? a.source_id : null,
    });
  }

  let inserted = 0;
  for (const part of chunk(rows, 100)) {
    try {
      await rest(`${base}/rest/v1/articles?on_conflict=hash`, key, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(part),
      });
      inserted += part.length;
    } catch (e) {
      // keep the site's own copy working even if the database rejects a batch
      console.warn(`[db] insert batch failed: ${e.message}`);
      for (const r of part) {
        const a = todo.find((x) => x.id === r.id);
        if (a) delete a.id;
      }
    }
  }
  for (const a of todo) delete a._hash;
  return { checked: todo.length, inserted };
}

/** Records the run in fetch_settings / news_sources so the admin panel shows it. */
export async function recordRun({ url: base, key, inserted, sourceResults }) {
  if (!base || !key) return;
  const now = new Date().toISOString();
  try {
    await rest(`${base}/rest/v1/fetch_settings?id=not.is.null`, key, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_fetch_time: now, last_fetch_count: inserted, updated_at: now }),
    });
  } catch (e) { console.warn(`[db] fetch_settings: ${e.message}`); }
  for (const s of sourceResults) {
    try {
      await rest(`${base}/rest/v1/news_sources?id=eq.${encodeURIComponent(s.id)}`, key, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_fetch: now, last_fetch_status: s.ok ? "success" : "failed" }),
      });
    } catch { /* not fatal */ }
  }
}
