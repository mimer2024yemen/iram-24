import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ArticleRow {
  id: string;
  title: string;
  category: string;
  language: string;
  published_at: string | null;
  views: number | null;
  is_manual: boolean;
  image_url: string | null;
}

const NewsManager = () => {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [filter, setFilter] = useState<"all" | "AR" | "EN">("all");

  const fetchArticles = async () => {
    setLoading(true);
    let q = supabase.from("articles").select("id, title, category, language, published_at, views, is_manual, image_url")
      .order("published_at", { ascending: false }).limit(100);
    if (filter !== "all") q = q.eq("language", filter);
    const { data } = await q;
    setArticles((data as ArticleRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا الخبر؟")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); fetchArticles(); }
  };

  const handleEdit = (a: ArticleRow) => {
    setEditId(a.id);
    setEditTitle(a.title);
    setEditCategory(a.category);
  };

  const handleSave = async () => {
    if (!editId) return;
    const { error } = await supabase.from("articles").update({ title: editTitle, category: editCategory }).eq("id", editId);
    if (error) toast.error(error.message);
    else { toast.success("تم التحديث"); setEditId(null); fetchArticles(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground font-bold">📰 إدارة الأخبار</h2>
        <div className="flex gap-1">
          {(["all", "AR", "EN"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground bg-secondary"}`}>
              {f === "all" ? "الكل" : f === "AR" ? "عربي" : "EN"}
            </button>
          ))}
        </div>
      </div>

      {editId && (
        <div className="bg-secondary rounded-lg p-3 space-y-2">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm" />
          <input value={editCategory} onChange={e => setEditCategory(e.target.value)}
            placeholder="التصنيف" className="w-full px-3 py-2 rounded-lg bg-input text-foreground border border-border text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm">حفظ</button>
            <button onClick={() => setEditId(null)} className="px-4 py-2 text-muted-foreground text-sm">إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-8">جاري التحميل...</p>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {articles.map(a => (
            <div key={a.id} className="bg-secondary rounded-lg p-2.5 flex items-center gap-2">
              {a.image_url && (
                <img src={a.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-xs font-medium truncate">{a.title}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="text-primary">{a.category}</span>
                  <span>•</span>
                  <span>{a.views || 0} 👁</span>
                  {a.is_manual && <span className="text-green-400">✍️</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => handleEdit(a)} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <Edit size={13} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 text-muted-foreground hover:text-primary">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد أخبار</p>}
        </div>
      )}
    </div>
  );
};

export default NewsManager;
