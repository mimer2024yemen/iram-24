import { Heart, Share2 } from "lucide-react";
import { Article } from "@/hooks/useArticles";
import { timeAgo, toggleFavorite, getFavorites } from "@/lib/newsUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface NewsCardProps {
  article: Article;
  language: "AR" | "EN";
}

const NewsCard = ({ article, language }: NewsCardProps) => {
  const [favs, setFavs] = useState(getFavorites());
  const navigate = useNavigate();
  const isFav = favs.includes(article.id);

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(toggleFavorite(article.id));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/article/${article.id}`;
    const text = `${article.title} - إيرام24\n${url}`;
    if (navigator.share) {
      await navigator.share({ title: article.title, text, url });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div
      className="border-b border-border pb-4 cursor-pointer"
      dir={language === "AR" ? "rtl" : "ltr"}
      onClick={() => navigate(`/article/${article.id}`)}
    >
      <div className={`grid ${article.image_url ? "grid-cols-[1fr_100px]" : "grid-cols-1"} gap-3`}>
        <div className="flex flex-col justify-between min-h-[100px]">
          <div>
            <h3 className="text-foreground font-bold text-[15px] leading-snug line-clamp-2 mb-1">
              {article.title}
            </h3>
            {article.description && (
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                {article.description}
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
        {article.image_url && (
          <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-secondary shrink-0">
            <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsCard;
