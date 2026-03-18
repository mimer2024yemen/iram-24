import { useState, useEffect } from "react";
import { Article } from "@/hooks/useArticles";
import { supabase } from "@/integrations/supabase/client";

interface NewsSliderProps {
  language: "AR" | "EN";
}

const NewsSlider = ({ language }: NewsSliderProps) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("language", language)
        .order("views", { ascending: false })
        .limit(5);
      if (data) setArticles(data as Article[]);
    };
    fetch();
  }, [language]);

  useEffect(() => {
    if (articles.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % articles.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [articles.length]);

  if (articles.length === 0) {
    return (
      <div className="aspect-[16/9] bg-secondary flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {language === "AR" ? "لا توجد أخبار بعد" : "No news yet"}
        </p>
      </div>
    );
  }

  const article = articles[current];

  return (
    <div className="relative aspect-[16/9] bg-secondary overflow-hidden" dir={language === "AR" ? "rtl" : "ltr"}>
      {article?.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <span className="inline-block bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded mb-2">
          {language === "AR" ? "الأكثر قراءة" : "Most Read"}
        </span>
        <h2 className="text-foreground text-lg font-bold leading-tight line-clamp-2">
          {article?.title}
        </h2>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {articles.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === current ? "bg-primary" : "bg-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default NewsSlider;
