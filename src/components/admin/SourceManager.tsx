import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit, ToggleLeft, ToggleRight, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

interface Source {
  id: string;
  name: string;
  slug: string | null;
  url: string;
  website_url: string | null;
  feed_url: string | null;
  fetch_type: string;
  category: string | null;
  language: string;
  is_active: boolean;
  last_fetch: string | null;
  article_count: number | null;
  last_fetch_status: string | null;
}

const FETCH_TYPES = [
  { value: "rss", label: "RSS" },
  { value: "atom", label: "Atom" },
  { value: "api", label: "API" },
  { value: "scraping", label: "HTML Scraping" },
];

const CATEGORIES = [
  "none", "local", "politics", "economy", "sports", "technology",
  "health", "world", "arts", "articles", "arab", "global",
];

const SourceManager = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fetchingSource, setFetchingSource] = useState<string | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [fetchType, setFetchType] = useState("rss");
  const [category, setCategory] = useState("none");
  const [language, setLanguage] = useState<"AR" | "EN">("AR");

  const fetchSources = async () => {
    const { data } = await supabase.from("news_sources").select("*").order("created_at", { ascending: false });
    if (data) setSources(data as unknown as Source[]);
  };

  useEffect(() => { fetchSources(); }, []);

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();

  const resetForm = () => {
    setName(""); setSlug(""); setWebsiteUrl(""); setFeedUrl("");
    setFetchType("rss"); setCategory("none"); setLanguage("AR");
    setShowForm(false); setEditId(null);
  };

  const handleSave = async () => {
    if (!name) { toast.error("اسم المصدر مطلوب"); return; }
    if (!websiteUrl && !feedUrl) { toast.error("أدخل رابط الموقع أو رابط الخلاصة"); return; }

    const finalSlug = slug || generateSlug(name);
    const url = feedUrl || websiteUrl;

    const payload = {
      name,
      slug: finalSlug,
      url,
      website_url: websiteUrl || null,
      feed_url: feedUrl || null,
      fetch_type: feedUrl ? fetchType : "scraping",
      category: category === "none" ? null : category,
      language,
    };

    if (editId) {
      const { error } = await supabase.from("news_sources").update(payload).eq("id", editId);
      if (error) { toast.error("خطأ في التحديث"); return; }
      toast.success("تم تحديث المصدر");
    } else {
      const { error } = await supabase.from("news_sources").insert(payload);
      if (error) { toast.error("خطأ في الحفظ"); return; }
      toast.success("تم إضافة المصدر");
    }
    resetForm();
    fetchSources();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف المصدر وجميع أخباره؟")) return;
    await supabase.from("news_sources").delete().eq("id", id);
    fetchSources();
    toast.success("تم حذف المصدر");
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("news_sources").update({ is_active: !current }).eq("id", id);
    fetchSources();
  };

  const handleEdit = (s: Source) => {
    setEditId(s.id);
    setName(s.name);
    setSlug(s.slug || "");
    setWebsiteUrl(s.website_url || s.url || "");
    setFeedUrl(s.feed_url || "");
    setFetchType(s.fetch_type || "rss");
    setCategory(s.category || "none");
    setLanguage(s.language as "AR" | "EN");
    setShowForm(true);
  };

  const handleFetchSource = async (sourceId: string) => {
    setFetchingSource(sourceId);
    try {
      const res = await supabase.functions.invoke("fetch-news", { body: { source_id: sourceId } });
      if (res.data) toast.success(`تم جلب ${res.data.count || 0} خبر جديد`);
      else toast.error("فشل الجلب");
    } catch { toast.error("حدث خطأ"); }
    setFetchingSource(null);
    fetchSources();
  };

  const handleFetchAll = async () => {
    setFetchingAll(true);
    try {
      const res = await supabase.functions.invoke("fetch-news");
      if (res.data) toast.success(`تم جلب ${res.data.count || 0} خبر جديد من جميع المصادر`);
      else toast.error("فشل الجلب");
    } catch { toast.error("حدث خطأ"); }
    setFetchingAll(false);
    fetchSources();
  };

  const inputClass = "w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm";

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <h2 className="text-foreground font-bold">إدارة المصادر</h2>
        <div className="flex gap-2">
          <button onClick={handleFetchAll} disabled={fetchingAll}
            className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
            <Download size={14} className={fetchingAll ? "animate-bounce" : ""} />
            {fetchingAll ? "جاري الجلب..." : "جلب الأخبار الآن"}
          </button>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
            <Plus size={14} /> إضافة مصدر
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-secondary rounded-xl p-4 space-y-3 border border-border">
          <h3 className="text-foreground font-semibold text-sm mb-2">
            {editId ? "تعديل المصدر" : "مصدر جديد"}
          </h3>

          {/* Source Name */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">اسم المصدر *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="مثال: الجزيرة" className={inputClass} />
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">المعرف (Slug)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="اختياري – يتم إنشاؤه تلقائياً من الاسم" className={inputClass} dir="ltr" />
          </div>

          {/* Website URL */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">رابط الموقع *</label>
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com" className={inputClass} dir="ltr" />
          </div>

          {/* Feed URL */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">رابط الخلاصة (Feed URL)</label>
            <input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed (اتركه فارغاً → HTML Scraping)" className={inputClass} dir="ltr" />
          </div>

          {/* Fetch Type & Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">نوع الجلب</label>
              <select value={feedUrl ? fetchType : "scraping"}
                onChange={(e) => setFetchType(e.target.value)}
                disabled={!feedUrl}
                className={`${inputClass} disabled:opacity-60`}>
                {FETCH_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">التصنيف</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c === "none" ? "بدون تصنيف" : c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">القسم</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as "AR" | "EN")} className={inputClass}>
              <option value="AR">أخبار عربية</option>
              <option value="EN">أخبار عالمية (Global)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              {editId ? "تحديث" : "حفظ"}
            </button>
            <button onClick={resetForm}
              className="px-4 py-2.5 text-muted-foreground hover:text-foreground text-sm transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="bg-secondary rounded-lg p-3 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground text-sm font-medium truncate">{s.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.language === "AR" ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground"}`}>
                    {s.language === "AR" ? "عربي" : "EN"}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.is_active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {s.is_active ? "نشط" : "معطل"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {(s as any).fetch_type || "rss"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {s.article_count || 0} مقال • آخر جلب: {s.last_fetch ? new Date(s.last_fetch).toLocaleString("ar") : "لم يتم"}
                  {s.last_fetch_status && (
                    <span className={s.last_fetch_status === "success" ? " text-green-400" : " text-primary"}>
                      {" "}• {s.last_fetch_status}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => handleFetchSource(s.id)} disabled={fetchingSource === s.id}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50" title="جلب يدوي">
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
