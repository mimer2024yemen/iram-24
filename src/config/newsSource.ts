// Independent news pipeline config.
// The GitHub Action (.github/workflows/fetch-news.yml) commits news + market JSON
// to /data in the linked public repository. The site reads it directly, so news
// keeps flowing even when the main backend is paused.
//
// Set VITE_CDN_REPO to "owner/repo" of the linked GitHub repository.

export const CDN_REPO = (import.meta.env.VITE_CDN_REPO as string | undefined) || "mimer2024yemen/iram-24";
export const CDN_BRANCH = (import.meta.env.VITE_CDN_BRANCH as string | undefined) || "main";

/** Candidate URLs for a data file, freshest first. */
export function cdnUrls(path: string): string[] {
  if (!CDN_REPO) return [];
  const clean = path.replace(/^\/+/, "");
  return [
    // raw.githubusercontent: ~5 min cache, CORS enabled
    `https://raw.githubusercontent.com/${CDN_REPO}/${CDN_BRANCH}/${clean}`,
    // jsDelivr: global CDN, longer cache — used only as a backup
    `https://cdn.jsdelivr.net/gh/${CDN_REPO}@${CDN_BRANCH}/${clean}`,
  ];
}

export function cdnUrl(path: string): string | null {
  return cdnUrls(path)[0] || null;
}
