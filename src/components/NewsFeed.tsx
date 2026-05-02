import { useState, useEffect, useMemo } from "react";
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
import HeroSection from "@/components/home/HeroSection";
import LatestStrip from "@/components/home/LatestStrip";
import CategorySection from "@/components/home/CategorySection";
import SectionHeader from "@/components/home/SectionHeader";
import { ChevronLeft, ChevronRight, Trophy, Globe, TrendingUp, Cpu, Heart, Flame } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const PAGE_SIZE = 30;

const NewsFeed = () => {
  const [searchParams, setSearchParams] = useSearchParams();

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

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const setPage = (p: number) => {
    setSearchParams({ page: String(p) }, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const isHome = activeCategory === "الرئيسية" || activeCategory === "Home";
  // Fetch wider pool on home for hero/sections
  const fetchLimit = isHome && page === 1 ? 80 : PAGE_SIZE + 1;
  const { articles, loading } = useArticles(language, activeCategory, page * fetchLimit);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageArticles = articles.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore = articles.length > startIdx + PAGE_SIZE;
  const totalEstimated = articles.length;
  const isRTL = language === "AR";

  // Build category buckets for home layout
  const buckets = useMemo(() => {
    const map: Record<string, typeof articles> = {};
    for (const a of articles) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [articles]);

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

  const Skeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 animate-pulse rounded-2xl bg-card aspect-[16/9]" />
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="animate-pulse rounded-xl bg-card aspect-[16/9]" />
          <div className="animate-pulse rounded-xl bg-card aspect-[16/9]" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-card aspect-[16/12]" />
        ))}
      </div>
    </div>
  );

  // Pagination
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
      <div className="mt-8 mb-4">
        <p className="text-center text-muted-foreground text-[10px] mb-2">
          {isRTL
            ? `عرض ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} من ${totalEstimated}+ نتيجة`
            : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalEstimated)} of ${totalEstimated}+ results`}
        </p>
        <div className="flex items-center justify-center gap-1" dir={isRTL ? "rtl" : "ltr"}>
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

  // Decide what sections to render on home
  const renderHomeLayout = () => {
    const top = articles.slice(0, 3);
    const latest = articles.slice(3, 11);
    // Most-viewed list
    const mostViewed = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

    // Pull category buckets, filtered to keep variety
    const sportsKey = isRTL ? "رياضة" : "Sports";
    const econKey = isRTL ? "اقتصاد" : "Economy";
    const techKey = isRTL ? "تكنولوجيا" : "Technology";
    const worldKey = isRTL ? "دولي" : "World";
    const healthKey = isRTL ? "صحة" : "Health";

    return (
      <>
        <HeroSection articles={top} language={language} onBeforeNavigate={saveScrollPos} />
        <LatestStrip articles={latest} language={language} onBeforeNavigate={saveScrollPos} />

        {/* World + Most read 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-2">
          <div className="lg:col-span-2">
            <CategorySection
              title={isRTL ? "الأخبار العالمية" : "World News"}
              articles={buckets[worldKey] || []}
              language={language}
              layout="magazine"
              icon={<Globe size={16} />}
              onMore={() => handleCategorySelect(worldKey)}
              onBeforeNavigate={saveScrollPos}
            />
          </div>
          <div>
            <CategorySection
              title={isRTL ? "الأكثر قراءة" : "Most Read"}
              articles={mostViewed}
              language={language}
              layout="list"
              icon={<Flame size={16} />}
              onBeforeNavigate={saveScrollPos}
            />
          </div>
        </div>

        <CategorySection
          title={isRTL ? "اقتصاد ومال" : "Business & Finance"}
          articles={buckets[econKey] || []}
          language={language}
          layout="grid"
          icon={<TrendingUp size={16} />}
          onMore={() => handleCategorySelect(econKey)}
          onBeforeNavigate={saveScrollPos}
        />

        <CategorySection
          title={isRTL ? "رياضة" : "Sports"}
          articles={buckets[sportsKey] || []}
          language={language}
          layout="magazine"
          icon={<Trophy size={16} />}
          onMore={() => handleCategorySelect(sportsKey)}
          onBeforeNavigate={saveScrollPos}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-2">
          <CategorySection
            title={isRTL ? "تكنولوجيا" : "Technology"}
            articles={buckets[techKey] || []}
            language={language}
            layout="grid"
            icon={<Cpu size={16} />}
            onMore={() => handleCategorySelect(techKey)}
            onBeforeNavigate={saveScrollPos}
          />
          <CategorySection
            title={isRTL ? "صحة" : "Health"}
            articles={buckets[healthKey] || []}
            language={language}
            layout="grid"
            icon={<Heart size={16} />}
            onMore={() => handleCategorySelect(healthKey)}
            onBeforeNavigate={saveScrollPos}
          />
        </div>

        {/* All recent grid */}
        <section className="mt-4">
          <SectionHeader title={isRTL ? "أحدث الأخبار" : "Recent News"} language={language} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {articles.slice(11, 31).map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                language={language}
                variant="medium"
                onBeforeNavigate={saveScrollPos}
              />
            ))}
          </div>
        </section>
      </>
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

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-5" style={{ minHeight: "60vh" }}>
        {loading ? (
          <Skeleton />
        ) : pageArticles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              {isRTL ? "لا توجد أخبار في هذا القسم حالياً" : "No news in this section yet"}
            </p>
          </div>
        ) : isHome && page === 1 ? (
          renderHomeLayout()
        ) : (
          <>
            <SectionHeader title={activeCategory} language={language} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pageArticles.map((article) => (
                <NewsCard key={article.id} article={article} language={language} variant="medium" onBeforeNavigate={saveScrollPos} />
              ))}
            </div>
          </>
        )}

        {!loading && pageArticles.length > 0 && !(isHome && page === 1) && renderPagination()}
      </main>

      <ManualArticlesSection language={language} />
      <WhatsAppButton />
      <BottomNav />
    </div>
  );
};

export default NewsFeed;
