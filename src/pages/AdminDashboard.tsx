import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import SourceManager from "@/components/admin/SourceManager";
import FetchControl from "@/components/admin/FetchControl";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import RssDetector from "@/components/admin/RssDetector";
import ArticleEditor from "@/components/admin/ArticleEditor";
import NewsManager from "@/components/admin/NewsManager";
import AdminAI from "@/components/admin/AdminAI";
import SourceAnalyzer from "@/components/admin/SourceAnalyzer";
import { LogOut, Database, BarChart3, Rss, Search, PenSquare, Newspaper, Sparkles, Radar } from "lucide-react";

const AdminDashboard = () => {
  const { isAdmin, loading, logout } = useAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"analytics" | "news" | "sources" | "fetch" | "detector" | "analyzer" | "editor" | "ai">("analytics");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/admin-dashboard-ERAM-SECURE/login");
  }, [loading, isAdmin, navigate]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!isAdmin) return null;

  const tabs = [
    { id: "analytics" as const, label: "إحصائيات", icon: BarChart3 },
    { id: "news" as const, label: "الأخبار", icon: Newspaper },
    { id: "sources" as const, label: "المصادر", icon: Rss },
    { id: "fetch" as const, label: "الجلب", icon: Database },
    { id: "detector" as const, label: "كاشف", icon: Search },
    { id: "editor" as const, label: "مقال", icon: PenSquare },
    { id: "ai" as const, label: "AI", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-foreground font-bold text-lg">لوحة التحكم</h1>
        <button onClick={logout} className="text-muted-foreground hover:text-primary"><LogOut size={20} /></button>
      </header>

      <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors ${
              tab === id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "analytics" && <AnalyticsDashboard />}
        {tab === "news" && <NewsManager />}
        {tab === "sources" && <SourceManager />}
        {tab === "fetch" && <FetchControl />}
        {tab === "detector" && <RssDetector onAddSource={() => setTab("sources")} />}
        {tab === "editor" && <ArticleEditor />}
        {tab === "ai" && <AdminAI />}
      </div>
    </div>
  );
};

export default AdminDashboard;
