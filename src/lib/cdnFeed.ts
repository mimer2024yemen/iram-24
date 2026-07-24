import { cdnUrl } from "@/config/newsSource";
import type { Article } from "@/hooks/useArticles";

// Reads pre-built news JSON shards from the GitHub Action pipeline via jsDelivr CDN.
// Global, gzipped, edge-cached — works great on slow connections.

export async function fetchFromCdn(
  language: "AR" | "EN",
  category: string | undefined,
  limit: number,
): Promise<Article[] | null> {
  const path = category && category !== "الرئيسية" && category !== "Home"
    ? `data/${language}/by-cat/${encodeURIComponent(category)}.json`
    : `data/${language}/latest.json`;

  // Try the requested shard first, then fall back to latest if category shard is missing.
  const primary = cdnUrl(path);
  const fallback = cdnUrl(`data/${language}/latest.json`);
  if (!primary) return null;

  for (const url of [primary, fallback].filter((v, i, a) => v && a.indexOf(v) === i) as string[]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const rows = (json?.articles as Article[]) || [];
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.slice(0, limit);
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function fetchCdnStatus(): Promise<{
  updated_at?: string;
  count?: number;
  errors?: Array<{ source: string; message: string }>;
} | null> {
  const url = cdnUrl("data/status.json");
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
