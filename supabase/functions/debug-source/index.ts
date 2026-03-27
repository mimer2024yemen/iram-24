import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, fetch_type } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tests: Record<string, any> = {};
    const suggestions: string[] = [];
    let body = "";

    // 1. HTTP connectivity test
    const startTime = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const status = res.status;

      tests.http = {
        name: "فحص رابط المصدر",
        status: status >= 200 && status < 400 ? "pass" : "fail",
        code: status,
        message:
          status >= 200 && status < 400
            ? `✓ الرابط يعمل (HTTP ${status})`
            : `✗ الرابط لا يعمل (HTTP ${status})`,
      };

      if (status === 404) suggestions.push("🔗 الرابط غير موجود (404) - يرجى تحديث رابط المصدر");
      else if (status === 403) suggestions.push("🚫 تم حظر الوصول (403) - جرب إضافة User-Agent مختلف أو استخدم proxy");
      else if (status === 429) suggestions.push("⏱️ تجاوز عدد الطلبات (429) - أضف تأخيرًا بين عمليات الجلب");
      else if (status >= 500) suggestions.push("💥 خطأ في الخادم (" + status + ") - المشكلة من جانب المصدر");

      // Speed test
      tests.speed = {
        name: "سرعة الاستجابة",
        status: parseFloat(elapsed) < 5 ? "pass" : parseFloat(elapsed) < 10 ? "warning" : "fail",
        message: `وقت الاستجابة: ${elapsed} ثانية`,
      };
      if (parseFloat(elapsed) > 10) {
        suggestions.push(`🐌 المصدر بطيء جدًا (${elapsed} ثانية) - قد يسبب timeout`);
      }

      if (status >= 200 && status < 400) {
        body = await res.text();
        const contentType = res.headers.get("content-type") || "";

        // 2. Encoding test
        const isUtf8 = contentType.toLowerCase().includes("utf-8") || body.includes('encoding="UTF-8"') || body.includes('charset="utf-8"');
        const hasGarbled = /Ã|Â|Ø|â€/.test(body.substring(0, 500));
        tests.encoding = {
          name: "فحص ترميز النص",
          status: hasGarbled ? "warning" : "pass",
          message: isUtf8 ? "الترميز: UTF-8 ✓" : hasGarbled ? "⚠️ يوجد نص مشوش - مشكلة ترميز محتملة" : "الترميز يبدو سليمًا",
        };
        if (hasGarbled) suggestions.push("📝 يوجد نص مشوش - تحقق من تحويل الترميز إلى UTF-8");

        // 3. Type-specific tests
        const type = fetch_type || "rss";
        if (type === "rss") {
          const isXml = body.trim().startsWith("<?xml") || body.includes("<rss") || body.includes("<feed") || body.includes("<channel");
          if (isXml) {
            const itemMatches = body.match(/<item[\s>]/gi) || body.match(/<entry[\s>]/gi) || [];
            const itemCount = itemMatches.length;
            tests.rss = {
              name: "فحص صحة RSS",
              status: itemCount > 0 ? "pass" : "warning",
              message: itemCount > 0 ? `✓ RSS صحيح، يحتوي على ${itemCount} مقال` : "⚠️ RSS صحيح لكن لا يحتوي على مقالات",
            };
            if (itemCount === 0) suggestions.push("📰 رابط RSS لا يحتوي على مقالات - قد يكون المصدر أوقف الخدمة");

            // Check for titles and links
            const hasTitle = /<title>/.test(body);
            const hasLink = /<link>/.test(body) || /<link\s/.test(body);
            if (!hasTitle) suggestions.push("🏷️ RSS لا يحتوي على عناوين (title)");
            if (!hasLink) suggestions.push("🔗 RSS لا يحتوي على روابط (link)");
          } else {
            tests.rss = {
              name: "فحص صحة RSS",
              status: "fail",
              message: "✗ المحتوى ليس XML/RSS صالحًا",
            };
            suggestions.push("❌ الرابط لا يعيد محتوى RSS - ابحث عن رابط RSS صحيح للموقع");
            // Check if it's actually HTML
            if (body.includes("<html") || body.includes("<!DOCTYPE")) {
              suggestions.push("💡 الرابط يعيد صفحة HTML وليس RSS - جرب إضافة /feed أو /rss.xml للرابط");
            }
          }
        } else {
          // HTML scraping check
          const hasArticleElements = /article|post|news|story|entry/i.test(body);
          const hasArabicContent = /[\u0600-\u06FF]{10,}/.test(body);
          tests.html = {
            name: "فحص محتوى HTML",
            status: hasArticleElements ? "pass" : "warning",
            message: hasArticleElements
              ? "✓ تم العثور على عناصر مقالات محتملة"
              : "⚠️ لم يتم العثور على عناصر مقالات واضحة",
          };
          if (hasArabicContent) {
            tests.arabic = {
              name: "فحص المحتوى العربي",
              status: "pass",
              message: "✓ يحتوي على محتوى عربي",
            };
          }
          if (!hasArticleElements) {
            suggestions.push("🔍 تأكد من تحديث محددات CSS المستخدمة لاستخراج المقالات");
          }
        }
      }
    } catch (fetchErr: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const msg = fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError"
        ? "انتهت مهلة الاتصال (timeout)"
        : fetchErr.message || "خطأ غير معروف";

      tests.http = {
        name: "فحص الاتصال",
        status: "fail",
        code: 0,
        message: `✗ فشل الاتصال: ${msg}`,
      };
      tests.speed = {
        name: "سرعة الاستجابة",
        status: "fail",
        message: `وقت المحاولة: ${elapsed} ثانية`,
      };

      if (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError") {
        suggestions.push("⏱️ المصدر لا يستجيب خلال 15 ثانية - قد يكون الموقع معطلاً");
      } else if (msg.includes("dns") || msg.includes("resolve")) {
        suggestions.push("🌐 فشل تحليل اسم النطاق (DNS) - تحقق من صحة الرابط");
      } else if (msg.includes("ssl") || msg.includes("certificate") || msg.includes("tls")) {
        suggestions.push("🔒 مشكلة في شهادة SSL - الموقع قد يكون غير آمن");
      } else {
        suggestions.push("🌐 فشل الاتصال بالمصدر - تحقق من صحة الرابط");
      }
    }

    return new Response(
      JSON.stringify({ success: true, tests, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
