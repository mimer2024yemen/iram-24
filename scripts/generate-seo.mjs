#!/usr/bin/env node
// Builds search/social files for the static Firebase site from real articles:
//   sitemap.xml        – home, sections and every known article
//   sitemap-news.xml   – articles published in the last 48 hours (Google News)
//   rss.xml            – the latest 50 articles
//   share/<id>/index.html – per-article preview pages (title + image) for
//                        WhatsApp / Facebook / X / Telegram, then redirect.
// Reads the database with the public key (no secrets) and the free GitHub
// news JSON, so it works even when one of them is unavailable.
//
// Usage: node scripts/generate-seo.mjs [outDir=dist]

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const SITE = (process.env.SITE_URL || "https://iram24.web.app").replace(/\/$/, "");
export const SITE_NAME = "إيرام 24";
export const RSS_LIMIT = 50;
export const NEWS_WINDOW_HOURS = 48;
const LOGO = `${SITE}/iram24-official.jpg`;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const PUBLIC_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const CDN_REPO = process.env.CDN_REPO || "mimer2024yemen/iram-24";
const DATA_LOCAL = process.env.DATA_LOCAL || ".data-branch/data";

export const xmlEscape = (s) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const isoDate = (d) => {
  const t = new Date(d || Date.now());
  return isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
};

export const articleUrl = (a) => `${SITE}/article/${encodeURIComponent(a.id)}`;
export const shareUrl = (a) => `${SITE}/share/${encodeURIComponent(a.id)}`;

// ---------- inputs ----------
async function fromDatabase(limit = 2000) {
  if (!SUPABASE_URL || !PUBLIC_KEY) return [];
  const out = [];
  const page = 1000;
  for (let from = 0; from < limit; from += page) {
    const url = `${SUPABASE_URL}/rest/v1/articles?select=id,title,description,url,image_url,category,language,published_at,created_at&order=published_at.desc.nullslast&limit=${page}&offset=${from}`;
    try {
      const res = await fetch(url, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}` }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { console.warn(`[seo] database: HTTP ${res.status}`); break; }
      const rows = await res.json();
      out.push(...rows);
      if (rows.length < page) break;
    } catch (e) {
      console.warn(`[seo] database unavailable: ${e.message}`);
      break;
    }
  }
  return out;
}

async function readDataFile(rel) {
  const local = join(DATA_LOCAL, rel);
  if (existsSync(local)) {
    try { return JSON.parse(await readFile(local, "utf8")); } catch { /* fall through */ }
  }
  for (const branch of ["data", "main"]) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${CDN_REPO}/${branch}/data/${rel}`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
    } catch { /* next */ }
  }
  return null;
}

async function fromGithubData() {
  const out = [];
  for (const lang of ["AR", "EN"]) {
    const json = await readDataFile(`${lang}/latest.json`);
    for (const r of json?.articles || []) {
      out.push({
        id: r.id || `rss-${r.fingerprint}`,
        title: r.title, description: r.description, url: r.url, image_url: r.image_url,
        category: r.category, language: r.language || lang, published_at: r.published_at,
        source_name: r.source_name,
      });
    }
  }
  return out;
}

/** Union of both inputs, one entry per original link, newest first. */
export function mergeArticles(...lists) {
  const seen = new Set();
  const out = [];
  for (const a of lists.flat()) {
    if (!a?.id || !a?.title) continue;
    const key = (a.url || a.id).toLowerCase();
    if (seen.has(key) || seen.has(a.id)) continue;
    seen.add(key); seen.add(a.id);
    out.push(a);
  }
  return out.sort((a, b) => isoDate(b.published_at || b.created_at).localeCompare(isoDate(a.published_at || a.created_at)));
}

// ---------- outputs ----------
export function buildSitemap(articles, now = new Date()) {
  const pages = ["/", "/categories", "/radio"].map(
    (p) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc><lastmod>${now.toISOString()}</lastmod><changefreq>${p === "/" ? "always" : "daily"}</changefreq><priority>${p === "/" ? "1.0" : "0.6"}</priority></url>`,
  );
  const items = articles.slice(0, 45000).map((a) => {
    const img = a.image_url && /^https?:/.test(a.image_url)
      ? `<image:image><image:loc>${xmlEscape(a.image_url)}</image:loc><image:title>${xmlEscape(a.title)}</image:title></image:image>`
      : "";
    return `  <url><loc>${xmlEscape(articleUrl(a))}</loc><lastmod>${isoDate(a.published_at || a.created_at)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${img}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>${SITE}/iram24-official.jpg</loc><image:image><image:loc>${LOGO}</image:loc><image:title>${SITE_NAME} — Iram24</image:title></image:image></url>
${[...pages, ...items].join("\n")}
</urlset>
`;
}

export function recentForNews(articles, now = new Date()) {
  const cutoff = now.getTime() - NEWS_WINDOW_HOURS * 3600 * 1000;
  return articles
    .filter((a) => {
      const t = new Date(a.published_at || a.created_at || 0).getTime();
      return t >= cutoff && t <= now.getTime() + 3600 * 1000;
    })
    .slice(0, 1000);
}

export function buildNewsSitemap(articles, now = new Date()) {
  const items = recentForNews(articles, now).map((a) => `  <url><loc>${xmlEscape(articleUrl(a))}</loc><news:news><news:publication><news:name>${SITE_NAME}</news:name><news:language>${(a.language || "AR").toLowerCase() === "en" ? "en" : "ar"}</news:language></news:publication><news:publication_date>${isoDate(a.published_at || a.created_at)}</news:publication_date><news:title>${xmlEscape(a.title)}</news:title></news:news></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items.join("\n")}
</urlset>
`;
}

export function buildRss(articles, now = new Date()) {
  const items = articles.slice(0, RSS_LIMIT).map((a) => {
    const img = a.image_url && /^https?:/.test(a.image_url) ? `<enclosure url="${xmlEscape(a.image_url)}" type="image/jpeg" length="0" />` : "";
    return `    <item><title>${xmlEscape(a.title)}</title><link>${xmlEscape(articleUrl(a))}</link><guid isPermaLink="true">${xmlEscape(articleUrl(a))}</guid><description>${xmlEscape(a.description || "")}</description><pubDate>${new Date(isoDate(a.published_at || a.created_at)).toUTCString()}</pubDate>${a.category ? `<category>${xmlEscape(a.category)}</category>` : ""}${img}</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} | نبض الحدث</title>
    <link>${SITE}/</link>
    <description>آخر أخبار ${SITE_NAME}</description>
    <language>ar</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <image><url>${LOGO}</url><title>${SITE_NAME}</title><link>${SITE}/</link></image>
${items.join("\n")}
  </channel>
</rss>
`;
}

export function buildSharePage(a) {
  const title = xmlEscape(`${a.title} | ${SITE_NAME}`);
  const desc = xmlEscape((a.description || `اقرأ الخبر على ${SITE_NAME}`).slice(0, 300));
  const image = xmlEscape(a.image_url && /^https?:/.test(a.image_url) ? a.image_url : LOGO);
  const target = xmlEscape(articleUrl(a));
  const lang = (a.language || "AR").toLowerCase() === "en" ? "en" : "ar";
  return `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${target}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${xmlEscape(a.title)}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${target}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${xmlEscape(a.title)}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />
<meta http-equiv="refresh" content="0;url=${target}" />
</head>
<body><a href="${target}">${xmlEscape(a.title)}</a><script>location.replace(${JSON.stringify(articleUrl(a))});</script></body>
</html>
`;
}

async function main() {
  const outDir = process.argv[2] || "dist";
  const [db, gh] = await Promise.all([fromDatabase(), fromGithubData()]);
  const articles = mergeArticles(db, gh);
  if (articles.length === 0) {
    console.warn("[seo] no articles available — keeping existing files");
    return;
  }
  const now = new Date();
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "sitemap.xml"), buildSitemap(articles, now));
  await writeFile(join(outDir, "sitemap-news.xml"), buildNewsSitemap(articles, now));
  await writeFile(join(outDir, "rss.xml"), buildRss(articles, now));
  const shareCount = Number(process.env.SHARE_PAGES || 3000);
  for (const a of articles.slice(0, shareCount)) {
    const dir = join(outDir, "share", a.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), buildSharePage(a));
  }
  console.log(`[seo] database ${db.length}, github ${gh.length}, merged ${articles.length}; news ${recentForNews(articles, now).length}; rss ${Math.min(RSS_LIMIT, articles.length)}; share pages ${Math.min(shareCount, articles.length)}`);
}

if (!process.env.SEO_NO_MAIN) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
