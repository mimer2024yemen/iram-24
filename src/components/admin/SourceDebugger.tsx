import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug, RefreshCw, Search, Loader2, CheckCircle2, AlertTriangle, XCircle, Globe, Rss } from "lucide-react";

interface TestResult {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  code?: number;
  details?: string;
}

interface DebugResult {
  success: boolean;
  tests: Record<string, TestResult>;
  suggestions: string[];
}

interface SourceItem {
  id: string;
  name: string;
  url: string;
  feed_url: string | null;
  fetch_type: string;
  is_active: boolean;
  last_fetch_status: string | null;
  last_fetch: string | null;
}

const SourceDebugger = () => {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [results, setResults] = useState<Record<string, DebugResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [allLoading, setAllLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setFetching(true);
    const { data } = await supabase.from("news_sources").select("id, name, url, feed_url, fetch_type, is_active, last_fetch_status, last_fetch").order("name");
    setSources(data || []);
    setFetching(false);
  };

  const testSource = async (source: SourceItem) => {
    setLoading((p) => ({ ...p, [source.id]: true }));
    try {
      const testUrl = source.feed_url || source.url;
      const { data, error } = await supabase.functions.invoke("debug-source", {
        body: { url: testUrl, fetch_type: source.fetch_type },
      });
      if (error) throw error;
      setResults((p) => ({ ...p, [source.id]: data as DebugResult }));
    } catch (err: any) {
      setResults((p) => ({
        ...p,
        [source.id]: {
          success: false,
          tests: {
            connection: { name: "فحص الاتصال", status: "fail", message: `خطأ: ${err.message}` },
          },
          suggestions: ["تحقق من اتصال الإنترنت أو أعد المحاولة"],
        },
      }));
    }
    setLoading((p) => ({ ...p, [source.id]: false }));
  };

  const testAllSources = async () => {
    setAllLoading(true);
    for (const source of sources) {
      await testSource(source);
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 600));
    }
    setAllLoading(false);
  };

  const getOverallStatus = (result?: DebugResult) => {
    if (!result) return "unknown";
    const statuses = Object.values(result.tests).map((t) => t.status);
    if (statuses.includes("fail")) return "fail";
    if (statuses.includes("warning")) return "warning";
    return "pass";
  };

  const statusIcon = (status: string) => {
    if (status === "pass") return <CheckCircle2 className="text-green-500" size={16} />;
    if (status === "warning") return <AlertTriangle className="text-orange-500" size={16} />;
    if (status === "fail") return <XCircle className="text-red-500" size={16} />;
    return null;
  };

  const statusBorder = (status: string) => {
    if (status === "pass") return "border-r-4 border-r-green-500";
    if (status === "warning") return "border-r-4 border-r-orange-500";
    if (status === "fail") return "border-r-4 border-r-red-500";
    return "";
  };

  // Stats
  const testedCount = Object.keys(results).length;
  const passCount = Object.values(results).filter((r) => getOverallStatus(r) === "pass").length;
  const warnCount = Object.values(results).filter((r) => getOverallStatus(r) === "warning").length;
  const failCount = Object.values(results).filter((r) => getOverallStatus(r) === "fail").length;

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
        <span className="mr-2 text-muted-foreground">جاري تحميل المصادر...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bug className="text-primary" size={20} />
          <h2 className="text-foreground font-bold text-lg">مصحح المصادر</h2>
          <span className="text-xs text-muted-foreground">({sources.length} مصدر)</span>
        </div>
        <Button onClick={testAllSources} disabled={allLoading} size="sm">
          {allLoading ? <Loader2 className="animate-spin ml-1" size={14} /> : <Search size={14} className="ml-1" />}
          فحص جميع المصادر
        </Button>
      </div>

      {/* Stats */}
      {testedCount > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{passCount}</div>
            <div className="text-xs text-green-700">سليم</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{warnCount}</div>
            <div className="text-xs text-orange-700">تحذير</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{failCount}</div>
            <div className="text-xs text-red-700">فاشل</div>
          </div>
        </div>
      )}

      {/* Source cards */}
      <div className="grid gap-3">
        {sources.map((source) => {
          const result = results[source.id];
          const overall = getOverallStatus(result);
          const isLoading = loading[source.id];

          return (
            <Card key={source.id} className={`${result ? statusBorder(overall) : ""}`}>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {source.fetch_type === "rss" ? <Rss size={14} className="text-muted-foreground flex-shrink-0" /> : <Globe size={14} className="text-muted-foreground flex-shrink-0" />}
                    <CardTitle className="text-sm truncate">{source.name}</CardTitle>
                    {!source.is_active && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">معطل</span>
                    )}
                    {source.last_fetch_status === "failed" && (
                      <span className="text-[10px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded">failed</span>
                    )}
                    {result && statusIcon(overall)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => testSource(source)} disabled={isLoading} className="flex-shrink-0 text-xs h-7 px-2">
                    {isLoading ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                    <span className="mr-1">اختبار</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate mt-1" dir="ltr">
                  {source.feed_url || source.url}
                </p>
              </CardHeader>

              {result && (
                <CardContent className="p-3 pt-0 space-y-2">
                  {/* Test results */}
                  {Object.entries(result.tests).map(([key, test]) => (
                    <div
                      key={key}
                      className={`p-2 rounded text-xs ${
                        test.status === "pass"
                          ? "bg-green-500/5 border border-green-500/20"
                          : test.status === "warning"
                          ? "bg-orange-500/5 border border-orange-500/20"
                          : "bg-red-500/5 border border-red-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {statusIcon(test.status)}
                        {test.name}
                      </div>
                      <p className="text-muted-foreground mt-0.5">{test.message}</p>
                    </div>
                  ))}

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2">
                      <p className="text-xs font-bold text-orange-700 mb-1">💡 الحلول المقترحة:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                        {result.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              )}

              {!result && !isLoading && (
                <CardContent className="p-3 pt-0">
                  <p className="text-xs text-muted-foreground text-center py-2">اضغط "اختبار" لفحص هذا المصدر</p>
                </CardContent>
              )}

              {isLoading && !result && (
                <CardContent className="p-3 pt-0">
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="animate-spin text-primary" size={16} />
                    <span className="text-xs text-muted-foreground">جاري الفحص...</span>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SourceDebugger;
