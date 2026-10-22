import { cdnUrls } from "@/config/newsSource";
import type { Article } from "@/hooks/useArticles";

// Reads pre-built JSON from the free GitHub Action pipeline.

interface CdnRow {
  id?: string;
  title?: string;
  description?: string | null;
  url?: string;
  image_url?: string | null;
  published_at?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  language?: string;
  category?: string;
  fingerprint?: string;
}

/** Give pipeline rows the shape the site expects. "rss-" ids never hit the backend. */
export function normalizeCdnRow(row: CdnRow): Article {
  const id = row.id || `rss-${row.fingerprint || encodeURIComponent(row.url || row.title || "")}`;
  return {
    id,
    title: row.title || "",
    description: row.description ?? null,
    content: null,
    url: row.url || "",
    image_url: row.image_url ?? null,
    category: row.category || "متفرقات",
    language: row.language || "AR",
    published_at: row.published_at ?? null,
    views: 0,
    source_id: null,
    created_at: row.published_at || new Date().toISOString(),
    author_name: row.source_name ?? null,
    author_image_url: null,
    is_manual: false,
  };
}

async function fetchJson(path: string, timeoutMs = 4500): Promise<any | null> {
  for (const url of cdnUrls(path)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
      clearTimeout(t);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function fetchFromCdn(
  language: "AR" | "EN",
  category: string | undefined,
  limit: number,
): Promise<Article[] | null> {
  const paths = category && category !== "الرئيسية" && category !== "Home"
    ? [`data/${language}/by-cat/${category}.json`, `data/${language}/latest.json`]
    : [`data/${language}/latest.json`];

  for (const path of paths) {
    const json = await fetchJson(path);
    const rows = (json?.articles as CdnRow[]) || [];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.slice(0, limit).map(normalizeCdnRow);
    }
  }
  return null;
}

export interface CdnQuote {
  symbol: string;
  label_ar: string;
  label_en: string;
  unit?: string;
  price: number;
  change: number;
  changePct: number;
}

export async function fetchCdnMarkets(): Promise<CdnQuote[] | null> {
  const json = await fetchJson("data/markets.json");
  const quotes = json?.quotes as CdnQuote[] | undefined;
  return Array.isArray(quotes) && quotes.length > 0 ? quotes : null;
}

export async function fetchCdnStatus(): Promise<{
  updated_at?: string;
  count?: number;
  errors?: Array<{ source: string; message: string }>;
} | null> {
  return await fetchJson("data/status.json");
}
