import { Heart, Share2, Clock, ArrowUpRight } from "lucide-react";
import { Article } from "@/hooks/useArticles";
import { timeAgo, toggleFavorite, getFavorites, decodeHtmlEntities } from "@/lib/newsUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { proxyImageUrl } from "@/lib/imageProxy";
import { normalizeImageUrl } from "@/lib/contentParser";
import LazyImage from "@/components/LazyImage";

interface NewsCardProps {
  article: Article;
  language: "AR" | "EN";
  variant?: "featured" | "medium" | "compact";
  onBeforeNavigate?: () => void;
}

const NewsCard = ({ article, language, variant = "medium", onBeforeNavigate }: NewsCardProps) => {
  const [favs, setFavs] = useState(getFavorites());
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();
  const isFav = favs.includes(article.id);
  const isRTL = language === "AR";

  const goToArticle = () => {
    onBeforeNavigate?.();
    navigate(`/article/${article.id}`);
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(toggleFavorite(article.id));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/article/${article.id}`;
    const text = `${decodeHtmlEntities(article.title)} - إيرام برس\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: decodeHtmlEntities(article.title), text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const rawImgUrl = article.image_url?.trim() || "";
  const imgSrc = rawImgUrl ? proxyImageUrl(normalizeImageUrl(rawImgUrl)) : "";
  const hasImage = !!(rawImgUrl && !imgError);
  const title = decodeHtmlEntities(article.title);

  // Featured — premium full-bleed
  if (variant === "featured") {
    return (
      <article
        className="relative overflow-hidden cursor-pointer group rounded-2xl shadow-luxe hover-lift bg-[hsl(var(--navy-deep))]"
        onClick={goToArticle}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {hasImage ? (
          <div className="aspect-[16/10] overflow-hidden">
            <LazyImage
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-110"
              loading="eager"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="aspect-[16/10] bg-gradient-to-br from-[hsl(220_45%_12%)] to-[hsl(var(--navy-deep))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-deep))]/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <span className="inline-block text-[10px] tracking-[0.25em] uppercase font-bold text-[hsl(var(--gold))] mb-2">
            {article.category}
          </span>
          <h2 className="font-display text-lg md:text-2xl text-white leading-tight line-clamp-3 group-hover:text-[hsl(var(--gold-soft))] transition-colors">
            {title}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-white/60 mt-3 uppercase tracking-wider">
            <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(article.published_at, language)}</span>
          </div>
        </div>
      </article>
    );
  }

  // Medium — premium editorial card
  if (variant === "medium") {
    return (
      <article
        className="cursor-pointer group flex flex-col h-full"
        onClick={goToArticle}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {hasImage ? (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[hsl(var(--navy-mid))] mb-3 relative shadow-luxe">
            <LazyImage
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--navy-deep))]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="absolute top-2.5 start-2.5 text-[9px] tracking-[0.25em] uppercase font-bold text-[hsl(var(--gold))] bg-[hsl(var(--navy-deep))]/80 backdrop-blur px-2.5 py-1 rounded-full border border-[hsl(var(--gold))]/30">
              {article.category}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-[hsl(var(--gold))]">
              {article.category}
            </span>
            <span className="h-px flex-1 bg-foreground/15" />
          </div>
        )}
        <h3 className="font-display text-[15px] md:text-base text-foreground leading-snug line-clamp-3 group-hover:text-[hsl(var(--gold))] transition-colors flex-1">
          {title}
        </h3>
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-foreground/10">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={10} />
            {timeAgo(article.published_at, language)}
            <span className="opacity-40">•</span>
            <span>{Math.max(1, Math.round(((article.description?.split(/\s+/).length || 60)) / 200))} {isRTL ? "د" : "min"}</span>
          </span>
          <div className="flex items-center gap-2.5">
            <button onClick={handleShare} aria-label="Share" className="text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors">
              <Share2 size={12} />
            </button>
            <button onClick={handleFav} aria-label="Favorite" className="transition-transform active:scale-110">
              <Heart size={12} className={isFav ? "fill-[hsl(var(--crimson))] text-[hsl(var(--crimson))]" : "text-muted-foreground hover:text-[hsl(var(--crimson))] transition-colors"} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // Compact horizontal
  return (
    <article
      className="flex gap-3 cursor-pointer group py-3 border-b border-foreground/8 last:border-b-0"
      dir={isRTL ? "rtl" : "ltr"}
      onClick={goToArticle}
    >
      {hasImage && (
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg overflow-hidden bg-[hsl(var(--navy-mid))] shrink-0 shadow-luxe">
          <LazyImage src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setImgError(true)} />
        </div>
      )}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <span className="text-[9px] tracking-[0.25em] uppercase font-bold text-[hsl(var(--gold))]">{article.category}</span>
          <h3 className="text-foreground font-display text-sm leading-snug line-clamp-3 mt-1 group-hover:text-[hsl(var(--gold))] transition-colors">{title}</h3>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Clock size={10} /> {timeAgo(article.published_at, language)}
          </span>
          <ArrowUpRight size={13} className="text-[hsl(var(--gold))] opacity-0 group-hover:opacity-100 transition-opacity flip-rtl" />
        </div>
      </div>
    </article>
  );
};

export default NewsCard;
