import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { decodeHtmlEntities } from "@/lib/newsUtils";

interface BreakingNewsBarProps {
  language: "AR" | "EN";
}

interface BreakingSettings {
  is_active: boolean;
  scroll_speed: number;
  scroll_direction: string;
  separator_style: string;
  auto_refresh: boolean;
}

const BreakingNewsBar = ({ language }: BreakingNewsBarProps) => {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [settings, setSettings] = useState<BreakingSettings | null>(null);

  useEffect(() => {
    const fetchBreaking = async () => {
      const { data } = await supabase
        .from("articles")
        .select("title")
        .eq("language", language)
        .eq("is_breaking", true)
        .order("published_at", { ascending: false })
        .limit(10);

      if (!data || data.length === 0) {
        const { data: latest } = await supabase
          .from("articles")
          .select("title")
          .eq("language", language)
          .order("published_at", { ascending: false })
          .limit(5);
        if (latest) setHeadlines(latest.map((a) => decodeHtmlEntities(a.title)));
      } else {
        setHeadlines(data.map((a) => decodeHtmlEntities(a.title)));
      }
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from("breaking_news_settings").select("*").limit(1).single();
      if (data) setSettings(data as any);
    };

    fetchBreaking();
    fetchSettings();

    const interval = setInterval(fetchBreaking, 30000);
    const channel = supabase
      .channel("breaking-settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "breaking_news_settings" }, () => fetchSettings())
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [language]);

  if (!settings?.is_active && settings !== null) return null;

  if (headlines.length === 0) {
    return (
      <div className="bg-primary overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="bg-background/20 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
            {language === "AR" ? "⚡ عاجل" : "⚡ BREAKING"}
          </span>
          <span className="text-primary-foreground text-xs">
            {language === "AR" ? "جاري تحميل الأخبار..." : "Loading news..."}
          </span>
        </div>
      </div>
    );
  }

  const separator = settings?.separator_style || "●";
  const text = headlines.join(` ${separator} `);
  const speed = settings?.scroll_speed || 5;
  const direction = settings?.scroll_direction || "rtl";
  const isRTL = direction === "rtl";
  const animationClass = direction === "ltr" ? "animate-ticker-ltr" : "animate-ticker-rtl";

  return (
    <div className="bg-primary overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="bg-background/20 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
          <span className="animate-pulse-live">⚡</span>
          {language === "AR" ? "عاجل" : "BREAKING"}
        </span>
        <div className="overflow-hidden flex-1 min-w-0">
          <div className={`whitespace-nowrap ${animationClass}`} style={{ animationDuration: `${speed * 3}s` }}>
            <span className="text-primary-foreground text-xs">{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreakingNewsBar;
