import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Play, Pause } from "lucide-react";

const FetchControl = () => {
  const [settings, setSettings] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadSettings = async () => {
    const { data } = await supabase.from("fetch_settings").select("*").limit(1).single();
    if (data) setSettings(data);
  };

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (settings?.auto_fetch_enabled) {
      intervalRef.current = setInterval(() => {
        handleFetchNow();
      }, (settings.fetch_interval || 2) * 60 * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [settings?.auto_fetch_enabled, settings?.fetch_interval]);

  const handleFetchNow = async () => {
    setFetching(true);
    setResult(null);
    try {
      const res = await supabase.functions.invoke("fetch-news");
      if (res.data) {
        setResult(`تم جلب ${res.data.count || 0} مقال جديد`);
      } else {
        setResult("حدث خطأ أثناء الجلب");
      }
    } catch {
      setResult("حدث خطأ أثناء الجلب");
    }
    setFetching(false);
    loadSettings();
  };

  const toggleAutoFetch = async () => {
    if (!settings) return;
    await supabase.from("fetch_settings").update({ auto_fetch_enabled: !settings.auto_fetch_enabled }).eq("id", settings.id);
    loadSettings();
  };

  const updateInterval = async (val: number) => {
    if (!settings) return;
    await supabase.from("fetch_settings").update({ fetch_interval: val }).eq("id", settings.id);
    loadSettings();
  };

  if (!settings) return <p className="text-muted-foreground text-sm">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-foreground font-bold">التحكم بالجلب التلقائي</h2>

      <div className="bg-secondary rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm">الجلب التلقائي</span>
          <button onClick={toggleAutoFetch}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              settings.auto_fetch_enabled ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
            }`}>
            {settings.auto_fetch_enabled ? <><Pause size={14} /> مفعل</> : <><Play size={14} /> معطل</>}
          </button>
        </div>

        <div>
          <label className="text-foreground text-sm mb-2 block">الفترة الزمنية</label>
          <div className="flex gap-2">
            {[1, 2, 5, 10].map((v) => (
              <button key={v} onClick={() => updateInterval(v)}
                className={`flex-1 py-2 rounded-lg text-sm ${
                  settings.fetch_interval === v ? "bg-primary text-primary-foreground" : "bg-input text-muted-foreground"
                }`}>
                {v} دقيقة
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleFetchNow} disabled={fetching}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
          <RefreshCw size={16} className={fetching ? "animate-spin" : ""} />
          {fetching ? "جاري الجلب..." : "جلب الآن"}
        </button>

        {result && (
          <p className="text-center text-sm text-green-400 bg-green-500/10 py-2 rounded-lg">{result}</p>
        )}
      </div>

      <div className="bg-secondary rounded-lg p-4 space-y-2">
        <h3 className="text-foreground text-sm font-medium">حالة الجلب</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">آخر جلب:</span>
            <p className="text-foreground">{settings.last_fetch_time ? new Date(settings.last_fetch_time).toLocaleString("ar") : "لم يتم بعد"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">عدد المقالات:</span>
            <p className="text-foreground">{settings.last_fetch_count || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FetchControl;
