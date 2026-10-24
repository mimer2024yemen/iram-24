#!/usr/bin/env node
// Independent news pipeline — runs in GitHub Actions.
// Reads active sources from Supabase, fetches RSS/Atom, dedupes, and commits
// JSON shards to /data. jsDelivr serves them worldwide for free.

import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_DIR = process.env.DATA_DIR || "data";
const MAX_PER_SHARD = 500;
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

const UA = "Mozilla/5.0 (compatible; Iram24NewsBot/1.0; +https://iram24.web.app)";
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
async function loadSourcesFromBackend() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("backend credentials not configured");
  const res = await withTimeout(
    (signal) => fetch(`${SUPABASE_URL}/rest/v1/news_sources?select=*&is_active=eq.true`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      signal,
    }),
    10000,
  );
  if (!res.ok) throw new Error(`sources fetch: ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("backend returned no active sources");
  return rows;
}

// Backend first (admin edits apply); if it is paused/unreachable, use the
// committed backup list so news never stops.
async function loadSources() {
  try {
    const rows = await loadSourcesFromBackend();
    console.log(`[sources] backend: ${rows.length}`);
    return rows;
  } catch (e) {
    console.warn(`[sources] backend unavailable (${e?.message || e}); using ${DATA_DIR}/sources.json`);
    const json = JSON.parse(await readFile(join(DATA_DIR, "sources.json"), "utf8"));
    const rows = (json.sources || []).filter((s) => s.is_active !== false && (s.feed_url || s.url));
    if (rows.length === 0) throw new Error("backup sources.json is empty");
    return rows;
  }
}

// ---------------- full article text ----------------
// Each article's full body is stored as structural arrays (text[], images[])
// in data/<LANG>/content/<fingerprint>.json, so the homepage JSON stays small.
const CONTENT_PER_RUN = Number(process.env.CONTENT_PER_RUN || 45);
const SKIP_HOSTS = /(^|\.)(x\.com|twitter\.com|t\.co|youtube\.com|youtu\.be|facebook\.com|instagram\.com|t\.me)$/i;
const NOISE_ANY = /(من الضروري السماح بجمع|ملفات تعريف الارتباط|cookies? (policy|settings)|تخطَّ|تخط مقاطع|انتهى المحتوى|نهاية المحتوى|All rights reserved|جميع الحقوق محفوظة|©)/i;
const NOISE = /^(نشرت في|تاريخ النشر|آخر تحديث|التعليق على الصورة|الصورة،|مصدر الصورة|Image source|Image caption|اقرأ أيضا|اقرأ أيضاً|إقرأ أيضاً|اقرأ المزيد|المزيد:|شاهد أيضا|تابعونا|اشترك|Read more|Read also|Sign up|Subscribe|Advertisement|إعلان)/i;

function absoluteUrl(src, base) {
  try { return new URL(src, base).href; } catch { return null; }
}

export async function extractArticle(url) {
  let host = "";
  try { host = new URL(url).hostname; } catch { return null; }
  if (SKIP_HOSTS.test(host)) return null;
  const html = await fetchWithRetry(url, 2);
  const { document } = parseHTML(html);
  const parsed = new Readability(document, { charThreshold: 250 }).parse();
  if (!parsed?.content) return null;
  const { document: doc } = parseHTML(`<!doctype html><html><body>${parsed.content}</body></html>`);
  const text = [];
  const seen = new Set();
  for (const el of doc.querySelectorAll("p, h2, h3, h4, li, blockquote")) {
    if (el.closest && el.parentElement && el.parentElement.closest("p, li, blockquote")) continue;
    const t = (el.textContent || "").replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "").replace(/\s+/g, " ").trim();
    if (t.length < 20 || NOISE.test(t) || NOISE_ANY.test(t) || seen.has(t)) continue;
    if (parsed.title && t === parsed.title.trim()) continue;
    seen.add(t);
    text.push(t);
  }
  const images = [];
  for (const img of doc.querySelectorAll("img")) {
    const raw = img.getAttribute("data-src") || img.getAttribute("src") || "";
    const abs = absoluteUrl(raw, url);
    if (abs && /^https?:/.test(abs) && !/\.(svg|gif)(\?|$)/i.test(abs) && !images.includes(abs)) images.push(abs);
  }
  if (text.join(" ").length < 200) return null;
  return { text: text.slice(0, 150), images: images.slice(0, 12) };
}

async function fillContent(lang, articles) {
  const dir = join(DATA_DIR, lang, "content");
  const todo = articles.filter((a) => a.fingerprint && a.url && !existsSync(join(dir, `${a.fingerprint}.json`))).slice(0, CONTENT_PER_RUN);
  let ok = 0;
  await runParallel(todo, async (a) => {
    let body = null;
    try { body = await extractArticle(a.url); } catch { body = null; }
    if (body) ok++;
    // Always write a file (even without body) so the article page can open
    // shared links directly and failed pages are not retried every cycle.
    await writeShard(join(dir, `${a.fingerprint}.json`), {
      title: a.title, description: a.description, url: a.url, image_url: a.image_url,
      published_at: a.published_at, source_name: a.source_name, language: a.language,
      category: a.category, fingerprint: a.fingerprint,
      text: body?.text || [], images: body?.images || [], full: !!body,
      fetched_at: new Date().toISOString(),
    });
  }, 6);
  console.log(`[content] ${lang}: ${ok}/${todo.length} full articles`);
  return { attempted: todo.length, full: ok };
}

// ---------------- markets ----------------
const MARKET_SYMBOLS = [
  { sym: "CL=F", label_ar: "نفط WTI", label_en: "WTI Oil", unit: "$" },
  { sym: "BZ=F", label_ar: "نفط برنت", label_en: "Brent Oil", unit: "$" },
  { sym: "GC=F", label_ar: "ذهب", label_en: "Gold", unit: "$" },
  { sym: "SI=F", label_ar: "فضة", label_en: "Silver", unit: "$" },
  { sym: "^GSPC", label_ar: "S&P 500", label_en: "S&P 500", unit: "" },
  { sym: "^DJI", label_ar: "داو جونز", label_en: "Dow Jones", unit: "" },
  { sym: "^IXIC", label_ar: "ناسداك", label_en: "NASDAQ", unit: "" },
  { sym: "^TASI.SR", label_ar: "تاسي السعودي", label_en: "TASI", unit: "" },
  { sym: "BTC-USD", label_ar: "بيتكوين", label_en: "Bitcoin", unit: "$" },
  { sym: "ETH-USD", label_ar: "إيثريوم", label_en: "Ethereum", unit: "$" },
  { sym: "EURUSD=X", label_ar: "يورو/دولار", label_en: "EUR/USD", unit: "" },
  { sym: "GBPUSD=X", label_ar: "إسترليني/دولار", label_en: "GBP/USD", unit: "" },
  { sym: "SAR=X", label_ar: "دولار/ريال سعودي", label_en: "USD/SAR", unit: "" },
  { sym: "EGP=X", label_ar: "دولار/جنيه مصري", label_en: "USD/EGP", unit: "" },
  { sym: "AED=X", label_ar: "دولار/درهم إماراتي", label_en: "USD/AED", unit: "" },
];

async function fetchMarkets() {
  const quotes = await runParallel(MARKET_SYMBOLS, async (s) => {
    try {
      const res = await withTimeout(
        (signal) => fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?interval=1d&range=1d`, { headers: HEADERS, signal }),
        TIMEOUT_MS,
      );
      if (!res.ok) return null;
      const meta = (await res.json())?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
      if (!isFinite(price)) return null;
      const base = isFinite(prev) && prev ? prev : price;
      const change = price - base;
      return { symbol: s.sym, label_ar: s.label_ar, label_en: s.label_en, unit: s.unit, price, change, changePct: base ? (change / base) * 100 : 0 };
    } catch { return null; }
  }, 5);
  return quotes.filter(Boolean);
}

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
  } catch (error) {
    throw new Error(`Refusing to overwrite unreadable archive ${path}: ${error.message}`);
  }
}

async function writeShard(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(obj));
}

async function main() {
  const sources = await loadSources();

  const errors = [];
  const results = await runParallel(sources, async (src) => {
    try {
      const xml = await fetchWithRetry(src.feed_url?.trim() || src.url.trim());
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

    const content = await fillContent(lang, merged);
    summary.languages[lang] = { total: merged.length, new: fresh.length, categories: byCat.size, content };
  }

  // Market prices (only overwrite when we actually got quotes, so the bar never empties)
  const quotes = await fetchMarkets();
  if (quotes.length > 0) {
    await writeShard(join(DATA_DIR, "markets.json"), { updated_at: summary.updated_at, quotes });
  }
  summary.markets = quotes.length;

  await writeShard(join(DATA_DIR, "status.json"), summary);
  console.log("[done]", JSON.stringify(summary, null, 2));
}

if (!process.env.FETCH_NEWS_NO_MAIN) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
