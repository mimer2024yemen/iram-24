/**
 * Normalize image URLs - fix Twitter/X images, decode entities
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;
  url = url.replace(/&amp;/g, "&");

  // Twitter/X: always get original quality
  if (url.includes("pbs.twimg.com")) {
    url = url.replace(/name=\w+/, "name=orig");
    if (!url.includes("name=")) {
      url += (url.includes("?") ? "&" : "?") + "name=orig";
    }
  }

  return url;
}

/**
 * Extract images from HTML content
 */
export function extractImages(html: string): string[] {
  if (!html) return [];
  const imgs = Array.from(
    html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
  ).map(m => normalizeImageUrl(m[1]));
  return [...new Set(imgs)];
}

/**
 * Extract video URLs from HTML content
 */
export function extractVideos(html: string): string[] {
  if (!html) return [];
  const videos: string[] = [];

  // <video src="...">
  const videoSrc = html.matchAll(/<video[^>]+src=["']([^"']+)["']/gi);
  for (const m of videoSrc) videos.push(m[1]);

  // <source src="..."> inside video
  const sourceSrc = html.matchAll(/<source[^>]+src=["']([^"']+\.(?:mp4|webm|mov|m3u8)[^"']*)["']/gi);
  for (const m of sourceSrc) videos.push(m[1]);

  // iframe embeds (YouTube, etc.)
  const iframes = html.matchAll(/<iframe[^>]+src=["']([^"']*(?:youtube|vimeo|dailymotion)[^"']*)["']/gi);
  for (const m of iframes) videos.push(m[1]);

  return [...new Set(videos)];
}

/**
 * Parse raw HTML/RSS content into structured data
 */
export function parseContentToStructured(raw: string | null): {
  text: string[];
  images: string[];
  videos: string[];
} {
  if (!raw) return { text: [], images: [], videos: [] };

  let content = raw;
  content = content.replace(/&amp;/g, "&");

  const images = extractImages(content);
  const videos = extractVideos(content);

  // Strip media and HTML tags for text
  content = content
    .replace(/<img[^>]*>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const text = content.split("\n").filter(line => line.trim().length > 0);

  return { text, images, videos };
}

/**
 * Clean article content for display - remove URLs, "read more" markers
 */
export function cleanDisplayContent(raw: string | null): string {
  if (!raw) return "";
  let text = raw;
  text = text.replace(/https?:\/\/[^\s]+/g, "");
  text = text.replace(/(read more|اقرأ أيضا|المزيد|اقرأ المزيد|إقرأ أيضاً).*/gi, "");
  return text.trim();
}
