import { useEffect, useState } from "react";
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

const DEFAULT_SETTINGS: BreakingSettings = {
  is_active: true,
  scroll_speed: 5,
  scroll_direction: "rtl",
  separator_style: "●",
  auto_refresh: true,
};

async function fetchHomeHeadlines(language: "AR" | "EN") {
  try {
    const params = new URLSearchParams({ lang: language, limit: "10" });
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-feed?${params.toString()}`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: AbortSignal.timeout(4200),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return ((json?.articles || []) as Array<{ title?: string }>).map((a) => decodeHtmlEntities(a.title || "")).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

const BreakingNewsBar = ({ language }: BreakingNewsBarProps) => {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [settings, setSettings] = useState<BreakingSettings | null>(null);

  useEffect(() => {
    const fetchBreaking = async () => {
      const latest = await fetchHomeHeadlines(language);
      if (latest.length > 0) setHeadlines(latest);
    };

    fetchBreaking();
    setSettings(DEFAULT_SETTINGS);

    const interval = setInterval(fetchBreaking, 30000);
    return () => { clearInterval(interval); };
  }, [language]);

  if (!settings?.is_active && settings !== null) return null;

  if (headlines.length === 0) return null;

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
