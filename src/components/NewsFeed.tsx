import { useState, useEffect } from "react";
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
import { useSearchParams } from "react-router-dom";

const PAGE_SIZE = 30;

const NewsFeed = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Restore scroll position when returning via back button
  useEffect(() => {
    const savedPos = sessionStorage.getItem("eram_feed_scroll");
    if (savedPos) {
      setTimeout(() => window.scrollTo(0, parseInt(savedPos)), 50);
      sessionStorage.removeItem("eram_feed_scroll");
    }
  }, []);

  const saveScrollPos = () => {
    sessionStorage.setItem("eram_feed_scroll", String(window.scrollY));
  };

  const [language, setLanguage] = useState<"AR" | "EN">(() => {
    return (localStorage.getItem("eram_lang") as "AR" | "EN") || "AR";
  });
  const categories = language === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  // Read page from URL
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const setPage = (p: number) => {
    setSearchParams({ page: String(p) }, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const fetchLimit = PAGE_SIZE + 1;
  const { articles, loading } = useArticles(language, activeCategory, page * fetchLimit);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageArticles = articles.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore = articles.length > startIdx + PAGE_SIZE;
  const totalEstimated = articles.length;

  const handleLanguageChange = (lang: "AR" | "EN") => {
    setLanguage(lang);
    localStorage.setItem("eram_lang", lang);
    const cats = lang === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
    setActiveCategory(cats[0]);
    setSearchParams({ page: "1" }, { replace: true });
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setSearchParams({ page: "1" }, { replace: true });
  };

  const featuredArticle = pageArticles[0];
  const gridArticles = pageArticles.slice(1);
  const isRTL = language === "AR";

  // Skeleton loader
  const Skeleton = () => (
    <div className="space-y-4">
      <div className="animate-pulse rounded-xl bg-card overflow-hidden">
        <div className="aspect-[16/9] bg-secondary" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-secondary rounded w-1/4" />
          <div className="h-5 bg-secondary rounded w-3/4" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      </div>
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
  );

  // Pagination component
  const totalPages = Math.max(Math.ceil(totalEstimated / PAGE_SIZE), page + (hasMore ? 1 : 0));
  const renderPagination = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="mt-6 mb-4">
        <p className="text-center text-muted-foreground text-[10px] mb-2">
          {isRTL
            ? `عرض ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} من ${totalEstimated}+ نتيجة`
            : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} of ${totalEstimated}+ results`}
        </p>
        <div className="flex items-center justify-center gap-1" dir={isRTL ? "rtl" : "ltr"}>
          {/* In RTL: "Next" is on the left, "Previous" is on the right — handled by dir=rtl */}
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-card text-foreground hover:bg-primary hover:text-primary-foreground border border-border"
          >
            <ChevronRight size={14} />
            <span className="hidden sm:inline">{isRTL ? "السابق" : "Previous"}</span>
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-muted-foreground text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  page === p
                    ? "bg-primary text-primary-foreground shadow-lg scale-110"
                    : "bg-card text-foreground hover:bg-accent border border-border"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage(page + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-card text-foreground hover:bg-primary hover:text-primary-foreground border border-border"
          >
            <span className="hidden sm:inline">{isRTL ? "التالي" : "Next"}</span>
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
    );
  };

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

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-4" style={{ minHeight: "60vh" }}>
        {loading ? (
          <Skeleton />
        ) : pageArticles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              {isRTL ? "لا توجد أخبار في هذا القسم حالياً" : "No news in this section yet"}
            </p>
          </div>
        ) : (
          <>
            {featuredArticle && page === 1 && (
              <div className="mb-4">
                <NewsCard article={featuredArticle} language={language} variant="featured" onBeforeNavigate={saveScrollPos} />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {(page === 1 ? gridArticles : pageArticles).map((article) => (
                <NewsCard key={article.id} article={article} language={language} variant="medium" onBeforeNavigate={saveScrollPos} />
              ))}
            </div>
          </>
        )}

        {!loading && pageArticles.length > 0 && renderPagination()}
      </main>

      <ManualArticlesSection language={language} />
      <WhatsAppButton />
      <BottomNav />
    </div>
  );
};

export default NewsFeed;
