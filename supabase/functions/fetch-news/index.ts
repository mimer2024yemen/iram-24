import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function decodeEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(url: string): string {
  if (!url) return url;
  url = url.replace(/&amp;/g, "&");
  if (url.includes("pbs.twimg.com")) {
    url = url.replace(/name=\w+/, "name=orig");
    if (!url.includes("name=")) url += (url.includes("?") ? "&" : "?") + "name=orig";
  }
  return url;
}

function extractVideoUrl(html: string): string | null {
  if (!html) return null;
  const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i)
    || html.match(/<source[^>]+src=["']([^"']*\.(?:mp4|webm|mov|m3u8)[^"']*)["']/i);
  return videoMatch ? videoMatch[1] : null;
}

function parseRSSItems(xml: string): Array<{
  title: string; link: string; description: string; pubDate: string; imageUrl: string | null; content: string | null; videoUrl: string | null;
}> {
  const items: any[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const c = match[1];
    const getTag = (tag: string) => {
      const m = c.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? (m[1] || m[2] || "").trim() : "";
    };
    const title = decodeEntities(getTag("title"));
    const link = getTag("link");
    const rawDesc = getTag("description");
    const description = decodeEntities(stripHtml(rawDesc)).substring(0, 500);
    const pubDate = getTag("pubDate");
    const contentEncoded = getTag("content:encoded");
    const content = contentEncoded ? decodeEntities(stripHtml(contentEncoded)) : null;

    let imageUrl: string | null = null;
    const enclosureMatch = c.match(/url="([^"]*\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
    if (enclosureMatch) imageUrl = normalizeImageUrl(enclosureMatch[1]);
    if (!imageUrl) {
      const mediaMatch = c.match(/<media:content[^>]*url="([^"]*)"/i);
      if (mediaMatch) imageUrl = normalizeImageUrl(mediaMatch[1]);
    }
    if (!imageUrl) {
      const mediaThumbnail = c.match(/<media:thumbnail[^>]*url="([^"]*)"/i);
      if (mediaThumbnail) imageUrl = normalizeImageUrl(mediaThumbnail[1]);
    }
    if (!imageUrl) {
      const imgMatch = rawDesc.match(/<img[^>]*src="([^"]*)"/i);
      if (imgMatch) imageUrl = normalizeImageUrl(imgMatch[1]);
    }
    if (!imageUrl && contentEncoded) {
      const imgMatch = contentEncoded.match(/<img[^>]*src="([^"]*)"/i);
      if (imgMatch) imageUrl = normalizeImageUrl(imgMatch[1]);
    }

    // Extract video from content
    const videoUrl = extractVideoUrl(rawDesc) || extractVideoUrl(contentEncoded) || null;

    if (title && link) {
      items.push({ title, link, description, pubDate, imageUrl, content, videoUrl });
    }
  }
  return items;
}

function parseAtomItems(xml: string): Array<{
  title: string; link: string; description: string; pubDate: string; imageUrl: string | null; content: string | null; videoUrl: string | null;
}> {
  const items: any[] = [];
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const c = match[1];
    const getTag = (tag: string) => {
      const m = c.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? (m[1] || m[2] || "").trim() : "";
    };
    const title = decodeEntities(getTag("title"));
    const linkMatch = c.match(/<link[^>]*href="([^"]*)"/i);
    const link = linkMatch ? linkMatch[1] : "";
    const summary = getTag("summary");
    const contentTag = getTag("content");
    const updated = getTag("updated") || getTag("published");
    const description = decodeEntities(stripHtml(summary || contentTag)).substring(0, 500);
    const content = contentTag ? decodeEntities(stripHtml(contentTag)) : null;

    let imageUrl: string | null = null;
    const imgMatch = (contentTag || summary).match(/<img[^>]*src="([^"]*)"/i);
    if (imgMatch) imageUrl = normalizeImageUrl(imgMatch[1]);

    const videoUrl = extractVideoUrl(contentTag) || extractVideoUrl(summary) || null;

    if (title && link) {
      items.push({ title, link, description, pubDate: updated, imageUrl, content, videoUrl });
    }
  }
  return items;
}

function parseFeed(xml: string) {
  const isAtom = /<feed[\s>]/i.test(xml);
  if (isAtom) return parseAtomItems(xml);
  return parseRSSItems(xml);
}

async function tryWordPressAPI(baseUrl: string) {
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=20&_embed`;
  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "EramNews/2.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) return null;

    return posts.map((p: any) => ({
      title: decodeEntities(stripHtml(p.title?.rendered || "")),
      link: p.link || "",
      description: decodeEntities(stripHtml(p.excerpt?.rendered || "")).substring(0, 500),
      content: decodeEntities(stripHtml(p.content?.rendered || "")),
      pubDate: p.date || new Date().toISOString(),
      imageUrl: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    }));
  } catch {
    return null;
  }
}

function categorize(title: string, desc: string, lang: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (lang === "AR") {
    if (/يمن|صنعاء|عدن|مأرب|تعز|حضرموت/.test(text)) return "محلي";
    if (/عرب|سعود|إمارات|مصر|خليج|لبنان|سوري|عراق|أردن/.test(text)) return "عربي";
    if (/سياس|حكوم|رئيس|برلمان|انتخاب|دول/.test(text)) return "دولي";
    if (/اقتصاد|مال|بورصة|نفط|دولار|ريال|ذهب|أسعار/.test(text)) return "اقتصاد";
    if (/رياض|كرة|منتخب|دوري|بطولة|لاعب/.test(text)) return "رياضة";
    if (/تكنولوج|تقن|ذكاء|هاتف|تطبيق|إنترنت/.test(text)) return "تكنولوجيا";
    if (/صح|طب|مرض|علاج|فيروس|لقاح/.test(text)) return "صحة";
    if (/فن|سينما|مسرح|موسيق|ثقاف/.test(text)) return "فنون";
    return "محلي";
  } else {
    if (/politic|government|president|election|parliament|congress|world|global/.test(text)) return "World";
    if (/econom|financ|market|stock|oil|gold|trade|inflation/.test(text)) return "Economy";
    if (/sport|football|soccer|basketball|olympic|championship|player/.test(text)) return "Sports";
    if (/tech|ai|artificial|software|app|internet|cyber|digital/.test(text)) return "Technology";
    if (/health|medic|disease|vaccine|treatment|hospital/.test(text)) return "Health";
    if (/art|cinema|theater|music|culture|entertain/.test(text)) return "Arts";
    return "World";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const targetSourceId = body?.source_id;

    let query = supabase.from("news_sources").select("*").eq("is_active", true);
    if (targetSourceId) query = supabase.from("news_sources").select("*").eq("id", targetSourceId);

    const { data: sources } = await query;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "No active sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    const logs: string[] = [];

    for (const source of sources) {
      try {
        let items: any[] = [];
        let method = "RSS";

        // Method 1: Try RSS/Atom feed
        try {
          const res = await fetch(source.url, {
            headers: { "User-Agent": "EramNews/2.0" },
            signal: AbortSignal.timeout(15000),
          });
          if (res.ok) {
            const text = await res.text();
            if (/<rss|<feed|<channel/i.test(text)) {
              items = parseFeed(text);
              method = /<feed[\s>]/i.test(text) ? "Atom" : "RSS";
            }
          }
        } catch (e) {
          console.log(`RSS failed for ${source.name}: ${e}`);
        }

        // Method 2: Fallback to WordPress API
        if (items.length === 0) {
          try {
            const baseUrl = new URL(source.url).origin;
            const wpItems = await tryWordPressAPI(baseUrl);
            if (wpItems && wpItems.length > 0) {
              items = wpItems;
              method = "WordPress API";
            }
          } catch (e) {
            console.log(`WP API failed for ${source.name}: ${e}`);
          }
        }

        if (items.length === 0) {
          logs.push(`${source.name}: No articles found (tried RSS, Atom, WP API)`);
          await supabase.from("news_sources").update({
            last_fetch_status: "failed",
            last_fetch: new Date().toISOString(),
          }).eq("id", source.id);
          continue;
        }

        // Limit to last 30 articles
        items = items.slice(0, 30);
        let sourceInserted = 0;

        for (const item of items) {
          const hash = hashString(item.title + item.link);
          
          // Check for existing article with same title (dedup by title)
          const { data: existing } = await supabase.from("articles")
            .select("id").eq("title", item.title).limit(1);
          if (existing && existing.length > 0) continue;
          
          const category = source.category && source.category !== "none"
            ? source.category
            : categorize(item.title, item.description, source.language);

          // Try to fetch og:image if no image found
          let finalImage = item.imageUrl;
          if (!finalImage && item.link) {
            try {
              const pageRes = await fetch(item.link, {
                headers: { "User-Agent": "EramNews/2.0" },
                signal: AbortSignal.timeout(8000),
              });
              if (pageRes.ok) {
                const html = await pageRes.text();
                const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                  || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                if (ogMatch) finalImage = normalizeImageUrl(ogMatch[1]);
              }
            } catch { /* skip */ }
          }

          if (finalImage) finalImage = normalizeImageUrl(finalImage);

          const { error } = await supabase.from("articles").upsert({
            source_id: source.id,
            title: item.title,
            description: item.description || null,
            content: item.content || null,
            url: item.link,
            image_url: finalImage,
            video_url: item.videoUrl || null,
            category,
            language: source.language,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            hash,
          }, { onConflict: "hash" });

          if (!error) sourceInserted++;
        }

        logs.push(`${source.name}: ${sourceInserted} articles via ${method}`);

        await supabase.from("news_sources").update({
          last_fetch: new Date().toISOString(),
          last_fetch_status: "success",
          article_count: (source.article_count || 0) + sourceInserted,
        }).eq("id", source.id);

        totalInserted += sourceInserted;
      } catch (e: any) {
        console.error(`Error fetching ${source.name}:`, e);
        logs.push(`${source.name}: ERROR - ${e.message}`);
        await supabase.from("news_sources").update({
          last_fetch_status: "failed",
          last_fetch: new Date().toISOString(),
        }).eq("id", source.id);
      }
    }

    await supabase.from("fetch_settings").update({
      last_fetch_time: new Date().toISOString(),
      last_fetch_count: totalInserted,
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("Fetch complete:", logs.join(" | "));

    return new Response(JSON.stringify({
      count: totalInserted,
      message: `Fetched ${totalInserted} new articles`,
      logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Fetch error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
