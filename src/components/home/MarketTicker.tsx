import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Marquee from "@/components/Marquee";
import { fetchCdnMarkets } from "@/lib/cdnFeed";

const MARKET_CACHE_KEY = "eram_market_quotes_v2";

interface Quote {
  symbol: string;
  label_ar: string;
  label_en: string;
  unit?: string;
  price: number;
  change: number;
  changePct: number;
}

interface Props {
  language: "AR" | "EN";
}

const formatNum = (n: number) => {
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toFixed(2);
};

const MarketTicker = ({ language }: Props) => {
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    try { return JSON.parse(localStorage.getItem(MARKET_CACHE_KEY) || "[]"); } catch { return []; }
  });
  const isRTL = language === "AR";

  useEffect(() => {
    let cancelled = false;
    const save = (q: Quote[]) => {
      if (cancelled || !q?.length) return;
      setQuotes(q);
      try { localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(q)); } catch {}
    };
    const load = async () => {
      // Main backend first; if it is unavailable use the free GitHub copy.
      try {
        const { data, error } = await supabase.functions.invoke("market-prices");
        if (!error && data?.quotes?.length) { save(data.quotes); return; }
      } catch {/* fall through */}
      const backup = await fetchCdnMarkets();
      if (backup) save(backup as Quote[]);
    };
    load();
    const id = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (quotes.length === 0) return null;


  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative border-y border-[hsl(var(--gold))]/25 overflow-hidden"
      style={{
        background:
          "linear-gradient(90deg, hsl(220 50% 5%) 0%, hsl(220 45% 8%) 50%, hsl(220 50% 5%) 100%)",
      }}
    >
      <div className="max-w-screen-xl mx-auto flex items-stretch">
        {/* Label */}
        <div className="shrink-0 flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(38_72%_45%)] text-[hsl(var(--primary-foreground))]">
          <Activity size={13} strokeWidth={2.75} className="animate-pulse-live" />
          <span className="text-[10px] md:text-[11px] font-black tracking-[0.18em] uppercase">
            {isRTL ? "الأسواق" : "Markets"}
          </span>
        </div>

        {/* Scrolling track */}
        <div className="flex-1 min-w-0 relative flex">
          <Marquee reverse={isRTL} contentDir={isRTL ? "rtl" : "ltr"} speed={45} rowClassName="py-2">
            {quotes.map((q) => {
              const up = q.change >= 0;
              const label = isRTL ? q.label_ar : q.label_en;
              return (
                <span key={q.symbol} className="flex items-center gap-2 text-[12px] md:text-[13px] tabular-nums px-3.5">
                  <span className="text-white/90 font-bold tracking-wide">{label}</span>
                  <span className="text-white font-display font-semibold" dir="ltr">
                    {q.unit}{formatNum(q.price)}
                  </span>
                  <span
                    dir="ltr"
                    className={`flex items-center gap-0.5 font-bold text-[11px] px-1.5 py-0.5 rounded ${
                      up ? "text-emerald-300 bg-emerald-500/10" : "text-rose-300 bg-rose-500/10"
                    }`}
                  >
                    {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {up ? "+" : ""}{q.changePct.toFixed(2)}%
                  </span>
                  <span className="text-[hsl(var(--gold))]/40 ps-3.5">•</span>
                </span>
              );
            })}
          </Marquee>
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[hsl(220_50%_5%)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[hsl(220_50%_5%)] to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default MarketTicker;
