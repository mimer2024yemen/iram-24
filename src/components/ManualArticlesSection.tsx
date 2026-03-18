import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Article } from "@/hooks/useArticles";
import { timeAgo } from "@/lib/newsUtils";

interface ManualArticlesSectionProps {
  language: "AR" | "EN";
}

const ManualArticlesSection = ({ language }: ManualArticlesSectionProps) => {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const fetchManual = async () => {
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("language", language)
        .eq("is_manual", true)
        .order("published_at", { ascending: false })
        .limit(5);
      if (data) setArticles(data as Article[]);
    };
    fetchManual();

    const channel = supabase
      .channel(`manual-articles-${language}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => {
        fetchManual();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [language]);

  if (articles.length === 0) return null;

  return (
    <div className="px-4 pb-4" dir={language === "AR" ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <h3 className="text-foreground font-bold text-sm">
          {language === "AR" ? "مقالات خاصة" : "Featured Articles"}
        </h3>
      </div>
      <div className="space-y-3">
        {articles.map((article) => (
          <div key={article.id} className="bg-card rounded-xl overflow-hidden border border-border">
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full aspect-video object-contain bg-secondary"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {(article as any).author_image_url && (
                  <img
                    src={(article as any).author_image_url}
                    alt={(article as any).author_name || ""}
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                )}
                <h4 className="text-foreground font-bold text-sm leading-snug line-clamp-2 flex-1">
                  {article.title}
                </h4>
              </div>
              {article.description && (
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3 mb-2">
                  {article.description}
                </p>
              )}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-primary font-medium">{article.category}</span>
                {(article as any).author_name && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{(article as any).author_name}</span>
                  </>
                )}
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{timeAgo(article.published_at, language)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManualArticlesSection;
