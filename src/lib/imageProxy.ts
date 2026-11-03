/**
 * Proxies image URLs through our edge function to bypass
 * hotlink protection, CORS blocks, and missing Referer headers.
 */

import { edgeUrl } from "@/config/backend";

const PROXY_BASE = edgeUrl("image-proxy");

/** Domains known to block direct hotlinking */
const BLOCKED_DOMAINS = [
  "26sep.net",
  "sahafah24.net",
  "sahafa.net",
  "almasdaronline.com",
  "adenalghad.net",
  "almashhadalaraby.com",
  "yemenipress.net",
  "newsyemen.net",
  "pbs.twimg.com",
];

function needsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

export function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (PROXY_BASE && needsProxy(url)) {
    return `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
  }
  return url;
}
