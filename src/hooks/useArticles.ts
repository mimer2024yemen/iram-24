import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Article {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  category: string;
  language: string;
  published_at: string | null;
  views: number | null;
  source_id: string | null;
  created_at: string;
  author_name: string | null;
  author_image_url: string | null;
  is_manual: boolean;
}

const MEM_CACHE = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60_000;
const STALE_TTL = 24 * 60 * 60 * 1000;

const COLS =
  "id,title,description,url,image_url,category,language,published_at,views,source_id,created_at,author_name,author_image_url,is_manual";

function readPersisted(key: string) {
  try {
    const raw = localStorage.getItem("eram_cache_" + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Article[]; ts: number };
    if (Date.now() - parsed.ts > STALE_TTL) return null;
    return parsed;
  } catch { return null; }
}
function writePersisted(key: string, data: Article[]) {
  try { localStorage.setItem("eram_cache_" + key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// (unused legacy helper removed)

async function fetchEdgeDirect(language: string, category: string | undefined, limit: number): Promise<Article[] | null> {
  try {
    const params = new URLSearchParams({ lang: language, limit: String(limit) });
    if (category && category !== "الرئيسية" && category !== "Home") params.set("category", category);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-feed?${params.toString()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.articles as Article[]) || null;
  } catch { return null; }
}

async function fetchDirect(language: string, category: string | undefined, limit: number): Promise<Article[] | null> {
  let q = supabase
    .from("articles")
    .select(COLS)
    .eq("language", language)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (category && category !== "الرئيسية" && category !== "Home") q = q.eq("category", category);
  const timer = new Promise<null>((r) => setTimeout(() => r(null), 10_000));
  const result = await Promise.race([q, timer]);
  if (!result || (result as any).error) return null;
  return ((result as any).data as Article[]) || [];
}

export function useArticles(language: "AR" | "EN", category?: string, limit = 30) {
  const cacheKey = `${language}|${category || ""}|${limit}`;
  const initial = MEM_CACHE.get(cacheKey) || readPersisted(cacheKey);

  const [articles, setArticles] = useState<Article[]>(initial?.data || []);
  const [loading, setLoading] = useState(!initial);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchArticles = async (showLoading: boolean) => {
      if (showLoading && articles.length === 0) setLoading(true);

      // Try edge (cached) first → fall back to direct DB
      for (let attempt = 0; attempt < 3; attempt++) {
        let data = await fetchEdgeDirect(language, category, limit);
        if (!data) data = await fetchDirect(language, category, limit);
        if (!alive) return;
        if (data) {
          MEM_CACHE.set(cacheKey, { data, ts: Date.now() });
          writePersisted(cacheKey, data);
          setArticles(data);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
      if (alive) setLoading(false);
    };

    const fresh = initial && Date.now() - initial.ts < CACHE_TTL;
    if (fresh) setLoading(false);
    else fetchArticles(true);

    const channel = supabase
      .channel(`articles-rt-${cacheKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => fetchArticles(false), 2000);
      })
      .subscribe();

    return () => {
      alive = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, category, limit]);

  return { articles, loading };
}

export function useFetchSettings() {
  const [settings, setSettings] = useState<{
    auto_fetch_enabled: boolean;
    fetch_interval: number;
    last_fetch_time: string | null;
    last_fetch_count: number | null;
  } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("fetch_settings").select("*").limit(1).single();
      if (data) setSettings(data);
    };
    fetch();
  }, []);

  return { settings, setSettings };
}
