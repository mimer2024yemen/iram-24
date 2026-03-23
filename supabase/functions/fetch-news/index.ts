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

function parseRSSXML(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
  content: string | null;
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

    const title = getTag("title").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code)));
    const link = getTag("link");
    const rawDesc = getTag("description");
    const description = rawDesc.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code))).substring(0, 500);
    const pubDate = getTag("pubDate");

    // Get full content from content:encoded
    const contentEncoded = getTag("content:encoded");
    const cleanContent = contentEncoded
      ? contentEncoded.replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<aside[\s\S]*?<\/aside>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : null;

    // Image extraction
    let imageUrl: string | null = null;
    const enclosureMatch = c.match(/url="([^"]*\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
    if (enclosureMatch) imageUrl = enclosureMatch[1];
    if (!imageUrl) {
      const mediaMatch = c.match(/<media:content[^>]*url="([^"]*)"/i);
      if (mediaMatch) imageUrl = mediaMatch[1];
    }
    if (!imageUrl) {
      const mediaThumbnail = c.match(/<media:thumbnail[^>]*url="([^"]*)"/i);
      if (mediaThumbnail) imageUrl = mediaThumbnail[1];
    }
    if (!imageUrl) {
      const imgMatch = rawDesc.match(/<img[^>]*src="([^"]*)"/i);
      if (imgMatch) imageUrl = imgMatch[1];
    }
    if (!imageUrl && contentEncoded) {
      const imgMatch = contentEncoded.match(/<img[^>]*src="([^"]*)"/i);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    if (title && link) {
      items.push({ title, link, description, pubDate, imageUrl, content: cleanContent });
    }
  }
  return items;
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
    if (/sport|football|soccer|basketball|olympic|championship/.test(text)) return "Sports";
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

    // Check if specific source_id was provided
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

    for (const source of sources) {
      try {
        const res = await fetch(source.url, { headers: { "User-Agent": "EramNews/1.0" } });
        if (!res.ok) {
          await supabase.from("news_sources").update({ last_fetch_status: "failed", last_fetch: new Date().toISOString() }).eq("id", source.id);
          continue;
        }

        const xml = await res.text();
        const items = parseRSSXML(xml);
        let sourceInserted = 0;

        for (const item of items) {
          const hash = hashString(item.title + item.link);
          const category = categorize(item.title, item.description, source.language);

          const { error } = await supabase.from("articles").insert({
            source_id: source.id,
            title: item.title,
            description: item.description || null,
            content: item.content || null,
            url: item.link,
            image_url: item.imageUrl,
            category,
            language: source.language,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            hash,
          });

          if (!error) sourceInserted++;
        }

        await supabase.from("news_sources").update({
          last_fetch: new Date().toISOString(),
          last_fetch_status: "success",
          article_count: (source.article_count || 0) + sourceInserted,
        }).eq("id", source.id);

        totalInserted += sourceInserted;
      } catch (e) {
        console.error(`Error fetching ${source.name}:`, e);
        await supabase.from("news_sources").update({ last_fetch_status: "failed", last_fetch: new Date().toISOString() }).eq("id", source.id);
      }
    }

    // Update fetch settings
    await supabase.from("fetch_settings").update({
      last_fetch_time: new Date().toISOString(),
      last_fetch_count: totalInserted,
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    return new Response(JSON.stringify({ count: totalInserted, message: `Fetched ${totalInserted} new articles` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
