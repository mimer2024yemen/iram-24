// Triggers the GitHub Action workflow "fetch-news.yml" via workflow_dispatch.
// Called by the admin "Fetch Now" button. Requires two secrets:
//   GITHUB_DISPATCH_TOKEN — fine-grained PAT with Actions: read/write on the repo
//   GITHUB_REPO           — "owner/repo" of the connected GitHub repository

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO");
  if (!token || !repo) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO. Add them via Backend → Secrets.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/fetch-news.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ ok: false, status: res.status, error: text }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
