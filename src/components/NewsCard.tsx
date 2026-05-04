import { Heart, Share2 } from "lucide-react";
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

const NewsCard = ({ article, language, variant = "compact", onBeforeNavigate }: NewsCardProps) => {
  const [favs, setFavs] = useState(getFavorites());
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();
  const isFav = favs.includes(article.id);

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
    const text = `${decodeHtmlEntities(article.title)} - إيرام24\n${url}`;
    if (navigator.share) {
      await navigator.share({ title: decodeHtmlEntities(article.title), text, url });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const rawImgUrl = article.image_url?.trim() || "";
  const imgSrc = rawImgUrl ? proxyImageUrl(normalizeImageUrl(rawImgUrl)) : "";
  const hasImage = !!(rawImgUrl && !imgError);
  const title = decodeHtmlEntities(article.title);
  const desc = article.description ? decodeHtmlEntities(article.description) : null;

  // Featured card
  if (variant === "featured") {
    return (
      <div className="relative rounded-xl overflow-hidden cursor-pointer group bg-card shadow-lg" onClick={goToArticle} dir={language === "AR" ? "rtl" : "ltr"}>
        {hasImage ? (
          <div className="aspect-[2/1] w-full overflow-hidden">
            <LazyImage src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="eager" onError={() => setImgError(true)} />
          </div>
        ) : (
          <div className="aspect-[2/1] w-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
            <span className="text-3xl opacity-30">📰</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
          <span className="inline-block bg-primary text-primary-foreground text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5">{article.category}</span>
          <h2 className="text-foreground text-sm md:text-lg font-bold leading-tight line-clamp-2 mb-1">{title}</h2>
          <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-foreground/60">
            <span>{timeAgo(article.published_at, language)}</span>
            {article.author_name && <><span>•</span><span>{article.author_name}</span></>}
          </div>
        </div>
      </div>
    );
  }

  // Medium card — Editorial style
  if (variant === "medium") {
    return (
      <div
        className="cursor-pointer group flex flex-col h-full"
        onClick={goToArticle}
        dir={language === "AR" ? "rtl" : "ltr"}
      >
        {hasImage && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-foreground/5 mb-2">
            <LazyImage
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-primary">
          {article.category}
        </span>
        <h3 className="font-display text-sm md:text-base text-foreground leading-tight line-clamp-3 mt-1 group-hover:text-primary transition-colors flex-1">
          {title}
        </h3>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-foreground/10">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {timeAgo(article.published_at, language)}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors">
              <Share2 size={11} />
            </button>
            <button onClick={handleFav} className="transition-transform active:scale-110">
              <Heart size={11} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact card
  return (
    <div className="flex gap-3 cursor-pointer group py-3 border-b border-border last:border-b-0" dir={language === "AR" ? "rtl" : "ltr"} onClick={goToArticle}>
      {hasImage && (
        <div className="w-24 h-20 md:w-28 md:h-[76px] rounded-lg overflow-hidden bg-secondary shrink-0">
          <LazyImage src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={() => setImgError(true)} />
        </div>
      )}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-primary text-[10px] font-bold">{article.category}</span>
            <span className="text-muted-foreground text-[10px]">•</span>
            <span className="text-muted-foreground text-[10px]">{timeAgo(article.published_at, language)}</span>
          </div>
          <h3 className="text-foreground font-bold text-[13px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">{title}</h3>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {article.author_name ? <span className="text-muted-foreground text-[10px] truncate max-w-[50%]">{article.author_name}</span> : <span />}
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors"><Share2 size={12} /></button>
            <button onClick={handleFav} className="transition-transform active:scale-110"><Heart size={12} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
