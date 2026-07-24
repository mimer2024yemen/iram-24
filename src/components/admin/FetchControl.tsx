import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCdnStatus } from "@/lib/cdnFeed";
import { CDN_REPO } from "@/config/newsSource";
import { RefreshCw, CheckCircle, Eraser, Cloud, AlertTriangle } from "lucide-react";

const FetchControl = () => {
  const [settings, setSettings] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadSettings = async () => {
    const { data } = await supabase.from("fetch_settings").select("*").limit(1).single();
    if (data) setSettings(data);
    const s = await fetchCdnStatus();
    setStatus(s);
  };

  useEffect(() => { loadSettings(); }, []);

  const handleFetchNow = async () => {
    setFetching(true);
    setResult(null);
    try {
      const res = await supabase.functions.invoke("fetch-news");
      setResult(res.data ? `تم جلب ${res.data.count || 0} مقال جديد` : "حدث خطأ أثناء الجلب");
    } catch {
      setResult("حدث خطأ أثناء الجلب");
    }
    setFetching(false);
    loadSettings();
  };

  const handleDispatchAction = async () => {
    setDispatching(true);
    setResult(null);
    try {
      const res = await supabase.functions.invoke("trigger-fetch");
      if (res.data?.ok) {
        setResult("تم إطلاق GitHub Action — ستظهر الأخبار خلال دقيقة");
        setTimeout(loadSettings, 60000);
      } else {
        setResult(res.data?.error || "تعذر إطلاق GitHub Action");
      }
    } catch {
      setResult("تعذر إطلاق GitHub Action");
    }
    setDispatching(false);
  };

  const handleCleanupDuplicates = async () => {
    setCleaning(true);
    setResult(null);
    try {
      const res = await supabase.functions.invoke("fetch-news", { body: { action: "cleanup_duplicates" } });
      setResult(res.data
        ? `تم حذف ${res.data.removedCount || 0} خبر مكرر ضمن ${res.data.duplicateGroups || 0} مجموعة`
        : "تعذر تنظيف الأخبار المكررة");
    } catch {
      setResult("تعذر تنظيف الأخبار المكررة");
    }
    setCleaning(false);
    loadSettings();
  };

  if (!settings) return <p className="text-muted-foreground text-sm">جاري التحميل...</p>;

  const cdnEnabled = !!CDN_REPO;

  return (
    <div className="space-y-4">
      <h2 className="text-foreground font-bold">التحكم بالجلب التلقائي</h2>

      {/* GitHub Actions pipeline */}
      <div className="bg-secondary rounded-lg p-4 space-y-3 border border-border">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm">
          <Cloud size={16} className="text-primary" />
          نظام الجلب المستقل (GitHub Actions + jsDelivr CDN)
        </div>

        {!cdnEnabled ? (
          <div className="flex gap-2 items-start bg-accent/20 text-foreground p-3 rounded-lg text-xs border border-border">
            <AlertTriangle size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">النظام غير مُفعّل بعد</p>
              <p className="text-muted-foreground">
                1) اربط المشروع بـ GitHub. 2) أضف في GitHub → Settings → Secrets:
                <code className="bg-background px-1 mx-1 rounded">SUPABASE_URL</code>
                و <code className="bg-background px-1 mx-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>.
                3) أضف متغير بيئة <code className="bg-background px-1 mx-1 rounded">VITE_CDN_REPO=owner/repo</code>.
                4) أضف السرّين <code className="bg-background px-1 mx-1 rounded">GITHUB_REPO</code> و
                <code className="bg-background px-1 mx-1 rounded">GITHUB_DISPATCH_TOKEN</code> في Backend Secrets لتفعيل زر «جلب الآن (GitHub)».
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">آخر تحديث CDN:</span>
                <p className="text-foreground">{status?.updated_at ? new Date(status.updated_at).toLocaleString("ar") : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">إجمالي/AR:</span>
                <p className="text-foreground">{status?.languages?.AR?.total ?? 0} ({status?.languages?.AR?.new ?? 0} جديد)</p>
              </div>
            </div>
            {status?.errors?.length > 0 && (
              <div className="text-xs text-primary bg-background/50 rounded p-2 max-h-24 overflow-auto">
                <p className="font-bold mb-1">أخطاء آخر جولة ({status.errors.length}):</p>
                {status.errors.slice(0, 5).map((e: any, i: number) => (
                  <p key={i}>• {e.source}: {e.message}</p>
                ))}
              </div>
            )}
            <button onClick={handleDispatchAction} disabled={dispatching}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
              <RefreshCw size={16} className={dispatching ? "animate-spin" : ""} />
              {dispatching ? "جاري الإطلاق..." : "جلب الآن (GitHub Action)"}
            </button>
          </>
        )}
      </div>

      {/* Legacy edge function */}
      <div className="bg-secondary rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 bg-accent/20 text-foreground p-3 rounded-lg text-xs border border-border">
          <CheckCircle size={16} className="text-primary" />
          <span>الجلب الاحتياطي عبر Edge Function (يعمل عند تعطّل GitHub)</span>
        </div>

        <button onClick={handleFetchNow} disabled={fetching}
          className="w-full flex items-center justify-center gap-2 py-3 bg-card text-foreground border border-border rounded-lg text-sm font-bold disabled:opacity-50">
          <RefreshCw size={16} className={fetching ? "animate-spin" : ""} />
          {fetching ? "جاري الجلب..." : "جلب يدوي (Edge)"}
        </button>

        <button onClick={handleCleanupDuplicates} disabled={cleaning}
          className="w-full flex items-center justify-center gap-2 py-3 bg-card text-foreground rounded-lg text-sm font-bold border border-border disabled:opacity-50">
          <Eraser size={16} className={cleaning ? "animate-pulse" : ""} />
          {cleaning ? "جاري فحص وتنظيف المكرر..." : "تنظيف الأخبار المكررة"}
        </button>

        {result && (
          <p className="text-center text-sm text-foreground bg-secondary border border-border py-2 rounded-lg">{result}</p>
        )}
      </div>

      <div className="bg-secondary rounded-lg p-4 space-y-2">
        <h3 className="text-foreground text-sm font-medium">حالة قاعدة البيانات</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">آخر جلب DB:</span>
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
