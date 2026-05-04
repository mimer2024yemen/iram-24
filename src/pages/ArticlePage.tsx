import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Article } from "@/hooks/useArticles";
import { timeAgo, decodeHtmlEntities } from "@/lib/newsUtils";
import { ArrowRight, ArrowLeft, Heart, Copy, Check, ExternalLink, Eye, Clock } from "lucide-react";
import { toggleFavorite, getFavorites } from "@/lib/newsUtils";
import BottomNav from "@/components/BottomNav";
import LazyImage from "@/components/LazyImage";
import { normalizeImageUrl, parseContentToStructured } from "@/lib/contentParser";
import { proxyImageUrl } from "@/lib/imageProxy";
import { toast } from "sonner";

interface SourceInfo {
  name: string;
  show_source: boolean;
  alt_source_name: string | null;
  alt_source_url: string | null;
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState(getFavorites());
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);

  const lang = article?.language === "EN" ? "EN" : "AR";
  const isRTL = lang === "AR";

  useEffect(() => {
    const saveScroll = () => { sessionStorage.setItem("eram_scroll_pos", String(window.scrollY)); };
    window.addEventListener("beforeunload", saveScroll);
    return () => window.removeEventListener("beforeunload", saveScroll);
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchArticle = async () => {
      setLoading(true);
      setRelatedArticles([]);
      setSourceInfo(null);
      setImgError(false);
      const { data } = await supabase.from("articles").select("*").eq("id", id).single();
      if (data) {
        setArticle(data as any);
        await supabase.from("articles").update({ views: (data.views || 0) + 1 }).eq("id", id);

        if (data.source_id) {
          const { data: src } = await supabase.from("news_sources")
            .select("name, website_url, url, show_source, alt_source_name, alt_source_url")
            .eq("id", data.source_id).single();
          if (src) setSourceInfo(src as any);
        }

        const { data: related } = await supabase.from("articles").select("*")
          .eq("category", data.category).eq("language", data.language)
          .neq("id", id).order("published_at", { ascending: false }).limit(6);
        if (related) setRelatedArticles(related as any);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo({ top: 0 });
  }, [id]);

  const handleBack = () => {
    navigate(-1);
    setTimeout(() => {
      const savedPos = sessionStorage.getItem("eram_scroll_pos");
      if (savedPos) window.scrollTo({ top: parseInt(savedPos), behavior: "smooth" });
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <header className="sticky top-0 z-40 h-12 flex items-center gap-3 px-4 bg-background/95 backdrop-blur border-b border-border">
          <div className="w-5 h-5 rounded bg-secondary animate-pulse" />
          <div className="h-4 bg-secondary rounded w-2/3 animate-pulse" />
        </header>
        <div className="animate-pulse max-w-screen-md mx-auto p-4 space-y-3">
          <div className="h-10 bg-secondary rounded w-3/4" />
          <div className="w-full aspect-video bg-secondary" />
          {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-secondary rounded" style={{ width: `${90 - i * 8}%` }} />)}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">المقال غير موجود</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm">العودة للرئيسية</button>
      </div>
    );
  }

  const isFav = favs.includes(article.id);
  const articleUrl = `${window.location.origin}/article/${article.id}`;
  const title = decodeHtmlEntities(article.title);
  const shareText = `${title} - إيرام24\n${articleUrl}`;
  const handleFav = () => setFavs(toggleFavorite(article.id));
  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success(isRTL ? "تم نسخ الرابط" : "Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const rawContent = article.content || article.description || "";
  const structured = parseContentToStructured(decodeHtmlEntities(rawContent));
  const contentImages = structured.images.filter(img => img && img.length > 10);
  const contentVideos = structured.videos.filter(v => v && v.length > 10);
  const textParagraphs = structured.text.length > 0
    ? structured.text
    : [(isRTL ? "لا يوجد محتوى إضافي" : "No additional content")];

  // Reading time estimate
  const wordCount = textParagraphs.join(" ").split(/\s+/).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  const articleShowSource = (article as any).show_source !== false;
  const sourceShowSource = sourceInfo?.show_source !== false;
  const shouldShowSource = articleShowSource && sourceShowSource;

  const displaySourceName = (sourceInfo?.show_source === false && sourceInfo?.alt_source_name)
    ? sourceInfo.alt_source_name
    : sourceInfo?.name || null;

  const displaySourceUrl = (sourceInfo?.show_source === false && sourceInfo?.alt_source_url)
    ? sourceInfo.alt_source_url
    : (shouldShowSource ? article.url : null);

  const videoUrl = (article as any).video_url;
  const seoKeywords = (article as any).seo_keywords;
  const keywordsList = seoKeywords ? seoKeywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [];

  const hasHero = !!(article.image_url && !imgError);

  const shareButtons = [
    { name: "WhatsApp", color: "bg-green-600", url: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { name: "Telegram", color: "bg-blue-500", url: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(title + " - إيرام24")}` },
    { name: "X", color: "bg-foreground/80", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
    { name: "Facebook", color: "bg-blue-700", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}` },
  ];

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 h-12 flex items-center gap-3 px-4 bg-background/95 backdrop-blur border-b border-foreground/10">
        <button onClick={handleBack} className="flex items-center gap-1 text-foreground hover:text-primary transition-colors" aria-label="العودة">
          {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
          <span className="text-xs font-medium hidden sm:inline">{isRTL ? "رجوع" : "Back"}</span>
        </button>
        <span className="font-display text-lg flex-1 text-center">{isRTL ? "إيرام24" : "ERAM 24"}</span>
        <button onClick={handleFav} className="transition-transform active:scale-110">
          <Heart size={18} className={`transition-colors ${isFav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      </header>

      <article className="max-w-screen-md mx-auto px-4 md:px-6 pt-8 pb-6">
        {/* Category eyebrow */}
        <div className="text-center mb-4">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary">
            {article.category}
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-3xl md:text-5xl text-foreground leading-[1.1] text-center mb-5">
          {title}
        </h1>

        {/* Standfirst */}
        {article.description && (
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed text-center max-w-2xl mx-auto mb-6">
            {decodeHtmlEntities(article.description)}
          </p>
        )}

        {/* Decorative rule */}
        <div className="editorial-rule max-w-[120px] mx-auto mb-6" />

        {/* Meta byline */}
        <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] uppercase tracking-wider text-muted-foreground">
          {article.author_image_url && <img src={article.author_image_url} alt={article.author_name || ""} className="w-7 h-7 rounded-full object-cover" />}
          {article.author_name && (
            <span>{isRTL ? "بقلم" : "By"} <span className="text-foreground font-bold">{article.author_name}</span></span>
          )}
          <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(article.published_at, lang)}</span>
          <span className="flex items-center gap-1">{readMinutes} {isRTL ? "د قراءة" : "min read"}</span>
          {article.views != null && (
            <span className="flex items-center gap-1"><Eye size={11} />{article.views}</span>
          )}
        </div>
      </article>

      {/* Hero image — full bleed */}
      {hasHero && (
        <figure className="max-w-screen-lg mx-auto px-4 md:px-6 mb-8">
          <div className="overflow-hidden bg-foreground/5">
            <LazyImage
              src={proxyImageUrl(normalizeImageUrl(article.image_url!))}
              alt={title}
              className="w-full max-h-[520px] object-cover"
              loading="eager"
              onError={() => setImgError(true)}
            />
          </div>
        </figure>
      )}

      <div className="max-w-screen-md mx-auto px-4 md:px-6">
        {/* Video */}
        {videoUrl && (
          <div className="overflow-hidden bg-foreground/5 border border-foreground/10 mb-6">
            <video src={videoUrl} controls className="w-full max-h-[480px]" preload="metadata" />
          </div>
        )}

        {/* Body */}
        <div className="article-content text-foreground text-[17px] md:text-[18px] leading-[1.9] break-words">
          {contentImages.map((img, i) => (
            <figure key={`ci-${i}`} className="my-6">
              <LazyImage
                src={proxyImageUrl(normalizeImageUrl(img))}
                alt={`${title} - ${i + 1}`}
                className="w-full object-cover"
              />
            </figure>
          ))}
          {contentVideos.map((v, i) => (
            <div key={`cv-${i}`} className="overflow-hidden bg-foreground/5 border border-foreground/10 my-6">
              <video src={v} controls className="w-full max-h-[450px]" preload="metadata" />
            </div>
          ))}
          {textParagraphs.map((p, i) => (
            <p key={i} className="mb-5 first:first-letter:font-display first:first-letter:text-5xl first:first-letter:float-start first:first-letter:leading-[0.9] first:first-letter:mr-2 first:first-letter:mt-1">{p}</p>
          ))}
        </div>

        {/* Tags */}
        {keywordsList.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-6 mt-6 border-t border-foreground/10">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
              {isRTL ? "وسوم" : "Tags"}
            </span>
            {keywordsList.map((tag: string, i: number) => (
              <span key={i} className="text-xs text-foreground border border-foreground/20 hover:border-primary hover:text-primary transition-colors px-2.5 py-1">#{tag}</span>
            ))}
          </div>
        )}

        {/* Source */}
        {displaySourceUrl && !displaySourceUrl.startsWith("#") && (
          <a href={displaySourceUrl} target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 border border-foreground/20 hover:border-primary hover:text-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors">
            <ExternalLink size={14} />
            {displaySourceName || (isRTL ? "المصدر الرسمي" : "Official Source")}
          </a>
        )}

        {/* Share */}
        <div className="border-t border-foreground/10 pt-6 mt-8 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[hsl(var(--gold))]">
            {isRTL ? "مشاركة" : "Share"}
          </p>
          <div className="flex flex-wrap gap-2">
            {shareButtons.map(btn => (
              <a key={btn.name} href={btn.url} target="_blank" rel="noopener noreferrer"
                className={`${btn.color} text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90`}>
                {btn.name}
              </a>
            ))}
            <button onClick={handleCopy}
              className="bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-opacity hover:opacity-90">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "نسخ" : "Copy")}
            </button>
          </div>
        </div>

        {/* Related */}
        {relatedArticles.length > 0 && (
          <section className="border-t border-foreground/10 mt-10 pt-8">
            <div className="mb-5 pb-3 border-b-2 border-foreground">
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[hsl(var(--gold))] block mb-1">
                {isRTL ? "للمتابعة" : "Keep reading"}
              </span>
              <h2 className="font-display text-2xl text-foreground leading-none">
                {isRTL ? "أخبار ذات صلة" : "Related Stories"}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relatedArticles.map((ra) => {
                const raTitle = decodeHtmlEntities(ra.title);
                const raHasImage = !!(ra.image_url && ra.image_url.trim());
                return (
                  <article key={ra.id} onClick={() => { sessionStorage.setItem("eram_scroll_pos", String(window.scrollY)); navigate(`/article/${ra.id}`); }}
                    className="cursor-pointer group" dir={isRTL ? "rtl" : "ltr"}>
                    {raHasImage && (
                      <div className="aspect-[16/10] overflow-hidden bg-foreground/5 mb-2">
                        <LazyImage
                          src={proxyImageUrl(normalizeImageUrl(ra.image_url!))}
                          alt={raTitle}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-primary">{ra.category}</span>
                    <h4 className="font-display text-base md:text-lg text-foreground leading-tight mt-1 line-clamp-3 group-hover:text-primary transition-colors">{raTitle}</h4>
                    <span className="text-[10px] text-muted-foreground mt-1.5 block uppercase tracking-wider">{timeAgo(ra.published_at, lang)}</span>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default ArticlePage;
