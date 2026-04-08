import { Heart, Share2 } from "lucide-react";
import { Article } from "@/hooks/useArticles";
import { timeAgo, toggleFavorite, getFavorites, decodeHtmlEntities } from "@/lib/newsUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { proxyImageUrl } from "@/lib/imageProxy";

interface NewsCardProps {
  article: Article;
  language: "AR" | "EN";
  variant?: "featured" | "medium" | "compact";
  onBeforeNavigate?: () => void;
}

const NewsCard = ({ article, language, variant = "compact" }: NewsCardProps) => {
  const [favs, setFavs] = useState(getFavorites());
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();
  const isFav = favs.includes(article.id);

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
  const imgSrc = rawImgUrl ? proxyImageUrl(rawImgUrl) : "";
  const showImage = !!(rawImgUrl && !imgError);
  const title = decodeHtmlEntities(article.title);
  const desc = article.description ? decodeHtmlEntities(article.description) : null;

  // Featured card — large hero style
  if (variant === "featured") {
    return (
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer group bg-card shadow-lg"
        onClick={() => navigate(`/article/${article.id}`)}
        dir={language === "AR" ? "rtl" : "ltr"}
      >
        {showImage ? (
          <div className="aspect-[16/9] w-full overflow-hidden">
            <img
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="eager"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <span className="inline-block bg-primary text-primary-foreground text-[10px] md:text-xs font-bold px-2 py-0.5 rounded mb-2">
            {article.category}
          </span>
          <h2 className="text-foreground text-base md:text-xl font-bold leading-tight line-clamp-3 mb-1.5">
            {title}
          </h2>
          {desc && (
            <p className="text-foreground/70 text-xs md:text-sm line-clamp-2 mb-2">{desc}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-foreground/60">
            <span>{timeAgo(article.published_at, language)}</span>
            {article.author_name && (
              <>
                <span>•</span>
                <span>{article.author_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Medium card — grid item with image on top
  if (variant === "medium") {
    return (
      <div
        className="rounded-xl overflow-hidden cursor-pointer group bg-card shadow-md hover:shadow-lg transition-shadow flex flex-col h-full"
        onClick={() => navigate(`/article/${article.id}`)}
        dir={language === "AR" ? "rtl" : "ltr"}
      >
        {showImage ? (
          <div className="aspect-[16/10] w-full overflow-hidden">
            <img
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="aspect-[16/10] w-full bg-secondary" />
        )}
        <div className="p-3 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-primary text-[10px] font-bold">{article.category}</span>
            <span className="text-muted-foreground text-[10px]">{timeAgo(article.published_at, language)}</span>
          </div>
          <h3 className="text-foreground font-bold text-sm leading-snug line-clamp-2 mb-1 flex-1">
            {title}
          </h3>
          {desc && (
            <p className="text-muted-foreground text-xs line-clamp-2 mb-2">{desc}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
            {article.author_name ? (
              <span className="text-muted-foreground text-[10px] truncate max-w-[60%]">{article.author_name}</span>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors">
                <Share2 size={13} />
              </button>
              <button onClick={handleFav} className="transition-transform active:scale-110">
                <Heart size={13} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact card — horizontal row (list item)
  return (
    <div
      className="flex gap-3 cursor-pointer group py-3 border-b border-border last:border-b-0"
      dir={language === "AR" ? "rtl" : "ltr"}
      onClick={() => navigate(`/article/${article.id}`)}
    >
      {showImage && (
        <div className="w-24 h-20 md:w-28 md:h-[76px] rounded-lg overflow-hidden bg-secondary shrink-0">
          <img
            src={imgSrc}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-primary text-[10px] font-bold">{article.category}</span>
            <span className="text-muted-foreground text-[10px]">•</span>
            <span className="text-muted-foreground text-[10px]">{timeAgo(article.published_at, language)}</span>
          </div>
          <h3 className="text-foreground font-bold text-[13px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {article.author_name ? (
            <span className="text-muted-foreground text-[10px] truncate max-w-[50%]">{article.author_name}</span>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors">
              <Share2 size={12} />
            </button>
            <button onClick={handleFav} className="transition-transform active:scale-110">
              <Heart size={12} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
