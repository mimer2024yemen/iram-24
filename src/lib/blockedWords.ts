import { supabase } from "@/integrations/supabase/client";

// Shared blocked-words cache (5 min TTL)
let cache: string[] = [];
let lastFetch = 0;
const TTL = 5 * 60 * 1000;

export async function getBlockedWords(): Promise<string[]> {
  const now = Date.now();
  if (now - lastFetch < TTL && cache.length > 0) return cache;
  try {
    const query = (supabase as any).from("blocked_words").select("word");
    const timeout = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 900));
    const { data } = await Promise.race([query, timeout]);
    cache = (data || [])
      .map((d: any) => String(d.word || "").toLowerCase().trim().replace(/^#+/, ""))
      .filter(Boolean);
    lastFetch = now;
  } catch {
    /* table may not exist yet */
  }
  return cache;
}

export function invalidateBlockedWordsCache(): void {
  cache = [];
  lastFetch = 0;
}

/**
 * Remove blocked words from text. Arabic + English word-boundary aware.
 */
export function removeBlockedWords(text: string, blocked: string[]): string {
  if (!text || !blocked || blocked.length === 0) return text;
  let result = text;
  for (const bw of blocked) {
    if (!bw) continue;
    const escaped = bw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `(?<![\\w\\u0600-\\u06FF\\u0750-\\u077F])${escaped}(?![\\w\\u0600-\\u06FF\\u0750-\\u077F])`,
      "gi"
    );
    result = result.replace(regex, "");
  }
  // Truncated remnants (e.g. "الكلمة_عا...")
  for (const bw of blocked) {
    if (!bw || bw.length < 4) continue;
    const prefix = bw.slice(0, Math.max(5, Math.floor(bw.length * 0.6)));
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `(?<![\\w\\u0600-\\u06FF\\u0750-\\u077F])${escapedPrefix}[\\w\\u0600-\\u06FF\\u0750-\\u077F_]*(\\.\\.\\.)?[\\s]*$`,
        "gi"
      ),
      ""
    );
  }
  return result
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +([,.،؛!?])/g, "$1")
    .trim();
}

export async function cleanText(text: string): Promise<string> {
  const blocked = await getBlockedWords();
  return removeBlockedWords(text, blocked);
}
