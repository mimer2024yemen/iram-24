import { useEffect, useState } from "react";
import { Article } from "@/hooks/useArticles";
import { supabase } from "@/integrations/supabase/client";

interface BreakingNewsBarProps {
  language: "AR" | "EN";
}

const BreakingNewsBar = ({ language }: BreakingNewsBarProps) => {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    const fetchBreaking = async () => {
      const { data } = await supabase
        .from("articles")
        .select("title")
        .eq("language", language)
        .order("published_at", { ascending: false })
        .limit(5);
      if (data) setHeadlines(data.map((a) => a.title));
    };
    fetchBreaking();
    const interval = setInterval(fetchBreaking, 30000);
    return () => clearInterval(interval);
  }, [language]);

  if (headlines.length === 0) {
    return (
      <div className="bg-primary py-2 overflow-hidden">
        <div className="flex items-center gap-3 px-4">
          <span className="bg-background/20 text-primary-foreground text-xs font-bold px-2 py-0.5 rounded shrink-0">
            {language === "AR" ? "عاجل" : "BREAKING"}
          </span>
          <span className="text-primary-foreground text-sm">
            {language === "AR" ? "جاري تحميل الأخبار..." : "Loading news..."}
          </span>
        </div>
      </div>
    );
  }

  const text = headlines.join(" • ");
  const isRTL = language === "AR";

  return (
    <div className="bg-primary py-2 overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 px-4">
        <span className="bg-background/20 text-primary-foreground text-xs font-bold px-2 py-0.5 rounded shrink-0">
          {language === "AR" ? "عاجل" : "BREAKING"}
        </span>
        <div className="overflow-hidden flex-1">
          <div className={`whitespace-nowrap ${isRTL ? "animate-ticker-rtl" : "animate-ticker-ltr"}`}>
            <span className="text-primary-foreground text-sm">{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreakingNewsBar;
