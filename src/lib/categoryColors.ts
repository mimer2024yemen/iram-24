// Category → gradient + icon. Used as a premium placeholder when an article
// has no image, instead of an empty frame.

export interface CategoryStyle {
  gradient: string;   // tailwind-compatible inline background
  emoji: string;      // small emblem
  accent: string;     // hsl color for chip border
}

const STYLES: Record<string, CategoryStyle> = {
  // Arabic
  "محلي":      { gradient: "linear-gradient(135deg,hsl(220 50% 18%),hsl(220 60% 10%))", emoji: "🇾🇪", accent: "38 70% 55%" },
  "عربي":      { gradient: "linear-gradient(135deg,hsl(170 55% 22%),hsl(195 65% 14%))", emoji: "🕌", accent: "170 60% 50%" },
  "دولي":      { gradient: "linear-gradient(135deg,hsl(210 55% 25%),hsl(225 60% 12%))", emoji: "🌍", accent: "210 70% 60%" },
  "سياسة":     { gradient: "linear-gradient(135deg,hsl(0 55% 28%),hsl(0 70% 14%))",     emoji: "🏛️", accent: "0 75% 55%" },
  "اقتصاد":    { gradient: "linear-gradient(135deg,hsl(38 75% 30%),hsl(28 80% 14%))",   emoji: "📈", accent: "38 90% 55%" },
  "رياضة":     { gradient: "linear-gradient(135deg,hsl(140 55% 25%),hsl(150 65% 12%))", emoji: "⚽", accent: "140 65% 50%" },
  "تكنولوجيا": { gradient: "linear-gradient(135deg,hsl(260 55% 28%),hsl(280 65% 14%))", emoji: "💻", accent: "270 70% 65%" },
  "صحة":       { gradient: "linear-gradient(135deg,hsl(190 60% 26%),hsl(200 70% 12%))", emoji: "🩺", accent: "190 75% 55%" },
  "فنون":      { gradient: "linear-gradient(135deg,hsl(320 55% 28%),hsl(340 65% 14%))", emoji: "🎨", accent: "320 75% 60%" },
  "ثقافة":     { gradient: "linear-gradient(135deg,hsl(290 50% 25%),hsl(310 60% 12%))", emoji: "📚", accent: "290 65% 60%" },

  // English
  "World":      { gradient: "linear-gradient(135deg,hsl(210 55% 25%),hsl(225 60% 12%))", emoji: "🌍", accent: "210 70% 60%" },
  "Politics":   { gradient: "linear-gradient(135deg,hsl(0 55% 28%),hsl(0 70% 14%))",     emoji: "🏛️", accent: "0 75% 55%" },
  "Economy":    { gradient: "linear-gradient(135deg,hsl(38 75% 30%),hsl(28 80% 14%))",   emoji: "📈", accent: "38 90% 55%" },
  "Sports":     { gradient: "linear-gradient(135deg,hsl(140 55% 25%),hsl(150 65% 12%))", emoji: "⚽", accent: "140 65% 50%" },
  "Technology": { gradient: "linear-gradient(135deg,hsl(260 55% 28%),hsl(280 65% 14%))", emoji: "💻", accent: "270 70% 65%" },
  "Health":     { gradient: "linear-gradient(135deg,hsl(190 60% 26%),hsl(200 70% 12%))", emoji: "🩺", accent: "190 75% 55%" },
  "Arts":       { gradient: "linear-gradient(135deg,hsl(320 55% 28%),hsl(340 65% 14%))", emoji: "🎨", accent: "320 75% 60%" },
};

const DEFAULT: CategoryStyle = {
  gradient: "linear-gradient(135deg,hsl(220 45% 18%),hsl(220 50% 8%))",
  emoji: "📰",
  accent: "38 70% 55%",
};

export function categoryStyle(category: string | null | undefined): CategoryStyle {
  if (!category) return DEFAULT;
  return STYLES[category] || DEFAULT;
}
