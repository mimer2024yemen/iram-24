import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AdminAI = () => {
  const [newsText, setNewsText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!newsText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-news-helper", {
        body: { text: newsText.trim() },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-foreground font-bold">🤖 مساعد الذكاء الاصطناعي</h2>
      <div className="bg-secondary rounded-lg p-4 space-y-3">
        <p className="text-muted-foreground text-xs">ألصق نص الخبر هنا لتحليله وتحسينه</p>
        <textarea
          value={newsText}
          onChange={(e) => setNewsText(e.target.value)}
          placeholder="ألصق نص الخبر هنا..."
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm resize-y"
        />
        <button onClick={handleAnalyze} disabled={loading || !newsText.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "جاري التحليل..." : "تحليل بالذكاء الاصطناعي"}
        </button>

        {result && (
          <div className="bg-card rounded-lg p-4 space-y-3 border border-border">
            {result.betterTitle && (
              <div>
                <p className="text-primary text-xs font-bold mb-1">📝 عنوان مقترح:</p>
                <p className="text-foreground text-sm">{result.betterTitle}</p>
              </div>
            )}
            {result.category && (
              <div>
                <p className="text-primary text-xs font-bold mb-1">📂 التصنيف المقترح:</p>
                <p className="text-foreground text-sm">{result.category}</p>
              </div>
            )}
            {result.hashtags && result.hashtags.length > 0 && (
              <div>
                <p className="text-primary text-xs font-bold mb-1">#️⃣ هاشتاقات:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((h: string, i: number) => (
                    <span key={i} className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded">#{h}</span>
                  ))}
                </div>
              </div>
            )}
            {result.summary && (
              <div>
                <p className="text-primary text-xs font-bold mb-1">📋 ملخص:</p>
                <p className="text-foreground text-xs leading-relaxed">{result.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAI;
