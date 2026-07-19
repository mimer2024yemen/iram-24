import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BAD_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|\[?::1\]?)/i;

const escapeHtml = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const decodeEntities = (s: string) =>
  (s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)));

const sanitizeText = (html: string) => decodeEntities(
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
);

const absolutize = (value: string, base: string) => {
  try { return new URL(value, base).toString(); } catch { return value; }
};

function extractReader(html: string, fallbackTitle: string, baseUrl: string, lang: string) {
  const title = decodeEntities(
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || fallbackTitle
  ).trim();
  const imageRaw = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<img[^>]+src=["']([^"']+)/i)?.[1]
    || "";
  const image = imageRaw ? absolutize(decodeEntities(imageRaw), baseUrl) : "";
  const articleChunk = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || html;
  const paragraphs = sanitizeText(articleChunk)
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 80)
    .slice(0, 24);
  return readerHtml({ title, image, paragraphs, sourceUrl: baseUrl, lang });
}

function readerHtml({ title, image, paragraphs, sourceUrl, lang, proxyBase }: { title: string; image: string; paragraphs: string[]; sourceUrl: string; lang: string; proxyBase: string }) {
  const isAr = lang !== "EN";
  const safeTitle = escapeHtml(title || (isAr ? "قراءة الخبر" : "Article reader"));
  const body = paragraphs.length
    ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")
    : `<p>${isAr ? "تعذّر عرض صفحة المصدر كاملة، لكن لم يغادر المستخدم التطبيق. يمكنك متابعة الخبر من النص المتاح في إيرام 24." : "The full source page could not be rendered, but you stayed inside the app."}</p>`;
  const safeSource = `${proxyBase}?url=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(title)}&lang=${encodeURIComponent(lang)}`;
  return `<!doctype html><html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base target="_self"><title>${safeTitle}</title>
<style>
:root{color-scheme:dark;background:#07101f;color:#f8f2e8}*{box-sizing:border-box}body{margin:0;font-family:Tajawal,system-ui,-apple-system,sans-serif;background:#07101f;color:#f8f2e8;line-height:1.95}.wrap{max-width:820px;margin:auto;padding:28px 18px 64px}.kicker{color:#d7ad49;font-size:11px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}h1{font-size:clamp(28px,5vw,48px);line-height:1.18;margin:10px 0 22px}.hero{width:100%;max-height:460px;object-fit:cover;border-radius:12px;margin:0 0 24px;box-shadow:0 30px 70px rgba(0,0,0,.45)}p{font-size:19px;margin:0 0 22px}.source{display:inline-block;margin-top:18px;color:#d7ad49;text-decoration:none;border:1px solid rgba(215,173,73,.32);border-radius:999px;padding:10px 16px;font-size:12px;font-weight:800}</style>
</head><body><main class="wrap"><div class="kicker">${isAr ? "وضع القراءة" : "Reader mode"}</div><h1>${safeTitle}</h1>${image ? `<img class="hero" src="${escapeHtml(image)}" alt="${safeTitle}" loading="eager">` : ""}<article>${body}</article><a class="source" href="${escapeHtml(safeSource)}">${isAr ? "عرض المصدر عبر القارئ" : "Open via reader"}</a></main></body></html>`;
}

function proxiedHtml(html: string, baseUrl: string, proxyBase: string, title: string, lang: string) {
  let out = html
    .replace(/<meta[^>]+http-equiv=["'](?:content-security-policy|x-frame-options)["'][^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\s(?:integrity|nonce)=["'][^"']*["']/gi, "")
    .replace(/<base[^>]*>/gi, "")
    .replace(/\s(target)=["'][^"']*["']/gi, "");
  out = out.replace(/\s(href|src|action)=(["'])(?!data:|mailto:|tel:|javascript:|#)([^"']+)\2/gi, (_m, attr, q, val) => {
    const abs = absolutize(decodeEntities(val), baseUrl);
    if (String(attr).toLowerCase() === "href" && /^https?:\/\//i.test(abs)) {
      return ` ${attr}=${q}${proxyBase}?url=${encodeURIComponent(abs)}&title=${encodeURIComponent(title)}&lang=${encodeURIComponent(lang)}${q}`;
    }
    return ` ${attr}=${q}${abs}${q}`;
  });
  out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeHtml(baseUrl)}" target="_self"><meta name="referrer" content="no-referrer"><style>html,body{max-width:100%;overflow-x:hidden}img,video{max-width:100%;height:auto}</style>`);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestUrl = new URL(req.url);
  const raw = requestUrl.searchParams.get("url") || "";
  const fallbackTitle = requestUrl.searchParams.get("title") || "";
  const lang = requestUrl.searchParams.get("lang") || "AR";
  const proxyBase = `${requestUrl.origin}/functions/v1/source-proxy`;

  try {
    const target = new URL(raw);
    if (!["http:", "https:"].includes(target.protocol) || BAD_HOST.test(target.hostname)) throw new Error("Invalid source URL");
    const res = await fetch(target.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(11000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.9",
        "Referer": `${target.origin}/`,
      },
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const contentType = res.headers.get("content-type") || "text/html";
    const html = await res.text();
    const rendered = contentType.includes("text/html") ? proxiedHtml(html, target.toString(), proxyBase, fallbackTitle, lang) : extractReader(html, fallbackTitle, target.toString(), lang);
    return new Response(rendered, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900" },
    });
  } catch (_e) {
    const html = readerHtml({ title: fallbackTitle, image: "", paragraphs: [], sourceUrl: raw, lang, proxyBase });
    return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
});