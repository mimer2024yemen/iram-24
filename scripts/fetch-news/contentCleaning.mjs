// Clean publisher furniture before Readability scores the article.
const FURNITURE = /(?:^|[\s_-])(advert(?:isement|ising)?|ads?|sidebar|related(?:-?posts|-?articles)?|recommended|newsletter|social(?:-?share)?|share(?:-?buttons)?|cookie|breadcrumb|outbrain|taboola|read-more|promo|carousel|playlist|stories|story-card)(?:$|[\s_-])/i;
const LABEL = /^(?:اقرأ\s*(?:أيض[اًًا]*|المزيد)|إقرأ\s*أيض[اًًا]*|شاهد\s*أيض[اًًا]*|تابعونا|اشترك|إعلان|اعلان|محتوى إعلاني|مواضيع ذات صلة|أخبار ذات صلة|قد يهمك|الأكثر قراءة|نُ?شر(?:ت)?\s*(?:في|:)|تاريخ النشر|آخر تحديث|مصدر الصورة|التعليق على الصورة|read (?:more|also)|related (?:stories|articles)|recommended|subscribe|sign up|advertisement|image (?:source|caption))(?:\s|:|$)/i;
const LEGAL = /(?:جميع الحقوق محفوظة|ملفات تعريف الارتباط|سياسة الخصوصية|all rights reserved|cookie (?:policy|settings)|accept all cookies|RT STORIES|Save post|#Question_More|اضغط للمزيد)/i;

export function cleanText(value) {
  return String(value || "")
    .replace(/&#(x[\da-f]+|\d+);?/gi, (match, value) => {
      const n = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    })
    .replace(/&(nbsp|amp|quot|apos|lt|gt|hellip|ndash|mdash);/gi, (_, key) => ({nbsp:" ",amp:"&",quot:'"',apos:"'",lt:"<",gt:">",hellip:"…",ndash:"–",mdash:"—"})[key.toLowerCase()])
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uFFFD]/g, "")
    .replace(/\s+/g, " ").trim();
}

export function removeFurniture(document) {
  for (const el of document.querySelectorAll("script, style, nav, aside, footer, form, button, iframe, [role='navigation'], [role='complementary'], [aria-hidden='true']")) el.remove();
  for (const el of document.querySelectorAll("[class], [id]")) {
    if (FURNITURE.test(`${el.getAttribute('id') || ''} ${el.getAttribute('class') || ''}`)) el.remove();
  }
}

export function cleanParagraphs(values, title = "") {
  const seen = new Set([cleanText(title)]);
  return values.map(cleanText).filter(t => {
    if (t.length < 20 || LABEL.test(t) || LEGAL.test(t) || seen.has(t)) return false;
    seen.add(t); return true;
  });
}