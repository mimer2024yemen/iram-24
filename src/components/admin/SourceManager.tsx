import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Source {
  id: string;
  name: string;
  url: string;
  language: string;
  is_active: boolean;
  last_fetch: string | null;
  article_count: number | null;
  last_fetch_status: string | null;
}

const SourceManager = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<"AR" | "EN">("AR");
  const [fetchingSource, setFetchingSource] = useState<string | null>(null);

  const fetchSources = async () => {
    const { data } = await supabase.from("news_sources").select("*").order("created_at", { ascending: false });
    if (data) setSources(data as Source[]);
  };

  useEffect(() => { fetchSources(); }, []);

  const handleSave = async () => {
    if (!name || !url) return;
    if (editId) {
      await supabase.from("news_sources").update({ name, url, language }).eq("id", editId);
    } else {
      await supabase.from("news_sources").insert({ name, url, language });
    }
    setName(""); setUrl(""); setLanguage("AR"); setShowForm(false); setEditId(null);
    fetchSources();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف المصدر وجميع أخباره؟")) return;
    await supabase.from("news_sources").delete().eq("id", id);
    fetchSources();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("news_sources").update({ is_active: !current }).eq("id", id);
    fetchSources();
  };

  const handleEdit = (s: Source) => {
    setEditId(s.id); setName(s.name); setUrl(s.url); setLanguage(s.language as "AR" | "EN"); setShowForm(true);
  };

  const handleFetchSource = async (sourceId: string) => {
    setFetchingSource(sourceId);
    try {
      const res = await supabase.functions.invoke("fetch-news", { body: { source_id: sourceId } });
      if (res.data) {
        toast.success(`تم جلب ${res.data.count || 0} خبر جديد`);
      } else {
        toast.error("فشل الجلب");
      }
    } catch {
      toast.error("حدث خطأ");
    }
    setFetchingSource(null);
    fetchSources();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground font-bold">إدارة المصادر</h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setName(""); setUrl(""); }}
          className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
          <Plus size={14} /> إضافة مصدر
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary rounded-lg p-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المصدر"
            className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط RSS"
            className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm" dir="ltr" />
          <select value={language} onChange={(e) => setLanguage(e.target.value as "AR" | "EN")}
            className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm">
            <option value="AR">عربي</option>
            <option value="EN">Global</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              {editId ? "تحديث" : "حفظ"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-muted-foreground text-sm">إلغاء</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="bg-secondary rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium truncate">{s.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.language === "AR" ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground"}`}>
                    {s.language === "AR" ? "عربي" : "EN"}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.is_active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {s.is_active ? "نشط" : "معطل"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {s.article_count || 0} مقال • آخر جلب: {s.last_fetch ? new Date(s.last_fetch).toLocaleString("ar") : "لم يتم"}
                  {s.last_fetch_status && <span className={s.last_fetch_status === "success" ? " text-green-400" : " text-primary"}> • {s.last_fetch_status}</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => handleFetchSource(s.id)} disabled={fetchingSource === s.id}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50">
                  <RefreshCw size={14} className={fetchingSource === s.id ? "animate-spin" : ""} />
                </button>
                <button onClick={() => handleToggle(s.id, s.is_active)} className="p-1.5 text-muted-foreground hover:text-foreground">
                  {s.is_active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => handleEdit(s)} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-muted-foreground hover:text-primary">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">لا توجد مصادر بعد</p>
        )}
      </div>
    </div>
  );
};

export default SourceManager;
