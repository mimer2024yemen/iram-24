// Independent news pipeline config.
// After connecting the project to GitHub (Plus menu → GitHub → Connect project),
// set CDN_REPO to "owner/repo" of the connected repository. The GitHub Action
// will commit news JSON to /data in that same repo and jsDelivr serves it for free.
//
// Leave as empty string to disable CDN and keep using Supabase + RSS fallback.

export const CDN_REPO = (import.meta.env.VITE_CDN_REPO as string | undefined) || "";
export const CDN_BRANCH = (import.meta.env.VITE_CDN_BRANCH as string | undefined) || "main";

export function cdnUrl(path: string): string | null {
  if (!CDN_REPO) return null;
  // jsDelivr serves any public GitHub repo with automatic gzip + global CDN.
  return `https://cdn.jsdelivr.net/gh/${CDN_REPO}@${CDN_BRANCH}/${path.replace(/^\/+/, "")}`;
}
