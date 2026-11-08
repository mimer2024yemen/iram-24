import { describe, it, expect } from "vitest";

process.env.SEO_NO_MAIN = "1";
// @ts-expect-error plain JS module
const seo = await import("../../scripts/generate-seo.mjs");
// @ts-expect-error plain JS module
const sync = await import("../../scripts/fetch-news/supabaseSync.mjs");

const now = new Date("2026-11-03T12:00:00Z");
const mk = (i: number, hoursAgo: number) => ({
  id: `id-${i}`, title: `خبر ${i}`, url: `https://ex.com/${i}`, language: "AR",
  published_at: new Date(now.getTime() - hoursAgo * 3600e3).toISOString(),
});

describe("SEO files", () => {
  it("RSS contains exactly 50 items", () => {
    const list = Array.from({ length: 80 }, (_, i) => mk(i, i));
    expect((seo.buildRss(list, now).match(/<item>/g) || []).length).toBe(50);
  });
  it("news sitemap only includes the last 48 hours", () => {
    const list = [mk(1, 1), mk(2, 47), mk(3, 49), mk(4, 200)];
    expect(seo.recentForNews(list, now).map((a: { id: string }) => a.id)).toEqual(["id-1", "id-2"]);
  });
  it("sitemap lists real article URLs", () => {
    expect(seo.buildSitemap([mk(7, 1)], now)).toContain("https://iram24.web.app/article/id-7");
  });
});

describe("database sync", () => {
  it("uses the same duplicate key as the backend fetcher", () => {
    expect(sync.articleHash("A b", "http://Ex.com/x/?utm_source=z")).toBe(sync.articleHash("a  b", "https://ex.com/x"));
  });
  it("treats a re-published link with an edited headline as the same story", () => {
    expect(sync.storyKey("https://www.bbc.co.uk/news/articles/ck79?at_medium=RSS&amp%3Bat_campaign=rss"))
      .toBe(sync.storyKey("https://www.bbc.co.uk/news/articles/ck79"));
    expect(sync.storyKey("https://x.com/a?id=5&at_medium=RSS")).toBe("https://x.com/a?id=5");
  });
  it("derives a stable UUID-shaped id from the fingerprint", () => {
    const id = sync.idFromFingerprint("0123456789abcdef");
    expect(id).toBe(sync.idFromFingerprint("0123456789abcdef"));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]00-000000000024$/);
  });
});
