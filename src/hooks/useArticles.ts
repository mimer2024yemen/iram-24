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

// Persistent localStorage cache for instant first paint (survives refresh)
const MEM_CACHE = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 min fresh
const STALE_TTL = 24 * 60 * 60 * 1000; // 24h stale-while-revalidate

// Only the columns the UI actually needs — keeps payloads small & fast
const COLS =
  "id,title,description,url,image_url,category,language,published_at,views,source_id,created_at,author_name,author_image_url,is_manual";

function readPersisted(key: string): { data: Article[]; ts: number } | null {
  try {
    const raw = localStorage.getItem("eram_cache_" + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > STALE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writePersisted(key: string, data: Article[]) {
  try {
    localStorage.setItem("eram_cache_" + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {/* quota */}
}

export function useArticles(language: "AR" | "EN", category?: string, limit = 30) {
  const cacheKey = `${language}|${category || ""}|${limit}`;
  const initial =
    MEM_CACHE.get(cacheKey) ||
    readPersisted(cacheKey) ||
    null;

  const [articles, setArticles] = useState<Article[]>(initial?.data || []);
  const [loading, setLoading] = useState(!initial);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;

    const fetchArticles = async (showLoading: boolean) => {
      if (showLoading && articles.length === 0) setLoading(true);

      const run = async (): Promise<Article[] | null> => {
        let q = supabase
          .from("articles")
          .select(COLS)
          .eq("language", language)
          .order("published_at", { ascending: false })
          .limit(limit);
        if (category && category !== "الرئيسية" && category !== "Home") {
          q = q.eq("category", category);
        }
        // 10s safety timeout
        const timer = new Promise<null>((res) => setTimeout(() => res(null), 10_000));
        const result = await Promise.race([q, timer]);
        if (!result || (result as any).error) return null;
        return ((result as any).data as Article[]) || [];
      };

      // Retry up to 3 times with backoff
      for (attempt = 0; attempt < 3; attempt++) {
        const data = await run();
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
      // All failed — keep whatever we have (cached or empty) but stop spinner
      if (alive) setLoading(false);
    };

    const fresh = initial && Date.now() - initial.ts < CACHE_TTL;
    if (fresh) {
      setLoading(false);
    } else {
      fetchArticles(true);
    }

    // Realtime — debounced, silent refresh
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
