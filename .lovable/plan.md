# نظام جلب وتخزين أخبار مستقل (مجاني، بلا اختناقات)

## الفكرة المعمارية

نُخرج طبقة الجلب/التخزين خارج Lovable Cloud بالكامل، ونستخدمها فقط للإدارة (قائمة المصادر، مقالات يدوية، مستخدمين). النظام الجديد يعتمد على **GitHub Actions + مستودع Git (JSON فهرس) + jsDelivr CDN** — مجاني، غير محدود عمليًا، ومتوفّر 24/7.

```text
Sources (Supabase)           GitHub Actions (cron 5 min)
        │                             │
        │ pulls source list           │ fetch RSS/Atom/Sitemap/HTML
        ▼                             ▼
                            parse + classify + dedupe
                                      │
                                      ▼
              commit JSON shards to repo (data/AR/*.json, data/EN/*.json)
                                      │
                                      ▼
                  jsDelivr CDN (cdn.jsdelivr.net/gh/<user>/<repo>)
                                      │
                                      ▼
                    Front-end reads CDN JSON → عرض فوري
```

## المكوّنات

### 1. مستودع بيانات مستقل
- ريبو GitHub منفصل مخصّص للبيانات (مثلاً `iram24-news-data`).
- بنية: `data/index.json`, `data/AR/latest.json`, `data/AR/pages/1.json` … `data/AR/by-cat/<cat>.json` (نفس الشيء للـ EN).
- كل ملف ≤ ~1MB مضغوط عبر CDN gzip — يخزّن حتى 500 خبر/شارد.
- يحتفظ بأرشيف أسبوعي (`data/archive/2026-W30.json`) بلا سقف عملي.

### 2. GitHub Action (المُشغّل الأساسي)
- ملف `.github/workflows/fetch-news.yml` في نفس ريبو المشروع (أو ريبو البيانات).
- `schedule: cron: "*/5 * * * *"` + `workflow_dispatch` (Fetch Now يدوي من الأدمن).
- الخطوات:
  1. تنزيل قائمة المصادر النشطة من Supabase (REST + service key كسر خارجي — سرّ GitHub Secret).
  2. تشغيل سكربت Node/TS يوازي جلب كل المصادر (RSS/Atom → Sitemap → HTML).
  3. Retry (3 محاولات، backoff)، Timeout 8s لكل مصدر، User-Agent واقعي.
  4. تحليل + تصنيف عبر `classifier.ts` المشترك.
  5. Dedupe عبر بصمة (URL canonical + hash عنوان مطبع).
  6. دمج مع الشارد الحالي، فرز، اقتطاع لأحدث N، تحديث الأرشيف.
  7. `git commit` + `git push` عبر `GITHUB_TOKEN` (بدون أي تكلفة).
- سجلّ الأخطاء يُكتب إلى `data/errors/latest.json` ويُعرض في الأدمن.

### 3. الواجهة الأمامية
- `useArticles` يقرأ أولًا من `https://cdn.jsdelivr.net/gh/<user>/<repo>@main/data/AR/latest.json` (SWR + `localStorage`).
- يسقط تلقائيًا إلى Supabase `home-feed` كخطة B، ثم RSS المباشر كخطة C (النظام الحالي).
- نتيجة: ظهور فوري حتى على الإنترنت البطيء (CDN عالمي + ملف صغير مضغوط).

### 4. لوحة الإدارة (متصلة بالنظام الفعلي)
- تبويب **الجلب**:
  - زر "Fetch Now" → يستدعي `workflow_dispatch` عبر GitHub API (سرّ `GITHUB_DISPATCH_TOKEN`).
  - عرض آخر تشغيل، عدد المقالات الجديدة، آخر خطأ (يُقرأ من `data/status.json`).
- تبويب **المصادر**: يبقى في Supabase، لكن يُضاف حقلا `fetch_interval` و `is_active` و `last_error`، يقرأهما GitHub Action.
- تبويب **مقال يدوي**: يبقى في Supabase كما هو.

### 5. إصلاح المشاكل الحالية
- إيقاف الاعتماد على cron داخل Lovable Cloud (غير موثوق على الخطة المجانية).
- تنظيف `fetch-news` edge function وجعله ⟵ يستقبل مقالات من GitHub Action ويُخزّن نسخة مضغوطة فقط للمقالات اليدوية/الأدمن.
- Fingerprint موحّد يمنع أي تكرار عبر كل المصادر.

## القسم التقني (تفاصيل التنفيذ)

**ملفات جديدة:**
- `.github/workflows/fetch-news.yml` — cron كل 5 دقائق + dispatch يدوي.
- `scripts/fetch-news/index.ts` — سكربت Node 20، zero deps خارجية عدا `fast-xml-parser`, `node-fetch` (built-in fetch في 20).
- `scripts/fetch-news/parsers/{rss,atom,sitemap,html}.ts`.
- `scripts/fetch-news/store.ts` — إدارة الشاردات JSON + الأرشيف.
- `src/lib/cdnFeed.ts` — قارئ الواجهة من jsDelivr مع SWR.

**تعديلات:**
- `src/hooks/useArticles.ts` — أولوية للـ CDN، ثم Supabase.
- `src/components/admin/FetchControl.tsx` — زر يستدعي `workflow_dispatch` ويعرض `status.json`.
- `supabase/config.toml` — إزالة الاعتماد على أي cron داخلي للـ fetch-news.

**أسرار مطلوبة (سنطلبها بعد اعتماد الخطة):**
- `GITHUB_DISPATCH_TOKEN` (fine-grained PAT، صلاحية Actions: read/write على ريبو البيانات) — يُخزّن كـ Supabase secret لاستخدامه من الواجهة عبر edge function صغيرة `trigger-fetch`.
- في GitHub Secrets للريبو: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (لقراءة قائمة المصادر فقط).

**اختبار القبول:**
1. تشغيل يدوي للـ Action → التحقق من ظهور `data/AR/latest.json` في CDN خلال 60 ثانية.
2. فتح الموقع على شبكة بطيئة (throttled 3G) — الأخبار تظهر تحت 1.5s.
3. جولتان متتاليتان → لا تكرار في `latest.json`.
4. حذف مصدر من الأدمن → لا تعود مقالاته في الجولة التالية.
5. سقوط GitHub → الموقع يسقط تلقائيًا إلى Supabase ثم RSS.

## ما أحتاج منك قبل التنفيذ

1. تأكيد الخطة أو تعديلها.
2. اسم ريبو GitHub الذي تريد وضع البيانات فيه (يمكن إنشاء ريبو عام جديد باسم مثل `iram24-news-data`، أو استخدام نفس ريبو المشروع في مجلد `data/`).
3. بعد الموافقة سأطلب إنشاء `GITHUB_DISPATCH_TOKEN` وتخزينه كسرّ.
