import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Article } from "@/hooks/useArticles";
import { decodeHtmlEntities, timeAgo } from "@/lib/newsUtils";
import { ArrowRight, Landmark, TrendingUp, Cpu, Trophy, Globe, Heart, Stethoscope, Palette, Radio as RadioIcon, Newspaper } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  "محلي": Newspaper,
  "عربي": Globe,
  "دولي": Globe,
  "اقتصاد": TrendingUp,
  "رياضة": Trophy,
  "تكنولوجيا": Cpu,
  "صحة": Stethoscope,
  "فنون": Palette,
  "سياسة": Landmark,
  "World": Globe,
  "Economy": TrendingUp,
  "Sports": Trophy,
  "Technology": Cpu,
  "Health": Stethoscope,
  "Arts": Palette,
  "Politics": Landmark,
};

const categoriesAR = ["محلي", "عربي", "دولي", "اقتصاد", "رياضة", "تكنولوجيا", "صحة", "فنون"];
const categoriesEN = ["World", "Economy", "Sports", "Technology", "Health", "Arts"];

const CategoriesPage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  const allCategories = [...categoriesAR, ...categoriesEN];

  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("category", selected)
        .order("published_at", { ascending: false })
        .limit(20);
      setArticles((data as any) || []);
      setLoading(false);
    };
    load();
  }, [selected]);

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <header className="sticky top-0 z-40 h-12 flex items-center gap-3 px-4 bg-background/95 backdrop-blur border-b border-border">
        <button onClick={() => navigate(-1)} className="text-foreground"><ArrowRight size={20} /></button>
        <span className="text-foreground font-bold text-sm">الأقسام</span>
      </header>

      {!selected ? (
        <div className="grid grid-cols-2 gap-3 p-4">
          {allCategories.map((cat) => {
            const Icon = categoryIcons[cat] || Newspaper;
            return (
              <button
                key={cat}
                onClick={() => setSelected(cat)}
                className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon size={22} className="text-primary" />
                </div>
                <span className="text-foreground font-bold text-sm">{cat}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <button onClick={() => setSelected(null)} className="text-primary text-sm">← كل الأقسام</button>
            <span className="text-foreground font-bold text-sm">{selected}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-pulse text-muted-foreground text-sm">جاري التحميل...</div>
            </div>
          ) : articles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد أخبار في هذا القسم</p>
          ) : (
            <div className="divide-y divide-border">
              {articles.map((a) => {
                const title = decodeHtmlEntities(a.title);
                const hasImg = !!(a.image_url && a.image_url.trim() !== "");
                return (
                  <div key={a.id} onClick={() => navigate(`/article/${a.id}`)} className="flex gap-3 p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
                    {hasImg && (
                      <img src={a.image_url!} alt={title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-secondary"
                        onError={(e) => (e.currentTarget.style.display = "none")} loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-foreground font-bold text-sm line-clamp-2">{title}</h3>
                      <span className="text-muted-foreground text-xs">{timeAgo(a.published_at, categoriesAR.includes(a.category) ? "AR" : "EN")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default CategoriesPage;
