import { useState } from "react";
import { useArticles } from "@/hooks/useArticles";
import { AR_CATEGORIES, EN_CATEGORIES } from "@/lib/newsUtils";
import BreakingNewsBar from "@/components/BreakingNewsBar";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import CategoriesNav from "@/components/CategoriesNav";
import NewsCard from "@/components/NewsCard";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import SearchOverlay from "@/components/SearchOverlay";
import ManualArticlesSection from "@/components/ManualArticlesSection";
import Sidebar from "@/components/Sidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

const NewsFeed = () => {
  const [language, setLanguage] = useState<"AR" | "EN">(() => {
    return (localStorage.getItem("eram_lang") as "AR" | "EN") || "AR";
  });
  const categories = language === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [page, setPage] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Fetch more than needed to know total
  const fetchLimit = PAGE_SIZE + 1;
  const { articles, loading } = useArticles(language, activeCategory, page * fetchLimit);

  // Paginate locally
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageArticles = articles.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore = articles.length > startIdx + PAGE_SIZE;
  const totalEstimated = articles.length;

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPage = (p: number) => {
    setPage(p);
    scrollToTop();
  };

  // Split articles: first = featured, rest = grid
  const featuredArticle = pageArticles[0];
  const gridArticles = pageArticles.slice(1);

  const isRTL = language === "AR";

  return (
    <div className="min-h-screen bg-background pb-16 overflow-x-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {showSearch && <SearchOverlay language={language} onClose={() => setShowSearch(false)} />}
      <Sidebar open={showSidebar} onClose={() => setShowSidebar(false)} language={language} onCategorySelect={handleCategorySelect} />

      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        onMenuToggle={() => setShowSidebar(true)}
        onSearchToggle={() => setShowSearch(true)}
      />
      <BreakingNewsBar language={language} />
      <TickerBar />
      <CategoriesNav
        categories={categories}
        activeCategory={activeCategory}
        onSelect={handleCategorySelect}
        language={language}
      />

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-4">
        {loading ? (
          <div className="space-y-4">
            {/* Featured skeleton */}
            <div className="animate-pulse rounded-xl bg-card overflow-hidden">
              <div className="aspect-[16/9] bg-secondary" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-secondary rounded w-1/4" />
                <div className="h-5 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            </div>
            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-card overflow-hidden">
                  <div className="aspect-[16/10] bg-secondary" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-secondary rounded w-1/3" />
                    <div className="h-4 bg-secondary rounded w-full" />
                    <div className="h-3 bg-secondary rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : pageArticles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              {language === "AR" ? "لا توجد أخبار في هذا القسم حالياً" : "No news in this section yet"}
            </p>
          </div>
        ) : (
          <>
            {/* Featured article */}
            {featuredArticle && page === 1 && (
              <div className="mb-4">
                <NewsCard article={featuredArticle} language={language} variant="featured" />
              </div>
            )}

            {/* Grid of medium cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(page === 1 ? gridArticles : pageArticles).map((article) => (
                <NewsCard key={article.id} article={article} language={language} variant="medium" />
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && pageArticles.length > 0 && (
          <div className="mt-8 mb-4">
            {/* Results count */}
            <p className="text-center text-muted-foreground text-xs mb-3">
              {language === "AR"
                ? `عرض ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} من ${totalEstimated}+ نتيجة`
                : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} of ${totalEstimated}+ results`}
            </p>
            <div className="flex items-center justify-center gap-1.5" dir="ltr">
              {/* Previous */}
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-card text-foreground hover:bg-accent border border-border"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">{language === "AR" ? "السابق" : "Previous"}</span>
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, Math.ceil(totalEstimated / PAGE_SIZE) || 1) }, (_, i) => {
                const totalPages = Math.max(Math.ceil(totalEstimated / PAGE_SIZE), page + (hasMore ? 1 : 0));
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else {
                  pageNum = page - 2 + i;
                }
                if (pageNum < 1 || pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-card text-foreground hover:bg-accent border border-border"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next */}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-card text-foreground hover:bg-accent border border-border"
              >
                <span className="hidden sm:inline">{language === "AR" ? "التالي" : "Next"}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      <ManualArticlesSection language={language} />
      <WhatsAppButton />
      <BottomNav />
    </div>
  );
};

export default NewsFeed;
