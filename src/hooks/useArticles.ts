import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Article {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  category: string;
  language: string;
  published_at: string | null;
  views: number | null;
  source_id: string | null;
  created_at: string;
}

export function useArticles(language: "AR" | "EN", category?: string, limit = 20) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("articles")
        .select("*")
        .eq("language", language)
        .eq("is_manual", false)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (category && category !== "الرئيسية" && category !== "Home") {
        q = q.eq("category", category);
      }

      const { data } = await q;
      setArticles((data as Article[]) || []);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("articles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
