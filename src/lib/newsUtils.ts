export function getSessionId(): string {
  let id = localStorage.getItem("eram_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("eram_session_id", id);
  }
  return id;
}

export function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem("eram_favorites") || "[]");
  } catch { return []; }
}

export function toggleFavorite(articleId: string): string[] {
  const favs = getFavorites();
  const idx = favs.indexOf(articleId);
  if (idx > -1) favs.splice(idx, 1);
  else favs.push(articleId);
  localStorage.setItem("eram_favorites", JSON.stringify(favs));
  return [...favs];
}

export function timeAgo(dateStr: string | null, lang: "AR" | "EN" = "AR"): string {
  if (!dateStr) return lang === "AR" ? "غير معروف" : "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "AR" ? "الآن" : "Just now";
  if (mins < 60) return lang === "AR" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === "AR" ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === "AR" ? `منذ ${days} يوم` : `${days}d ago`;
}

export const AR_CATEGORIES = ["الرئيسية", "أخبار اليمن", "سياسة", "اقتصاد", "رياضة", "تكنولوجيا", "صحة"];
export const EN_CATEGORIES = ["Home", "World", "Politics", "Economy", "Sports", "Technology", "Health"];

export function categorizeArticle(title: string, description: string | null, language: "AR" | "EN"): string {
  const text = `${title} ${description || ""}`.toLowerCase();
  
  if (language === "AR") {
    if (/يمن|صنعاء|عدن|مأرب|تعز/.test(text)) return "أخبار اليمن";
    if (/سياس|حكوم|رئيس|برلمان|انتخاب/.test(text)) return "سياسة";
    if (/اقتصاد|مال|بورصة|نفط|دولار|ريال|ذهب|أسعار/.test(text)) return "اقتصاد";
    if (/رياض|كرة|منتخب|دوري|بطولة|لاعب/.test(text)) return "رياضة";
    if (/تكنولوج|تقن|ذكاء|هاتف|تطبيق|إنترنت/.test(text)) return "تكنولوجيا";
    if (/صح|طب|مرض|علاج|فيروس|لقاح/.test(text)) return "صحة";
    return "أخبار اليمن";
  } else {
    if (/politic|government|president|election|parliament|congress/.test(text)) return "Politics";
    if (/econom|financ|market|stock|oil|gold|trade|inflation/.test(text)) return "Economy";
    if (/sport|football|soccer|basketball|olympic|championship|player/.test(text)) return "Sports";
    if (/tech|ai|artificial|software|app|internet|cyber|digital/.test(text)) return "Technology";
    if (/health|medic|disease|vaccine|treatment|hospital/.test(text)) return "Health";
    return "World";
  }
}
