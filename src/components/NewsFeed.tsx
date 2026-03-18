import { useState } from "react";
import { useArticles } from "@/hooks/useArticles";
import { AR_CATEGORIES, EN_CATEGORIES } from "@/lib/newsUtils";
import BreakingNewsBar from "@/components/BreakingNewsBar";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import CategoriesNav from "@/components/CategoriesNav";
import NewsSlider from "@/components/NewsSlider";
import NewsCard from "@/components/NewsCard";
import BottomNav from "@/components/BottomNav";

interface NewsFeedProps {
  language: "AR" | "EN";
}

const NewsFeed = ({ language }: NewsFeedProps) => {
  const categories = language === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [limit, setLimit] = useState(20);
  const { articles, loading } = useArticles(language, activeCategory, limit);

  return (
    <div className="min-h-screen bg-background pb-16">
      <BreakingNewsBar language={language} />
      <Header />
      <TickerBar />
      <CategoriesNav
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />
      <NewsSlider language={language} />
      
      <div className="flex flex-col gap-4 p-4">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="grid grid-cols-[1fr_100px] gap-3">
                  <div>
                    <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                    <div className="h-3 bg-secondary rounded w-full mb-1" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                  <div className="w-[100px] h-[100px] bg-secondary rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {language === "AR" ? "لا توجد أخبار حالياً. أضف مصادر من لوحة التحكم." : "No news yet. Add sources from admin panel."}
            </p>
          </div>
        ) : (
          articles.map((article) => (
            <NewsCard key={article.id} article={article} language={language} />
          ))
        )}
      </div>

      {articles.length >= limit && (
        <div className="px-4 pb-6">
          <button
            onClick={() => setLimit((l) => l + 20)}
            className="w-full py-3 rounded-lg border border-border text-foreground text-sm font-medium active:scale-[0.98] transition-transform"
          >
            {language === "AR" ? "عرض المزيد من الأخبار" : "Load More News"}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default NewsFeed;
