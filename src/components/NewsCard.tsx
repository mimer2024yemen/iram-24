import { Heart, Share2 } from "lucide-react";
import { Article } from "@/hooks/useArticles";
import { timeAgo, toggleFavorite, getFavorites, decodeHtmlEntities } from "@/lib/newsUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { proxyImageUrl } from "@/lib/imageProxy";

interface NewsCardProps {
  article: Article;
  language: "AR" | "EN";
}

const NewsCard = ({ article, language }: NewsCardProps) => {
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

  return (
    <div
      className="border-b border-border pb-2.5 cursor-pointer"
      dir={language === "AR" ? "rtl" : "ltr"}
      onClick={() => navigate(`/article/${article.id}`)}
    >
      <div className={`grid ${showImage ? "grid-cols-[1fr_72px]" : "grid-cols-1"} gap-2.5`}>
        <div className="flex flex-col justify-between min-h-[60px]">
          <div>
            {article.author_name && (
              <div className="flex items-center gap-1 mb-0.5">
                {article.author_image_url && (
                  <img src={article.author_image_url} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                )}
                <span className="text-muted-foreground text-[9px]">{article.author_name}</span>
              </div>
            )}
            <h3 className="text-foreground font-bold text-[13px] leading-[1.4] line-clamp-2 mb-0.5">
              {title}
            </h3>
            {desc && (
              <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-1">
                {desc}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-primary font-medium">{article.category}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{timeAgo(article.published_at, language)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors">
                <Share2 size={12} />
              </button>
              <button onClick={handleFav} className="transition-transform active:scale-110">
                <Heart size={12} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>
        {showImage && (
          <div className="w-[72px] h-[72px] rounded-md overflow-hidden bg-secondary shrink-0">
            <img
              src={imgSrc}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsCard;
