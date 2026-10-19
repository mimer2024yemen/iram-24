export function normalizeSourceUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("أدخل رابط HTTP أو HTTPS صالحاً");
  return url.href;
}

export function sourceInput(name: string, website: string, feed: string, type: string) {
  if (!name.trim()) throw new Error("اسم المصدر مطلوب");
  const website_url = normalizeSourceUrl(website);
  const feed_url = normalizeSourceUrl(feed);
  if (!website_url && !feed_url) throw new Error("أدخل رابط الموقع أو رابط الخلاصة");
  return {
    name: name.trim(), url: feed_url || website_url,
    website_url: website_url || null, feed_url: feed_url || null,
    fetch_type: type,
  };
}