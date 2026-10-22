import { useEffect, useState } from "react";
import { decodeHtmlEntities } from "@/lib/newsUtils";
import Marquee from "@/components/Marquee";
import { fetchFromCdn } from "@/lib/cdnFeed";

const STORAGE_KEY_PREFIX = "eram_breaking_headlines_";

interface BreakingNewsBarProps {
  language: "AR" | "EN";
  initialHeadlines?: string[];
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
  // Ask the main backend and the free GitHub copy at the same time; prefer the backend.
  const [live, backup] = await Promise.all([fetchBackendHeadlines(language), fetchCdnHeadlines(language)]);
  return live.length > 0 ? live : backup;
}

async function fetchCdnHeadlines(language: "AR" | "EN") {
  const rows = await fetchFromCdn(language, undefined, 10);
  return (rows || []).map((a) => decodeHtmlEntities(a.title || "")).filter(Boolean).slice(0, 10);
}

async function fetchBackendHeadlines(language: "AR" | "EN") {
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

const BreakingNewsBar = ({ language, initialHeadlines = [] }: BreakingNewsBarProps) => {
  const [headlines, setHeadlines] = useState<string[]>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + language) || "[]");
      return cached.length ? cached : initialHeadlines;
    } catch { return initialHeadlines; }
  });
  const [settings, setSettings] = useState<BreakingSettings | null>(null);

  useEffect(() => {
    if (initialHeadlines.length > 0) {
      setHeadlines((prev) => prev.length ? prev : initialHeadlines);
      try { localStorage.setItem(STORAGE_KEY_PREFIX + language, JSON.stringify(initialHeadlines)); } catch {}
    }

    const fetchBreaking = async () => {
      const latest = await fetchHomeHeadlines(language);
      if (latest.length > 0) {
        setHeadlines(latest);
        try { localStorage.setItem(STORAGE_KEY_PREFIX + language, JSON.stringify(latest)); } catch {}
      }
    };

    fetchBreaking();
    setSettings(DEFAULT_SETTINGS);

    const interval = setInterval(fetchBreaking, 30000);
    return () => { clearInterval(interval); };
  }, [language, initialHeadlines]);

  if (!settings?.is_active && settings !== null) return null;

  if (headlines.length === 0) return null;

  const separator = settings?.separator_style || "●";
  const direction = settings?.scroll_direction || "rtl";
  const isRTL = language === "AR";

  return (
    <div className="bg-primary overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="bg-background/20 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
          <span className="animate-pulse-live">⚡</span>
          {language === "AR" ? "عاجل" : "BREAKING"}
        </span>
        <Marquee reverse={direction === "rtl"} contentDir={isRTL ? "rtl" : "ltr"} speed={50}>
          {headlines.slice(0, 10).map((h, i) => (
            <span key={i} className="text-primary-foreground text-xs px-3 shrink-0">
              {h}<span className="ps-6 opacity-70">{separator}</span>
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  );
};

export default BreakingNewsBar;
