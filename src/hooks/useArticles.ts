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

// Module-level memory cache for instant subsequent loads (SPA-like UX)
const cache = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

export function useArticles(language: "AR" | "EN", category?: string, limit = 30) {
  const cacheKey = `${language}|${category || ""}|${limit}`;
  const cached = cache.get(cacheKey);
  const fresh = cached && Date.now() - cached.ts < CACHE_TTL;

  const [articles, setArticles] = useState<Article[]>(cached?.data || []);
  const [loading, setLoading] = useState(!fresh);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchArticles = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      let q = supabase
        .from("articles")
        .select("*")
        .eq("language", language)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (category && category !== "الرئيسية" && category !== "Home") {
        q = q.eq("category", category);
      }

      const { data } = await q;
      if (!alive) return;
      const items = (data as Article[]) || [];
      cache.set(cacheKey, { data: items, ts: Date.now() });
      setArticles(items);
      setLoading(false);
    };

    // Serve cache instantly, refetch silently if stale
    if (fresh) {
      setArticles(cached!.data);
      setLoading(false);
    } else {
      fetchArticles(true);
    }

    // Realtime — debounced to avoid lag
    const channel = supabase
      .channel(`articles-rt-${cacheKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => fetchArticles(false), 1500);
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
