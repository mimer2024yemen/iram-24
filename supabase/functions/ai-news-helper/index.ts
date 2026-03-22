import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "No text provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a news editor AI assistant. Analyze the provided news text and return a JSON object with:
- betterTitle: an improved, engaging title in the same language as the text
- category: best category from [محلي, عربي, دولي, اقتصاد, رياضة, تكنولوجيا, صحة, فنون, مقالات, World, Economy, Sports, Technology, Health, Arts, Articles]
- hashtags: array of 3-5 relevant hashtags (without # symbol)
- summary: a brief 2-3 sentence summary

Respond ONLY with valid JSON, no markdown.`
          },
          { role: "user", content: text }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_news",
            description: "Analyze news text and return structured suggestions",
            parameters: {
              type: "object",
              properties: {
                betterTitle: { type: "string" },
                category: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                summary: { type: "string" }
              },
              required: ["betterTitle", "category", "hashtags", "summary"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_news" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback: try parsing content as JSON
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("AI helper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
