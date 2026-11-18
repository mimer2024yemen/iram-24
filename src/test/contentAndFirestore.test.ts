import { describe, it, expect } from "vitest";
import { cleanText, cleanParagraphs } from "../../scripts/fetch-news/contentCleaning.mjs";
import { syncFirestore } from "../../scripts/fetch-news/firestoreSync.mjs";

describe("publisher cleaning", () => {
  it("decodes numeric entities and removes invisible symbols", () => {
    expect(cleanText("خبر&#160;جديد&#x200B; &#8220;اليوم&#8221;")).toBe('خبر جديد “اليوم”');
  });
  it("removes side news, ads and duplicate paragraphs without losing reporting", () => {
    const report = "أعلنت الحكومة اليوم عن خطة اقتصادية جديدة تشمل تطوير البنية التحتية.";
    expect(cleanParagraphs([report, "أخبار ذات صلة: تفاصيل مباراة المنتخب اليوم", "إعلان: اشترك للحصول على العرض الخاص", report, "جميع الحقوق محفوظة لهذا الموقع الإخباري"])).toEqual([report]);
  });
});

describe("Firebase preservation", () => {
  it("stores all 401 new articles rather than silently limiting them to 400", async () => {
    let created = 0;
    const db = { collection: () => ({ doc: (id: string) => ({ id }) }), batch: () => ({ create: () => { created++; }, commit: async () => {} }) };
    const result = await syncFirestore("AR", Array.from({ length: 401 }, (_, i) => ({ fingerprint: `new-${i}`, text: ["النص الكامل"] })), db);
    expect(result.written).toBe(401); expect(created).toBe(401);
  });
  it("does not conceal permission errors during duplicate recovery", async () => {
    const db = { collection: () => ({ doc: () => ({ create: async () => { throw { code: 7 }; } }) }), batch: () => ({ create: () => {}, commit: async () => { throw { code: 6 }; } }) };
    await expect(syncFirestore("AR", [{ fingerprint: "existing" }], db)).rejects.toEqual({ code: 7 });
  });
});