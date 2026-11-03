import { supabase } from "@/integrations/supabase/client";

/**
 * Server functions exist only on the Lovable Cloud backend. The Firebase build
 * points at a database without them (VITE_EDGE_FUNCTIONS=off), so calls are
 * skipped there instead of failing with CORS errors; news, headlines and
 * market prices then come from the free GitHub data.
 */
export const EDGE_FUNCTIONS_ENABLED = (import.meta.env.VITE_EDGE_FUNCTIONS as string | undefined) !== "off";

export const SITE_URL = "https://iram24.web.app";

export const EDGE_UNAVAILABLE_MESSAGE =
  "هذه الأداة غير متاحة على الخادم الحالي. الجلب التلقائي يعمل عبر GitHub كل 3 دقائق.";

/** Full URL of a server function, or null when functions are off. */
export function edgeUrl(name: string): string | null {
  return EDGE_FUNCTIONS_ENABLED ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}` : null;
}

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

/** Same as supabase.functions.invoke, but returns a clear error when functions are off. */
export async function invokeEdge<T = any>(name: string, options?: InvokeOptions): Promise<{ data: T | null; error: Error | null }> {
  if (!EDGE_FUNCTIONS_ENABLED) return { data: null, error: new Error(EDGE_UNAVAILABLE_MESSAGE) };
  const res = await supabase.functions.invoke(name, options);
  return { data: (res.data as T) ?? null, error: (res.error as Error | null) ?? null };
}

/** Link to share for an article: a preview page with its title and image. */
export function articleShareUrl(id: string): string {
  if (EDGE_FUNCTIONS_ENABLED) {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/article-share?id=${encodeURIComponent(id)}`;
  }
  return `${SITE_URL}/share/${encodeURIComponent(id)}`;
}
