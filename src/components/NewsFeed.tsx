import { useState, useEffect, useMemo } from "react";
import { useArticles } from "@/hooks/useArticles";
import { AR_CATEGORIES, EN_CATEGORIES } from "@/lib/newsUtils";
import BreakingNewsBar from "@/components/BreakingNewsBar";
import TickerBar from "@/components/TickerBar";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import SearchOverlay from "@/components/SearchOverlay";
import ManualArticlesSection from "@/components/ManualArticlesSection";
import Sidebar from "@/components/Sidebar";
import EditorialMasthead from "@/components/home/EditorialMasthead";
import EditorialNav from "@/components/home/EditorialNav";
import EditorialHero from "@/components/home/EditorialHero";
import EditorialSection from "@/components/home/EditorialSection";
import LiveTicker from "@/components/home/LiveTicker";
import SiteFooter from "@/components/home/SiteFooter";
import NewsCard from "@/components/NewsCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const saveScroll = () => sessionStorage.setItem("eram_feed_scroll", String(window.scrollY));

  const [language, setLanguage] = useState<"AR" | "EN">(
    () => (localStorage.getItem("eram_lang") as "AR" | "EN") || "AR"
  );
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
  const fetchLimit = isHome && page === 1 ? 100 : PAGE_SIZE + 1;
  const { articles, loading } = useArticles(language, activeCategory, page * fetchLimit);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageArticles = articles.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore = articles.length > startIdx + PAGE_SIZE;
  const totalEstimated = articles.length;
  const isRTL = language === "AR";

  const buckets = useMemo(() => {
    const m: Record<string, typeof articles> = {};
    for (const a of articles) (m[a.category] ||= []).push(a);
    return m;
  }, [articles]);

  const onLang = (l: "AR" | "EN") => {
    setLanguage(l);
    localStorage.setItem("eram_lang", l);
    const cats = l === "AR" ? AR_CATEGORIES : EN_CATEGORIES;
    setActiveCategory(cats[0]);
    setSearchParams({ page: "1" }, { replace: true });
  };
  const onCat = (c: string) => {
    setActiveCategory(c);
    setSearchParams({ page: "1" }, { replace: true });
  };

  const Skeleton = () => (
    <div className="space-y-8 py-8">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="aspect-[16/9] bg-foreground/5 animate-pulse mb-4" />
          <div className="h-12 bg-foreground/5 animate-pulse w-3/4" />
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-24 h-20 bg-foreground/5 animate-pulse" />
              <div className="flex-1 h-16 bg-foreground/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const totalPages = Math.max(Math.ceil(totalEstimated / PAGE_SIZE), page + (hasMore ? 1 : 0));
  const renderPagination = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) for (let i = 1; i <= totalPages; i++) pages.push(i);
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return (
      <div className="py-10 border-t border-foreground/15">
        <p className="text-center text-muted-foreground text-[10px] tracking-[0.2em] uppercase mb-4">
          {isRTL
            ? `صفحة ${page} من ${totalPages}`
            : `Page ${page} of ${totalPages}`}
        </p>
        <div className="flex items-center justify-center gap-1" dir={isRTL ? "rtl" : "ltr"}>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-30 hover:text-primary flex items-center gap-1"
          >
            <ChevronRight size={14} />
            {isRTL ? "السابق" : "Prev"}
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="w-8 text-center text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 font-display text-base transition-all ${
                  page === p
                    ? "bg-foreground text-background"
                    : "text-foreground hover:bg-foreground/10"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => setPage(page + 1)}
            disabled={!hasMore}
            className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-30 hover:text-primary flex items-center gap-1"
          >
            {isRTL ? "التالي" : "Next"}
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
    );
  };

  // HOME LAYOUT — Editorial Bold
  const renderHome = () => {
    const top = articles.slice(0, 4);
    const live = articles.slice(0, 10);

    const sportsKey = isRTL ? "رياضة" : "Sports";
    const econKey = isRTL ? "اقتصاد" : "Economy";
    const techKey = isRTL ? "تكنولوجيا" : "Technology";
    const worldKey = isRTL ? "دولي" : "World";
    const healthKey = isRTL ? "صحة" : "Health";
    const arabKey = isRTL ? "عربي" : "World";

    const mostRead = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
    const recent = articles.slice(4, 24);

    return (
      <>
        <EditorialHero articles={top} language={language} onBeforeNavigate={saveScroll} />

        {/* Two-column: World feature + Most Read list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 border-b border-foreground/15">
          <div className="lg:col-span-2 lg:border-l-0 lg:border-r-0">
            <EditorialSection
              title={isRTL ? "الشأن الدولي" : "World Affairs"}
              subtitle={isRTL ? "تغطية شاملة" : "Coverage"}
              articles={buckets[worldKey] || buckets[arabKey] || []}
              language={language}
              variant="feature"
              onMore={() => onCat(worldKey)}
              onBeforeNavigate={saveScroll}
            />
          </div>
          <div className={`${isRTL ? "lg:border-r" : "lg:border-l"} border-foreground/15 lg:pl-6 lg:pr-6`}>
            <EditorialSection
              title={isRTL ? "الأكثر قراءةً" : "Most Read"}
              subtitle={isRTL ? "اختيار القراء" : "Top picks"}
              articles={mostRead}
              language={language}
              variant="list"
              onBeforeNavigate={saveScroll}
            />
          </div>
        </div>

        <EditorialSection
          title={isRTL ? "اقتصاد وأعمال" : "Business & Markets"}
          subtitle={isRTL ? "مال وأسواق" : "Finance"}
          articles={buckets[econKey] || []}
          language={language}
          variant="wide"
          onMore={() => onCat(econKey)}
          onBeforeNavigate={saveScroll}
        />

        <EditorialSection
          title={isRTL ? "الرياضة" : "Sports"}
          subtitle={isRTL ? "ميادين وأبطال" : "Game on"}
          articles={buckets[sportsKey] || []}
          language={language}
          variant="feature"
          onMore={() => onCat(sportsKey)}
          onBeforeNavigate={saveScroll}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div className={`${isRTL ? "md:border-l" : "md:border-r"} border-foreground/15 md:pr-6 md:pl-6`}>
            <EditorialSection
              title={isRTL ? "تكنولوجيا" : "Technology"}
              subtitle={isRTL ? "ابتكار" : "Innovation"}
              articles={buckets[techKey] || []}
              language={language}
              variant="trio"
              onMore={() => onCat(techKey)}
              onBeforeNavigate={saveScroll}
            />
          </div>
          <div className="md:pl-6 md:pr-6">
            <EditorialSection
              title={isRTL ? "صحة" : "Health"}
              subtitle={isRTL ? "علم وحياة" : "Wellness"}
              articles={buckets[healthKey] || []}
              language={language}
              variant="trio"
              onMore={() => onCat(healthKey)}
              onBeforeNavigate={saveScroll}
            />
          </div>
        </div>

        {/* Recent grid */}
        <section className="py-8">
          <div className="flex items-end justify-between mb-5 pb-3 border-b-2 border-foreground">
            <div>
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[hsl(var(--gold))] block mb-1">
                {isRTL ? "تحديثات" : "Updates"}
              </span>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-none">
                {isRTL ? "أحدث المنشورات" : "Latest Stories"}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-7">
            {recent.map((a) => (
              <NewsCard
                key={a.id}
                article={a}
                language={language}
                variant="medium"
                onBeforeNavigate={saveScroll}
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
      <Sidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        language={language}
        onCategorySelect={onCat}
      />

      <EditorialMasthead
        language={language}
        onLanguageChange={onLang}
        onMenuToggle={() => setShowSidebar(true)}
        onSearchToggle={() => setShowSearch(true)}
      />
      <EditorialNav
        categories={categories}
        active={activeCategory}
        onSelect={onCat}
        language={language}
      />
      {!loading && articles.length > 0 && isHome && page === 1 && (
        <LiveTicker articles={articles.slice(0, 10)} language={language} onBeforeNavigate={saveScroll} />
      )}
      <BreakingNewsBar language={language} />
      <TickerBar />

      <main className="max-w-screen-xl mx-auto px-4 md:px-6" style={{ minHeight: "60vh" }}>
        {loading ? (
          <Skeleton />
        ) : pageArticles.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-3xl text-foreground/30">
              {isRTL ? "لا توجد أخبار" : "No stories"}
            </p>
          </div>
        ) : isHome && page === 1 ? (
          renderHome()
        ) : (
          <section className="py-8">
            <div className="flex items-end justify-between mb-5 pb-3 border-b-2 border-foreground">
              <h2 className="font-display text-3xl md:text-4xl text-foreground leading-none">
                {activeCategory}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {totalEstimated}+ {isRTL ? "قصة" : "stories"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-7">
              {pageArticles.map((a) => (
                <NewsCard
                  key={a.id}
                  article={a}
                  language={language}
                  variant="medium"
                  onBeforeNavigate={saveScroll}
                />
              ))}
            </div>
          </section>
        )}

        {!loading && pageArticles.length > 0 && !(isHome && page === 1) && renderPagination()}
      </main>

      <ManualArticlesSection language={language} />
      <SiteFooter language={language} categories={categories} onCategorySelect={onCat} />
      <WhatsAppButton />
      <BottomNav />
    </div>
  );
};

export default NewsFeed;
