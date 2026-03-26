import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Currency {
  id: string;
  name: string;
  code: string;
  price: number | null;
  change_percent: number | null;
  is_active: boolean;
}

const TickerBar = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("currencies").select("*").eq("is_active", true);
      if (data) setCurrencies(data as Currency[]);
    };
    fetch();

    const channel = supabase
      .channel("currencies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "currencies" }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (currencies.length === 0) return null;

  return (
    <div className="bg-secondary border-y border-border py-1.5 overflow-hidden">
      <div className="flex items-center gap-6 px-4 text-xs tabular-nums whitespace-nowrap animate-ticker-rtl" dir="rtl">
        {currencies.map(c => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="text-muted-foreground">{c.name}:</span>
            <span className="text-foreground font-medium">{c.price}</span>
            {c.change_percent !== null && (
              <span className={c.change_percent >= 0 ? "text-green-400" : "text-destructive"}>
                {c.change_percent >= 0 ? "▲" : "▼"}{Math.abs(c.change_percent)}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
