// Long-term free-tier performance: cache home feed in edge memory for 60s,
// serve with strong Cache-Control so browsers/CDN reuse responses.
// Even if the DB briefly times out, the last good payload is served.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const COLS =
  "id,title,description,url,image_url,category,language,published_at,views,source_id,created_at,author_name,author_image_url,is_manual";

interface CacheEntry { data: unknown; ts: number; }
const cache = new Map<string, CacheEntry>();
const FRESH_TTL = 60_000;        // serve directly from cache for 60s
const STALE_TTL = 30 * 60_000;   // serve stale up to 30 min if DB is failing

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const language = (url.searchParams.get("lang") || "AR").toUpperCase();
  const category = url.searchParams.get("category") || "";
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "60", 10), 1), 120);
  const key = `${language}|${category}|${limit}`;
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.ts < FRESH_TTL) {
    return await json(cached.data, true);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    let q = supabase
      .from("articles")
      .select(COLS)
      .eq("language", language)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (category && category !== "الرئيسية" && category !== "Home") {
      q = q.eq("category", category);
    }

    // 8s timeout
    const timer = new Promise<null>((r) => setTimeout(() => r(null), 8000));
    const result = await Promise.race([q, timer]);
    if (!result || (result as any).error || !(result as any).data) {
      throw new Error("db_unavailable");
    }
    const data = (result as any).data;
    cache.set(key, { data, ts: now });
    return await json(data, false);
  } catch (_err) {
    // Fall back to stale cache if we still have it
    if (cached && now - cached.ts < STALE_TTL) {
      return await json(cached.data, true, true);
    }
    return new Response(JSON.stringify({ error: "unavailable", articles: [] }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function json(articles: unknown, cached: boolean, stale = false) {
  const body = JSON.stringify({ articles, cached, stale });
  // Try gzip if available in runtime
  try {
    // @ts-ignore
    if (typeof CompressionStream !== "undefined") {
      const stream = new Response(body).body!.pipeThrough(new CompressionStream("gzip"));
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
          "Vary": "Accept-Encoding",
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }
  } catch (_) { /* fall through */ }
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
