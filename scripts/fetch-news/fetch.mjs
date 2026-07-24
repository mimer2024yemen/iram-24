#!/usr/bin/env node
// Independent news pipeline — runs in GitHub Actions.
// Reads active sources from Supabase, fetches RSS/Atom, dedupes, and commits
// JSON shards to /data. jsDelivr serves them worldwide for free.

import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_DIR = process.env.DATA_DIR || "data";
const MAX_PER_SHARD = 500;
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

const UA = "Mozilla/5.0 (compatible; Iram24NewsBot/1.0; +https://iram-24.lovable.app)";
const HEADERS = {
  "User-Agent": UA,
  "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, text/html;q=0.7, */*;q=0.5",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  parseTagValue: true,
  trimValues: true,
  processEntities: false, // tolerate feeds with many HTML entities (Guardian etc.)
});

// ---------------- helpers ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promise(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await withTimeout(
        (signal) => fetch(url, { headers: HEADERS, redirect: "follow", signal }),
        TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(400 * (i + 1));
    }
  }
  throw lastErr;
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((p) =>
      url.searchParams.delete(p),
    );
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

function fingerprint(title, url) {
  const t = (title || "").toLowerCase().replace(/[\s\p{P}]+/gu, "").slice(0, 120);
  const canon = normalizeUrl(url || "");
  return createHash("sha1").update(t + "|" + canon).digest("hex").slice(0, 16);
}

function textOf(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v["#cdata"] || v["#text"] || v["@_url"] || "";
  return String(v);
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(item, description) {
  const enclosureUrl = item.enclosure?.["@_url"];
  if (enclosureUrl) return enclosureUrl;
  const media = item["media:content"] || item["media:thumbnail"];
  if (media) {
    if (Array.isArray(media)) return media[0]?.["@_url"] || null;
    return media["@_url"] || null;
  }
  const html = textOf(item["content:encoded"]) || textOf(description) || "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// ---------------- classifier (mirrors src/lib/classifier.ts, condensed) ----------------
const CATEGORY_KEYWORDS_AR = {
  "سياسة": ["سياس", "رئيس", "حكوم", "برلمان", "وزير", "انتخاب", "قمة", "مفاوضات", "دبلوماس"],
  "اقتصاد": ["اقتصاد", "بورصة", "أسهم", "نفط", "ذهب", "دولار", "استثمار", "بنك", "شركة"],
  "رياضة": ["مباراة", "دوري", "كأس", "لاعب", "مدرب", "منتخب", "هدف", "بطولة", "ريال مدريد", "برشلونة"],
  "تقنية": ["تقني", "ذكاء اصطناعي", "AI", "iPhone", "Android", "تطبيق", "برمج", "قوقل", "مايكروسوفت"],
  "صحة": ["صحة", "طب", "مرض", "فيروس", "لقاح", "مستشفى", "دواء"],
  "علوم": ["علوم", "فضاء", "ناسا", "اكتشاف", "دراسة", "بحث", "كوكب"],
  "فن": ["فن", "فيلم", "ممثل", "مغني", "مسلسل", "أوسكار", "مهرجان", "مسرح"],
  "مجتمع": ["مجتمع", "حادث", "جريمة", "قضية", "عائلة", "زواج", "طلاق"],
};
const CATEGORY_KEYWORDS_EN = {
  "Politics": ["politic", "president", "government", "parliament", "election", "diploma", "senate"],
  "Economy": ["economy", "market", "stock", "oil", "bank", "invest", "gdp", "inflation"],
  "Sports": ["match", "league", "player", "coach", "goal", "cup", "olympic", "nba", "nfl"],
  "Tech": ["tech", "ai", "iphone", "android", "software", "google", "apple", "microsoft"],
  "Health": ["health", "medic", "virus", "vaccine", "hospital", "disease"],
  "Science": ["science", "space", "nasa", "discover", "research", "planet", "climate"],
  "Arts": ["film", "movie", "actor", "singer", "oscar", "festival", "music"],
  "Society": ["community", "crime", "family", "wedding", "accident"],
};
function classify(title, description, lang) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  const table = lang === "AR" ? CATEGORY_KEYWORDS_AR : CATEGORY_KEYWORDS_EN;
  let best = { cat: lang === "AR" ? "متفرقات" : "Misc", score: 0 };
  for (const [cat, kws] of Object.entries(table)) {
    let s = 0;
    for (const kw of kws) if (text.includes(kw.toLowerCase())) s++;
    if (s > best.score) best = { cat, score: s };
  }
  return best.cat;
}

// ---------------- parsers ----------------
function parseFeed(xml, source) {
  const obj = parser.parse(xml);
  const items = [];
  const rss = obj?.rss?.channel;
  const atom = obj?.feed;
  const rawItems = rss?.item || atom?.entry || [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  for (const it of list) {
    if (!it) continue;
    const title = stripHtml(textOf(it.title));
    let url = textOf(it.link);
    if (typeof it.link === "object" && it.link?.["@_href"]) url = it.link["@_href"];
    if (Array.isArray(it.link)) url = it.link[0]?.["@_href"] || textOf(it.link[0]);
    const description = stripHtml(textOf(it.description) || textOf(it.summary) || textOf(it["content:encoded"]));
    const publishedRaw = textOf(it.pubDate) || textOf(it.published) || textOf(it.updated);
    const published_at = publishedRaw ? new Date(publishedRaw).toISOString() : new Date().toISOString();
    const image_url = extractImage(it, it.description);
    if (!title || !url) continue;
    items.push({
      title: title.slice(0, 500),
      description: description.slice(0, 1000),
      url: normalizeUrl(url),
      image_url,
      published_at,
      source_id: source.id,
      source_name: source.name,
      language: source.language,
      category: source.category || classify(title, description, source.language),
      fingerprint: fingerprint(title, url),
    });
  }
  return items;
}

// ---------------- sources ----------------
async function loadSources() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_sources?select=*&is_active=eq.true`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`sources fetch: ${res.status}`);
  return await res.json();
}

// Fallback list if the sources table is unreachable or empty.
const FALLBACK_SOURCES = [
  { id: "bbc-ar", name: "BBC عربي", url: "https://feeds.bbci.co.uk/arabic/rss.xml", language: "AR" },
  { id: "sky-ar", name: "سكاي نيوز عربية", url: "https://www.skynewsarabia.com/rss", language: "AR" },
  { id: "france24-ar", name: "فرانس 24", url: "https://www.france24.com/ar/rss", language: "AR" },
  { id: "cnn-ar", name: "CNN عربية", url: "https://arabic.cnn.com/rss", language: "AR" },
  { id: "aj-ar", name: "الجزيرة", url: "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84951406c8a/73d0e1b4-532f-45ef-b135-bfdff8b8cab9", language: "AR" },
  { id: "bbc-en", name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "EN" },
  { id: "guardian-en", name: "The Guardian", url: "https://www.theguardian.com/world/rss", language: "EN" },
  { id: "reuters-en", name: "Reuters World", url: "https://feeds.reuters.com/reuters/worldNews", language: "EN" },
];

// ---------------- pipeline ----------------
async function runParallel(items, fn, limit) {
  const out = [];
  let i = 0;
  const workers = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function loadShard(path) {
  if (!existsSync(path)) return { articles: [] };
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { articles: [] };
  }
}

async function writeShard(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(obj));
}

async function main() {
  let sources = [];
  try {
    sources = await loadSources();
  } catch (e) {
    console.warn("[sources] fallback:", e.message);
  }
  if (!sources || sources.length === 0) sources = FALLBACK_SOURCES;

  const errors = [];
  const results = await runParallel(sources, async (src) => {
    try {
      const xml = await fetchWithRetry(src.url);
      const items = parseFeed(xml, src);
      console.log(`[ok] ${src.name}: ${items.length}`);
      return items;
    } catch (e) {
      const msg = e?.message || String(e);
      console.warn(`[err] ${src.name}: ${msg}`);
      errors.push({ source: src.name, message: msg });
      return [];
    }
  }, CONCURRENCY);

  const all = results.flat();
  // dedupe by fingerprint globally
  const seen = new Set();
  const unique = [];
  for (const a of all) {
    if (seen.has(a.fingerprint)) continue;
    seen.add(a.fingerprint);
    unique.push(a);
  }

  // merge per language into existing latest, keeping newest MAX_PER_SHARD
  const byLang = { AR: [], EN: [] };
  for (const a of unique) (byLang[a.language] || (byLang[a.language] = [])).push(a);

  const summary = { updated_at: new Date().toISOString(), languages: {}, errors };

  for (const lang of Object.keys(byLang)) {
    const shardPath = join(DATA_DIR, lang, "latest.json");
    const existing = await loadShard(shardPath);
    const existingSeen = new Set(existing.articles.map((a) => a.fingerprint));
    const fresh = byLang[lang].filter((a) => !existingSeen.has(a.fingerprint));
    const merged = [...byLang[lang], ...existing.articles]
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))
      // final dedupe (in case existing had dupes)
      .filter((a, i, arr) => arr.findIndex((x) => x.fingerprint === a.fingerprint) === i)
      .slice(0, MAX_PER_SHARD);

    await writeShard(shardPath, { updated_at: summary.updated_at, count: merged.length, articles: merged });

    // per-category shards
    const byCat = new Map();
    for (const a of merged) {
      const arr = byCat.get(a.category) || [];
      arr.push(a);
      byCat.set(a.category, arr);
    }
    for (const [cat, arr] of byCat.entries()) {
      const catPath = join(DATA_DIR, lang, "by-cat", `${cat}.json`);
      await writeShard(catPath, { updated_at: summary.updated_at, count: arr.length, articles: arr.slice(0, MAX_PER_SHARD) });
    }

    // weekly archive append (unlimited history)
    const now = new Date();
    const week = `${now.getUTCFullYear()}-W${String(Math.ceil(((now - new Date(now.getUTCFullYear(), 0, 1)) / 86400000 + new Date(now.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7)).padStart(2, "0")}`;
    if (fresh.length > 0) {
      const archPath = join(DATA_DIR, lang, "archive", `${week}.json`);
      const arch = await loadShard(archPath);
      const archSeen = new Set(arch.articles.map((a) => a.fingerprint));
      const addFresh = fresh.filter((a) => !archSeen.has(a.fingerprint));
      await writeShard(archPath, {
        updated_at: summary.updated_at,
        count: arch.articles.length + addFresh.length,
        articles: [...addFresh, ...arch.articles],
      });
    }

    summary.languages[lang] = { total: merged.length, new: fresh.length, categories: byCat.size };
  }

  await writeShard(join(DATA_DIR, "status.json"), summary);
  console.log("[done]", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
