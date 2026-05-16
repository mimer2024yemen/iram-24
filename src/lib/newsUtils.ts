export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

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

export const AR_CATEGORIES = ["الرئيسية", "محلي", "عربي", "دولي", "سياسة", "اقتصاد", "رياضة", "تكنولوجيا", "صحة", "فنون", "منوعات"];
export const EN_CATEGORIES = ["Home", "World", "Politics", "Economy", "Sports", "Technology", "Health", "Arts", "Lifestyle"];

function count(text: string, pattern: RegExp): number {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

export function categorizeArticle(title: string, description: string | null, language: "AR" | "EN"): string {
  const t = `${title} ${description || ""}`.toLowerCase();
  if (language === "AR") {
    const sports = count(t, /كرة|مباراة|مباريات|دوري|بطولة|كأس|منتخب|نادي|هدف|أهداف|مدرب|لاعب|الهلال|النصر|الاتحاد|الأهلي|برشلونة|ريال مدريد|تشيلسي|ليفربول|مانشستر|رونالدو|ميسي|الانتقالات|الفيفا|أولمبي|أولمبياد|رماية|سباق|رالي|تنس|سلة|طائرة|ملاكمة|جودو|كاراتيه|سباحة|جمباز|مونديال|كأس العالم|ألعاب الخليج|الجولة|الموسم|رياض/g);
    const econ = count(t, /اقتصاد|اقتصادي|مالي|البورصة|بورصة|أسهم|سهم|نفط|دولار|يورو|ذهب|الأسعار|تضخم|البنك|بنوك|استثمار|تجارة|صفقة|السوق|الأسواق|عجز|ميزانية|الناتج|اكتتاب|سبيس إكس|أرامكو|الفائدة|عملة|عملات|مصرف/g);
    const tech = count(t, /تكنولوج|تقني|تقنية|ذكاء اصطناعي|روبوت|هاتف|جوال|آيفون|سامسونغ|أبل|جوجل|مايكروسوفت|ميتا|إنترنت|تطبيق|برمج|chatgpt|openai|كهربائية|تسلا|سيليكون|فضاء|قمر صناعي|إيلون ماسك/g);
    const health = count(t, /صحة|طبي|الطب|مرض|أمراض|علاج|دواء|أدوية|فيروس|لقاح|مستشفى|أطباء|وباء|جائحة|كوفيد|كورونا|سرطان|سكري|قلب|دماغ|تغذية|سمنة|أنفلونزا/g);
    const arts = count(t, /فيلم|أفلام|سينما|مسرح|موسيق|أغنية|أغاني|مغني|مغنية|ممثل|ممثلة|مهرجان|مهرجانات|كان|البندقية|أوسكار|دراما|مسلسل|مسلسلات|فنان|فنانة|ثقاف|كتاب|رواية|معرض/g);
    const pol = count(t, /انتخاب|برلمان|الكنيست|الكونغرس|قمة|دبلوماس|سفير|سفارة|عقوبات|ترمب|بايدن|بوتين|الناتو|الأمم المتحدة|عسكر|الجيش|قصف|غارة|صاروخ|مسيرة|اغتيال|حماس|حزب الله|الحوثي|غزة|الضفة|الجولان|إسرائيل|إيران|الحرب|هدنة|تفاوض|مفاوضات|وزير|رئيس الوزراء/g);
    const local = count(t, /اليمن|يمني|يمنية|صنعاء|عدن|مأرب|تعز|حضرموت|إب|ذمار|عمران|البيضاء|سقطرى|الحديدة|المهرة|حجة|شبوة|الجوف|أبين|لحج|الضالع|ريمة|الحوثي/g);
    const arab = count(t, /سعود|السعودية|الرياض|الإمارات|أبوظبي|دبي|مصر|القاهرة|الكويت|قطر|الدوحة|البحرين|عُمان|لبنان|بيروت|سوري|دمشق|عراق|بغداد|أردن|فلسطين|المغرب|الجزائر|تونس|ليبيا|السودان|الخرطوم|موريتانيا/g);
    const world = count(t, /أوروب|أميرك|أمريك|واشنطن|روسي|موسكو|الصين|بكين|اليابان|طوكيو|الهند|كوريا|بريطان|لندن|فرنسا|باريس|ألمانيا|برلين|إسبانيا|إيطاليا|تركيا|أنقرة|أوكرانيا|كييف|تايوان|أفريقيا|أستراليا|كندا|البرازيل/g);

    if (sports >= 1 && sports >= Math.max(econ, tech, health, arts)) return "رياضة";
    if (econ >= 1 && econ >= Math.max(tech, health, arts)) return "اقتصاد";
    if (tech >= 1 && tech >= Math.max(health, arts)) return "تكنولوجيا";
    if (health >= 1 && health >= arts) return "صحة";
    if (arts >= 1) return "فنون";
    if (pol >= 1) return local >= 2 ? "محلي" : "سياسة";
    if (local >= 1 && local >= arab && local >= world) return "محلي";
    if (world >= 1 && world > arab) return "دولي";
    if (arab >= 1) return "عربي";
    if (world >= 1) return "دولي";
    return "منوعات";
  } else {
    const sports = count(t, /football|soccer|basketball|tennis|formula|fifa|uefa|championship|match|goal|club|coach|player|transfer|premier league|la liga|serie a|nba|nfl|mlb|olympic|cricket|rugby|golf|boxing|mma/g);
    const econ = count(t, /economy|economic|finance|market|stocks?|oil|gold|trade|inflation|gdp|recession|bank|investment|ipo|crypto|bitcoin|currency|dollar|euro/g);
    const tech = count(t, /\btech\b|\bai\b|artificial intelligence|software|app\b|internet|cyber|digital|robot|iphone|samsung|google|microsoft|meta|tesla|spacex|chatgpt|openai|startup|silicon|smartphone/g);
    const health = count(t, /health|medic|disease|vaccine|treatment|hospital|cancer|diabetes|covid|virus|pandemic|nutrition/g);
    const arts = count(t, /cinema|theater|theatre|music|culture|festival|oscar|cannes|movie|film|album|concert|museum|netflix|hbo/g);
    const pol = count(t, /politic|government|president|election|parliament|congress|senate|trump|biden|putin|nato|sanctions|war|military|missile|israel|iran|gaza|ukraine|russia/g);
    const world = count(t, /europe|america|washington|china|beijing|japan|tokyo|india|korea|britain|london|france|paris|germany|berlin|spain|italy|turkey|africa|australia|canada|brazil/g);

    if (sports >= 1 && sports >= Math.max(econ, tech, health, arts)) return "Sports";
    if (econ >= 1 && econ >= Math.max(tech, health, arts)) return "Economy";
    if (tech >= 1 && tech >= Math.max(health, arts)) return "Technology";
    if (health >= 1 && health >= arts) return "Health";
    if (arts >= 1) return "Arts";
    if (pol >= 1) return "Politics";
    if (world >= 1) return "World";
    return "Lifestyle";
  }
}
