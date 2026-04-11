import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Article } from "@/hooks/useArticles";
import { timeAgo, decodeHtmlEntities } from "@/lib/newsUtils";
import { ArrowRight, ArrowLeft, Heart, Share2, Copy, Check, ExternalLink, Eye } from "lucide-react";
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
          .neq("id", id).order("published_at", { ascending: false }).limit(5);
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
        <div className="animate-pulse">
          <div className="w-full aspect-video bg-secondary" />
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-secondary rounded" style={{ width: `${90 - i * 8}%` }} />)}
          </div>
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

  // Parse content into structured data (text paragraphs, images, videos)
  const rawContent = article.content || article.description || "";
  const structured = parseContentToStructured(decodeHtmlEntities(rawContent));
  const contentImages = structured.images.filter(img => img && img.length > 10);
  const contentVideos = structured.videos.filter(v => v && v.length > 10);
  const textParagraphs = structured.text.length > 0
    ? structured.text
    : [(isRTL ? "لا يوجد محتوى إضافي" : "No additional content")];

  // Determine source display logic
  const articleShowSource = (article as any).show_source !== false;
  const sourceShowSource = sourceInfo?.show_source !== false;
  const shouldShowSource = articleShowSource && sourceShowSource;

  // Determine display source name/url
  const displaySourceName = (sourceInfo?.show_source === false && sourceInfo?.alt_source_name)
    ? sourceInfo.alt_source_name
    : sourceInfo?.name || null;

  const displaySourceUrl = (sourceInfo?.show_source === false && sourceInfo?.alt_source_url)
    ? sourceInfo.alt_source_url
    : (shouldShowSource ? article.url : null);

  const videoUrl = (article as any).video_url;
  const seoKeywords = (article as any).seo_keywords;
  const keywordsList = seoKeywords ? seoKeywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [];

  const shareButtons = [
    { name: "WhatsApp", color: "bg-green-600", url: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { name: "Telegram", color: "bg-blue-500", url: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(title + " - إيرام24")}` },
    { name: "X", color: "bg-foreground/80", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
    { name: "Facebook", color: "bg-blue-700", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}` },
  ];

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 h-12 flex items-center gap-3 px-4 bg-background/95 backdrop-blur border-b border-border">
        <button onClick={handleBack} className="flex items-center gap-1 text-foreground hover:text-primary transition-colors" aria-label="العودة">
          {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
          <span className="text-xs font-medium hidden sm:inline">{isRTL ? "رجوع" : "Back"}</span>
        </button>
        <span className="text-foreground font-bold text-sm truncate flex-1">{title}</span>
        <button onClick={handleFav} className="transition-transform active:scale-110">
          <Heart size={18} className={`transition-colors ${isFav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      </header>

      {/* Hero image - only if exists */}
      {article.image_url && !imgError && (
        <div className="w-full bg-secondary overflow-hidden">
          <LazyImage
            src={proxyImageUrl(normalizeImageUrl(article.image_url))}
            alt={title}
            className="w-full max-h-[400px] object-cover"
            loading="eager"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-4 space-y-4 max-w-screen-md mx-auto">
        {/* Meta */}
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{article.category}</span>
          <span className="text-muted-foreground">{timeAgo(article.published_at, lang)}</span>
          {article.views != null && (
            <span className="text-muted-foreground flex items-center gap-1"><Eye size={11} /> {article.views}</span>
          )}
        </div>

        <h1 className="text-foreground text-2xl md:text-3xl font-bold leading-snug">{title}</h1>

        {/* Author & Source */}
        {(article.author_name || displaySourceName) && (
          <div className="flex items-center gap-2 flex-wrap">
            {article.author_image_url && <img src={article.author_image_url} alt={article.author_name || ""} className="w-8 h-8 rounded-full object-cover" />}
            {article.author_name && <span className="text-muted-foreground text-sm">{article.author_name}</span>}
            {displaySourceName && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{displaySourceName}</span>
            )}
          </div>
        )}

        {/* Video */}
        {videoUrl && (
          <div className="rounded-xl overflow-hidden bg-card border border-border">
            <video src={videoUrl} controls className="w-full max-h-[400px]" preload="metadata" />
          </div>
        )}

        <article className="article-content text-foreground text-base md:text-lg leading-[2] break-words">
          {/* Extracted images from content */}
          {contentImages.map((img, i) => (
            <LazyImage
              key={`ci-${i}`}
              src={proxyImageUrl(normalizeImageUrl(img))}
              alt={`${title} - ${i + 1}`}
              className="w-full rounded-xl mb-4 object-cover"
            />
          ))}
          {/* Extracted videos from content */}
          {contentVideos.map((v, i) => (
            <div key={`cv-${i}`} className="rounded-xl overflow-hidden bg-card border border-border mb-4">
              <video src={v} controls className="w-full max-h-[450px]" preload="metadata" />
            </div>
          ))}
          {/* Text paragraphs */}
          {textParagraphs.map((p, i) => (
            <p key={i} className="mb-3">{p}</p>
          ))}
        </article>

        {/* SEO Keywords */}
        {keywordsList.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {keywordsList.map((tag: string, i: number) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        {/* Source link - respects visibility */}
        {displaySourceUrl && !displaySourceUrl.startsWith("#") && (
          <a href={displaySourceUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <ExternalLink size={16} />
            {sourceInfo?.alt_source_name && !sourceInfo?.show_source ? sourceInfo.alt_source_name : (isRTL ? "المصدر الرسمي" : "Official Source")}
          </a>
        )}

        {/* Share */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-foreground text-sm font-bold">{isRTL ? "مشاركة الخبر" : "Share"}</p>
          <div className="flex flex-wrap gap-2">
            {shareButtons.map(btn => (
              <a key={btn.name} href={btn.url} target="_blank" rel="noopener noreferrer"
                className={`${btn.color} text-white px-4 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-90`}>
                {btn.name}
              </a>
            ))}
            <button onClick={handleCopy}
              className="bg-secondary text-foreground px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors hover:bg-accent">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "نسخ الرابط" : "Copy Link")}
            </button>
          </div>
        </div>

        {/* Related */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-foreground text-sm font-bold">{isRTL ? "أخبار ذات صلة" : "Related News"}</p>
            <div className="space-y-3">
              {relatedArticles.map((ra) => {
                const raTitle = decodeHtmlEntities(ra.title);
                const raHasImage = !!(ra.image_url && ra.image_url.trim());
                return (
                  <div key={ra.id} onClick={() => { sessionStorage.setItem("eram_scroll_pos", String(window.scrollY)); navigate(`/article/${ra.id}`); }}
                    className="flex gap-3 cursor-pointer border-b border-border pb-3 last:border-0 hover:bg-accent/30 rounded-lg p-2 -mx-2 transition-colors" dir={isRTL ? "rtl" : "ltr"}>
                    {raHasImage && (
                      <img src={ra.image_url!} alt={raTitle} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-secondary" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground text-sm font-medium line-clamp-2">{raTitle}</h4>
                      <span className="text-muted-foreground text-xs">{timeAgo(ra.published_at, lang)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default ArticlePage;
