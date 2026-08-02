import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, RefreshCw, ExternalLink, Copy, Check, Share2, BookOpen, Loader2, AlertTriangle,
} from "lucide-react";
import LazyImage from "@/components/LazyImage";

type Block = { type: "p" | "h" | "img" | "quote"; text?: string; src?: string; alt?: string };

interface ReaderData {
  ok: boolean;
  url: string;
  siteName?: string;
  favicon?: string;
  title?: string;
  description?: string;
  author?: string;
  published?: string;
  leadImage?: string;
  blocks?: Block[];
  readMinutes?: number;
  degraded?: boolean;
  error?: string;
}

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/read-source`;
const IMG_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy`;
const CACHE_PREFIX = "eram_reader_";
const CACHE_TTL = 1000 * 60 * 30; // 30 min, revalidated in background

const proxied = (src?: string) => (src ? `${IMG_PROXY}?url=${encodeURIComponent(src)}` : "");

function readCache(url: string): ReaderData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < CACHE_TTL * 4 ? d : null;
  } catch { return null; }
}
function writeCache(url: string, d: ReaderData) {
  try { sessionStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ t: Date.now(), d })); } catch { /* quota */ }
}
function isStale(url: string) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return true;
    return Date.now() - JSON.parse(raw).t > CACHE_TTL;
  } catch { return true; }
}

const SourceReader = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const url = params.get("url") || "";
  const lang = params.get("lang") || "AR";
  const isRTL = lang !== "EN";

  const [data, setData] = useState<ReaderData | null>(() => (url ? readCache(url) : null));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [plain, setPlain] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!url) return;
    if (!force && data && !isStale(url)) return;
    if (!data) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const json: ReaderData = await res.json();
      if (!json.ok) throw new Error(json.error || "fetch failed");
      setData(json);
      writeCache(url, json);
    } catch (e) {
      if (!data) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, data]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [url]);

  useEffect(() => {
    if (data?.title) document.title = `${data.title} — ${data.siteName || ""}`.trim();
  }, [data?.title, data?.siteName]);

  const blocks = useMemo(() => data?.blocks ?? [], [data]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
  };
  const handleShare = async () => {
    const payload = { title: data?.title || "", text: data?.title || "", url };
    if (navigator.share) { try { await navigator.share(payload); return; } catch { /* cancelled */ } }
    handleCopy();
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const dateText = data?.published
    ? new Date(data.published).toLocaleDateString(isRTL ? "ar" : "en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 glass-strong border-b border-foreground/10">
        <div className="max-w-screen-md mx-auto px-3 h-14 flex items-center gap-2 overflow-x-hidden">
          <button onClick={() => navigate(-1)} aria-label={isRTL ? "رجوع" : "Back"}
            className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors shrink-0">
            <BackIcon size={16} />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {data?.favicon && (
              <img src={data.favicon} alt="" width={18} height={18} loading="lazy" className="rounded shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{data?.siteName || new URL(url || "https://x.co").hostname}</p>
              {dateText && <p className="text-[10px] text-muted-foreground truncate">{dateText}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setPlain((p) => !p)} title={isRTL ? "وضع القراءة" : "Reader mode"}
              className={`p-2 rounded-full transition-colors ${plain ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]" : "bg-foreground/5 hover:bg-foreground/10"}`}>
              <BookOpen size={15} />
            </button>
            <button onClick={() => load(true)} title={isRTL ? "تحديث" : "Refresh"}
              className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={handleShare} title={isRTL ? "مشاركة" : "Share"}
              className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors">
              <Share2 size={15} />
            </button>
            <button onClick={handleCopy} title={isRTL ? "نسخ الرابط" : "Copy link"}
              className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" title={isRTL ? "فتح المصدر" : "Open source"}
              className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors">
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 py-8 overflow-x-hidden">
        {loading && !data && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-foreground/10 rounded w-3/4" />
            <div className="h-56 bg-foreground/10 rounded-xl" />
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-foreground/10 rounded" />)}
          </div>
        )}

        {error && !data && (
          <div className="text-center py-16 space-y-4">
            <AlertTriangle className="mx-auto text-[hsl(var(--gold))]" size={32} />
            <p className="text-sm text-muted-foreground">
              {isRTL ? "تعذّر استخراج محتوى هذا المصدر." : "Could not extract this source's content."}
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => load(true)} className="px-4 py-2 rounded-full bg-foreground/10 text-xs font-bold">
                {isRTL ? "إعادة المحاولة" : "Retry"}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-full border border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] text-xs font-bold">
                {isRTL ? "فتح الموقع الأصلي" : "Open original"}
              </a>
            </div>
          </div>
        )}

        {data && (
          <article className="space-y-5">
            <h1 className="text-2xl md:text-4xl font-black leading-snug">{data.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              {data.author && <span>{data.author}</span>}
              {data.readMinutes && <span>{data.readMinutes} {isRTL ? "دقيقة قراءة" : "min read"}</span>}
              {loading && <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" />{isRTL ? "تحديث" : "updating"}</span>}
            </div>

            {!plain && data.leadImage && (
              <LazyImage src={proxied(data.leadImage)} alt={data.title || ""} loading="eager"
                className="w-full max-h-[440px] object-cover rounded-xl" />
            )}

            {data.description && !plain && (
              <p className="text-base md:text-lg text-foreground/85 font-medium leading-relaxed border-s-2 border-[hsl(var(--gold))]/60 ps-4">
                {data.description}
              </p>
            )}

            {blocks.map((b, i) => {
              if (b.type === "img") {
                if (plain) return null;
                return (
                  <LazyImage key={i} src={proxied(b.src)} alt={b.alt || ""} loading="lazy"
                    className="w-full rounded-xl object-cover" />
                );
              }
              if (b.type === "h") return <h2 key={i} className="text-xl md:text-2xl font-bold pt-3">{b.text}</h2>;
              if (b.type === "quote") return (
                <blockquote key={i} className="border-s-2 border-[hsl(var(--gold))]/60 ps-4 text-sm text-muted-foreground italic">
                  {b.text}
                </blockquote>
              );
              return <p key={i} className="text-[17px] leading-[1.95] text-foreground/90">{b.text}</p>;
            })}

            {data.degraded && (
              <p className="text-xs text-muted-foreground border-t border-foreground/10 pt-4">
                {isRTL
                  ? "هذا المصدر يقيّد المحتوى؛ عُرض أفضل ملخّص متاح."
                  : "This source restricts its content; the best available summary is shown."}
              </p>
            )}

            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 rounded-full border border-[hsl(var(--gold))]/30 hover:border-[hsl(var(--gold))] text-[hsl(var(--gold))] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em]">
              <ExternalLink size={13} />
              {isRTL ? "عرض الصفحة الأصلية" : "View original page"}
            </a>
          </article>
        )}
      </main>
    </div>
  );
};

export default SourceReader;
