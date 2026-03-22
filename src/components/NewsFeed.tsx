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
import WhatsAppButton from "@/components/WhatsAppButton";
import SearchOverlay from "@/components/SearchOverlay";
import ManualArticlesSection from "@/components/ManualArticlesSection";
import Sidebar from "@/components/Sidebar";

const PAGE_SIZE = 15;

const NewsFeed = () => {
  const [language, setLanguage] = useState<"AR" | "EN">(() => {
    return (localStorage.getItem("eram_lang") as "AR" | "EN") || "AR";
  });
  const categories = language === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [page, setPage] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const limit = page * PAGE_SIZE;
  const { articles, loading } = useArticles(language, activeCategory, limit);

  const currentPageArticles = articles;
  const totalPages = Math.ceil(articles.length / PAGE_SIZE);
  const hasMore = articles.length >= limit;

  const handleLanguageChange = (lang: "AR" | "EN") => {
    setLanguage(lang);
    localStorage.setItem("eram_lang", lang);
    const cats = lang === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
    setActiveCategory(cats[0]);
    setPage(1);
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {showSearch && <SearchOverlay language={language} onClose={() => setShowSearch(false)} />}
      <Sidebar open={showSidebar} onClose={() => setShowSidebar(false)} language={language} onCategorySelect={handleCategorySelect} />
      
      <BreakingNewsBar language={language} />
      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        onMenuToggle={() => setShowSidebar(true)}
        onSearchToggle={() => setShowSearch(true)}
      />
      <TickerBar />
      <CategoriesNav
        categories={categories}
        activeCategory={activeCategory}
        onSelect={handleCategorySelect}
        language={language}
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
        ) : currentPageArticles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              {language === "AR" ? "لا توجد أخبار في هذا القسم حالياً" : "No news in this section yet"}
            </p>
          </div>
        ) : (
          currentPageArticles.map((article) => (
            <NewsCard key={article.id} article={article} language={language} />
          ))
        )}
      </div>

      {/* Pagination */}
      {(hasMore || page > 1) && (
        <div className="flex items-center justify-center gap-2 px-4 pb-6" dir="ltr">
          {page > 1 && (
            <button onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-lg border border-border text-foreground text-sm">
              {language === "AR" ? "السابق" : "Previous"}
            </button>
          )}
          <span className="text-muted-foreground text-sm px-3">
            {language === "AR" ? `صفحة ${page}` : `Page ${page}`}
          </span>
          {hasMore && (
            <button onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {language === "AR" ? "التالي" : "Next"}
            </button>
          )}
        </div>
      )}

      <ManualArticlesSection language={language} />
      <WhatsAppButton />
      <BottomNav />
    </div>
  );
};

export default NewsFeed;
