import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Article } from "@/hooks/useArticles";
import { timeAgo, decodeHtmlEntities } from "@/lib/newsUtils";
import { ArrowRight, ArrowLeft, Heart, Share2, Copy, Check, ExternalLink } from "lucide-react";
import { toggleFavorite, getFavorites } from "@/lib/newsUtils";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState(getFavorites());
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [sourceName, setSourceName] = useState<string | null>(null);

  const lang = article?.language === "EN" ? "EN" : "AR";
  const isRTL = lang === "AR";

  useEffect(() => {
    if (!id) return;
    const fetchArticle = async () => {
      setLoading(true);
      setRelatedArticles([]);
      setSourceName(null);
      const { data } = await supabase.from("articles").select("*").eq("id", id).single();
      if (data) {
        setArticle(data as any);
        await supabase.from("articles").update({ views: (data.views || 0) + 1 }).eq("id", id);

        // Fetch source name
        if (data.source_id) {
          const { data: src } = await supabase.from("news_sources").select("name, website_url, url").eq("id", data.source_id).single();
          if (src) setSourceName(src.name);
        }

        // Fetch related articles (same category, different id)
        const { data: related } = await supabase
          .from("articles")
          .select("*")
          .eq("category", data.category)
          .eq("language", data.language)
          .neq("id", id)
          .order("published_at", { ascending: false })
          .limit(5);
        if (related) setRelatedArticles(related as any);
      }
      setLoading(false);
    };
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">جاري التحميل...</div>
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

  const cleanContent = (raw: string | null): string => {
    if (!raw) return "";
    let text = decodeHtmlEntities(raw);
    text = text.replace(/https?:\/\/[^\s]+/g, "");
    text = text.replace(/(read more|اقرأ أيضا|المزيد|اقرأ المزيد|إقرأ أيضاً).*/gi, "");
    return text.trim();
  };

  const displayContent = cleanContent(article.content) || cleanContent(article.description) || (isRTL ? "لا يوجد محتوى إضافي" : "No additional content");

  const shareButtons = [
    { name: "WhatsApp", color: "bg-green-600", url: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { name: "Telegram", color: "bg-blue-500", url: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(title + " - إيرام24")}` },
    { name: "X", color: "bg-foreground/80", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
    { name: "Facebook", color: "bg-blue-700", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}` },
  ];

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 h-12 flex items-center gap-3 px-4 bg-background/95 backdrop-blur border-b border-border">
        <button onClick={() => navigate(-1)} className="text-foreground">
          {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
        <span className="text-foreground font-bold text-sm truncate flex-1">{title}</span>
        <button onClick={handleFav}>
          <Heart size={18} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
        </button>
      </header>

      {article.image_url && !imgError && (
        <div className="w-full bg-secondary">
          <img src={article.image_url} alt={title} className="w-full max-h-[400px] object-contain" onError={() => setImgError(true)} />
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">{article.category}</span>
          <span className="text-muted-foreground">{timeAgo(article.published_at, lang)}</span>
          {article.views != null && <span className="text-muted-foreground">• {article.views} {isRTL ? "مشاهدة" : "views"}</span>}
        </div>

        <h1 className="text-foreground text-xl font-bold leading-tight">{title}</h1>

        {(article.author_name || sourceName) && (
          <div className="flex items-center gap-2 flex-wrap">
            {article.author_image_url && (
              <img src={article.author_image_url} alt={article.author_name || ""} className="w-8 h-8 rounded-full object-cover" />
            )}
            {article.author_name && <span className="text-muted-foreground text-sm">{article.author_name}</span>}
            {sourceName && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {sourceName}
              </span>
            )}
          </div>
        )}

        <div className="text-foreground text-sm leading-[1.8] whitespace-pre-wrap">{displayContent}</div>

        {/* Original source link */}
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary text-sm font-medium hover:underline py-2"
          >
            <ExternalLink size={16} />
            {isRTL ? "المصدر الأصلي" : "Original Source"}
          </a>
        )}

        {/* Share section */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-foreground text-sm font-bold">{isRTL ? "مشاركة الخبر" : "Share"}</p>
          <div className="flex flex-wrap gap-2">
            {shareButtons.map(btn => (
              <a key={btn.name} href={btn.url} target="_blank" rel="noopener noreferrer"
                className={`${btn.color} text-white px-4 py-2 rounded-lg text-xs font-medium`}>
                {btn.name}
              </a>
            ))}
            <button onClick={handleCopy}
              className="bg-secondary text-foreground px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "نسخ الرابط" : "Copy Link")}
            </button>
          </div>
        </div>

        {/* Related news */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-foreground text-sm font-bold">{isRTL ? "أخبار ذات صلة" : "Related News"}</p>
            <div className="space-y-3">
              {relatedArticles.map((ra) => {
                const raTitle = decodeHtmlEntities(ra.title);
                const raHasImage = !!(ra.image_url && ra.image_url.trim() !== "");
                return (
                  <div
                    key={ra.id}
                    onClick={() => navigate(`/article/${ra.id}`)}
                    className="flex gap-3 cursor-pointer border-b border-border pb-3 last:border-0"
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    {raHasImage && (
                      <img
                        src={ra.image_url!}
                        alt={raTitle}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-secondary"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
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
