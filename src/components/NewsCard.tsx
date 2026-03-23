import { Heart, Share2 } from "lucide-react";
import { Article } from "@/hooks/useArticles";
import { timeAgo, toggleFavorite, getFavorites, decodeHtmlEntities } from "@/lib/newsUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const showImage = article.image_url && !imgError;
  const title = decodeHtmlEntities(article.title);
  const desc = article.description ? decodeHtmlEntities(article.description) : null;

  return (
    <div
      className="border-b border-border pb-4 cursor-pointer"
      dir={language === "AR" ? "rtl" : "ltr"}
      onClick={() => navigate(`/article/${article.id}`)}
    >
      <div className={`grid ${showImage ? "grid-cols-[1fr_100px]" : "grid-cols-1"} gap-3`}>
        <div className="flex flex-col justify-between min-h-[80px]">
          <div>
            {article.author_name && (
              <div className="flex items-center gap-1.5 mb-1">
                {article.author_image_url && (
                  <img src={article.author_image_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                <span className="text-muted-foreground text-[10px]">{article.author_name}</span>
              </div>
            )}
            <h3 className="text-foreground font-bold text-[15px] leading-snug line-clamp-2 mb-1">
              {title}
            </h3>
            {desc && (
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                {desc}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary font-medium">{article.category}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{timeAgo(article.published_at, language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors">
                <Share2 size={14} />
              </button>
              <button onClick={handleFav} className="transition-transform active:scale-110">
                <Heart size={14} className={isFav ? "fill-primary text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>
        {showImage && (
          <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-secondary shrink-0">
            <img
              src={article.image_url!}
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
