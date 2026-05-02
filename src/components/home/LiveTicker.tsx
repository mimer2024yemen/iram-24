import { Article } from "@/hooks/useArticles";
import { useNavigate } from "react-router-dom";
import { decodeHtmlEntities, timeAgo } from "@/lib/newsUtils";

interface Props {
  articles: Article[];
  language: "AR" | "EN";
  onBeforeNavigate?: () => void;
}

const LiveTicker = ({ articles, language, onBeforeNavigate }: Props) => {
  const navigate = useNavigate();
  if (articles.length === 0) return null;
  const isRTL = language === "AR";

  return (
    <div
      className="bg-[hsl(var(--ink))] text-white"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-screen-xl mx-auto flex items-stretch">
        <div className="bg-primary px-4 py-2.5 flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse-live" />
          <span className="text-[11px] font-black tracking-[0.2em] uppercase">
            {isRTL ? "مباشر" : "LIVE"}
          </span>
        </div>
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-8 px-5 py-2.5 whitespace-nowrap">
            {articles.slice(0, 10).map((a, i) => (
              <button
                key={a.id}
                onClick={() => {
                  onBeforeNavigate?.();
                  navigate(`/article/${a.id}`);
                }}
                className="flex items-center gap-3 group"
              >
                <span className="text-[hsl(var(--gold))] text-[11px] font-bold tracking-wider uppercase shrink-0">
                  {timeAgo(a.published_at, language)}
                </span>
                <span className="text-white text-[13px] font-medium group-hover:text-[hsl(var(--gold))] transition-colors max-w-[320px] truncate">
                  {decodeHtmlEntities(a.title)}
                </span>
                {i < 9 && <span className="text-white/30">·</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTicker;
