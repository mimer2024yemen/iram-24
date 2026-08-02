import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// ---------- security: SSRF guards ----------
const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|\[?::1\]?|metadata\.google\.internal)$/i;

function assertSafeUrl(raw: string): URL {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Unsupported protocol");
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST.test(host) || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    throw new Error("Blocked host");
  }
  return u;
}

// ---------- helpers ----------
const decodeEntities = (s: string) =>
  (s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)));

const abs = (v: string, base: string) => {
  try { return new URL(decodeEntities(v), base).toString(); } catch { return ""; }
};

const stripNoise = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|button|select|iframe|object|embed|video|audio)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|iframe)[^>]*\/?>/gi, " ");

const AD_PATTERN = /(advert|ads?[-_]|banner|sponsor|promo|newsletter|subscribe|related|share|social|comment|cookie|popup|modal|sidebar|breadcrumb|tags?[-_]list|most[-_]read|trending|widget|footer|header|menu|nav)/i;

/** Remove block elements whose class/id looks like ads/navigation chrome. */
function dropJunkBlocks(html: string): string {
  return html.replace(
    /<(div|section|ul|ol|figure|aside)\b[^>]*(?:class|id)=["'][^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    (m) => (AD_PATTERN.test(m.slice(0, 300)) ? " " : m),
  );
}

const textOf = (html: string) =>
  decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function meta(html: string, keys: string[]): string {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["']`, "i");
    const m = html.match(re) || html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return "";
}

function jsonLd(html: string): Record<string, unknown> | null {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const list = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const item of list) {
        const t = String(item?.["@type"] ?? "");
        if (/Article|NewsArticle|BlogPosting|ReportageNewsArticle/i.test(t)) return item;
      }
    } catch { /* ignore malformed */ }
  }
  return null;
}

type Block = { type: "p" | "h" | "img" | "quote"; text?: string; src?: string; alt?: string };

/** Candidate container scoring, Readability-lite. */
function bestContainer(html: string): string {
  const candidates: string[] = [];
  const push = (re: RegExp) => { for (const m of html.matchAll(re)) candidates.push(m[1]); };
  push(/<article\b[^>]*>([\s\S]*?)<\/article>/gi);
  push(/<main\b[^>]*>([\s\S]*?)<\/main>/gi);
  push(/<div\b[^>]*(?:class|id)=["'][^"']*(?:article|story|post|entry|content|body|text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi);
  push(/<body\b[^>]*>([\s\S]*?)<\/body>/gi);

  let best = "";
  let bestScore = -1;
  for (const c of candidates) {
    const paras = [...c.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1])).filter((t) => t.length > 60);
    const linkDensity = (c.match(/<a\b/gi)?.length ?? 0) / Math.max(1, paras.length);
    const score = paras.reduce((s, p) => s + p.length, 0) - linkDensity * 250;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best || html;
}

function extractBlocks(container: string, baseUrl: string): Block[] {
  const blocks: Block[] = [];
  const seen = new Set<string>();
  const re = /<(p|h2|h3|blockquote|img|figure)\b([^>]*)>([\s\S]*?)(?:<\/\1>|$)/gi;
  for (const m of container.matchAll(re)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3] || "";
    if (tag === "img" || tag === "figure") {
      const chunk = tag === "img" ? `<img ${attrs}>` : inner;
      const src = chunk.match(/(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/i)?.[1];
      const srcset = chunk.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i)?.[1];
      let picked = src || "";
      if (srcset) {
        const last = srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean).pop();
        if (last && (!picked || picked.startsWith("data:"))) picked = last;
      }
      const url = picked && !picked.startsWith("data:") ? abs(picked, baseUrl) : "";
      if (url && !seen.has(url)) {
        seen.add(url);
        blocks.push({ type: "img", src: url, alt: textOf(chunk.match(/alt=["']([^"']*)["']/i)?.[1] || "") });
      }
      if (tag === "figure") {
        const cap = inner.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
        const capText = cap ? textOf(cap[1]) : "";
        if (capText.length > 15) blocks.push({ type: "quote", text: capText });
      }
      continue;
    }
    const t = textOf(inner);
    if (!t) continue;
    if (tag === "p" && t.length < 45) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    blocks.push({ type: tag === "blockquote" ? "quote" : tag === "p" ? "p" : "h", text: t });
  }
  return blocks;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.9",
      "Referer": new URL(url).origin + "/",
    },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/i.test(ct)) throw new Error("Not an HTML page");
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200, cache = "public, max-age=600, s-maxage=3600") =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": cache },
    });

  let raw = new URL(req.url).searchParams.get("url") || "";
  if (!raw && req.method === "POST") {
    try { raw = (await req.json())?.url || ""; } catch { /* noop */ }
  }

  let target: URL;
  try { target = assertSafeUrl(raw); }
  catch (e) { return json({ ok: false, error: (e as Error).message }, 400, "no-store"); }

  try {
    const html = await fetchHtml(target.toString());
    const ld = jsonLd(html);

    const title =
      (typeof ld?.headline === "string" ? ld.headline : "") ||
      meta(html, ["og:title", "twitter:title"]) ||
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();

    const description = meta(html, ["og:description", "twitter:description", "description"]) ||
      (typeof ld?.description === "string" ? ld.description : "");

    const authorLd = ld?.author as any;
    const author =
      (Array.isArray(authorLd) ? authorLd[0]?.name : authorLd?.name) ||
      meta(html, ["article:author", "author", "twitter:creator"]) || "";

    const published =
      (typeof ld?.datePublished === "string" ? ld.datePublished : "") ||
      meta(html, ["article:published_time", "og:updated_time", "datePublished", "pubdate"]) || "";

    const siteName = meta(html, ["og:site_name"]) || target.hostname.replace(/^www\./, "");
    const leadImageRaw = meta(html, ["og:image", "twitter:image", "twitter:image:src"]) ||
      (typeof (ld?.image as any)?.url === "string" ? (ld!.image as any).url : Array.isArray(ld?.image) ? (ld!.image as any)[0] : typeof ld?.image === "string" ? ld.image : "");
    const leadImage = leadImageRaw ? abs(String(leadImageRaw), target.toString()) : "";

    const cleaned = dropJunkBlocks(stripNoise(html));
    let blocks = extractBlocks(bestContainer(cleaned), target.toString());

    // Fallback 1: whole cleaned document
    if (blocks.filter((b) => b.type === "p").length < 2) {
      blocks = extractBlocks(cleaned, target.toString());
    }
    // Fallback 2: JSON-LD articleBody
    if (blocks.filter((b) => b.type === "p").length < 2 && typeof ld?.articleBody === "string") {
      blocks = (ld.articleBody as string)
        .split(/\n+/).map((t) => t.trim()).filter((t) => t.length > 45)
        .map((text) => ({ type: "p" as const, text }));
    }
    // Fallback 3: description only
    if (!blocks.length && description) blocks = [{ type: "p", text: description }];

    const words = blocks.filter((b) => b.text).reduce((n, b) => n + (b.text!.split(/\s+/).length), 0);

    return json({
      ok: true,
      url: target.toString(),
      siteName,
      favicon: `https://www.google.com/s2/favicons?sz=64&domain=${target.hostname}`,
      title,
      description,
      author,
      published,
      leadImage,
      blocks: blocks.slice(0, 200),
      readMinutes: Math.max(1, Math.round(words / 200)),
      degraded: blocks.filter((b) => b.type === "p").length < 2,
    });
  } catch (e) {
    return json({ ok: false, url: target.toString(), error: (e as Error).message }, 200, "no-store");
  }
});
