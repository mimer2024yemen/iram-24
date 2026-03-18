import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Eye, Users, TrendingUp } from "lucide-react";

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState({
    totalViews: 0,
    todayViews: 0,
    totalArticles: 0,
    topArticles: [] as { title: string; views: number }[],
  });

  useEffect(() => {
    const fetch = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [viewsRes, todayRes, articlesRes, topRes] = await Promise.all([
        supabase.from("page_views").select("id", { count: "exact", head: true }),
        supabase.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("title, views").order("views", { ascending: false }).limit(10),
      ]);

      setStats({
        totalViews: viewsRes.count || 0,
        todayViews: todayRes.count || 0,
        totalArticles: articlesRes.count || 0,
        topArticles: (topRes.data || []).map((a) => ({ title: a.title, views: a.views || 0 })),
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "إجمالي المشاهدات", value: stats.totalViews, icon: Eye, color: "text-primary" },
    { label: "مشاهدات اليوم", value: stats.todayViews, icon: TrendingUp, color: "text-green-400" },
    { label: "إجمالي المقالات", value: stats.totalArticles, icon: BarChart3, color: "text-gold" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-foreground font-bold">الإحصائيات</h2>

      <div className="grid grid-cols-3 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-secondary rounded-lg p-3 text-center">
            <Icon size={20} className={`mx-auto mb-1 ${color}`} />
            <p className="text-foreground text-lg font-bold">{value}</p>
            <p className="text-muted-foreground text-[10px]">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-secondary rounded-lg p-4">
        <h3 className="text-foreground text-sm font-medium mb-3">الأكثر مشاهدة</h3>
        <div className="space-y-2">
          {stats.topArticles.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-4">لا توجد بيانات بعد</p>
          ) : (
            stats.topArticles.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate flex-1">{i + 1}. {a.title}</span>
                <span className="text-muted-foreground shrink-0 mr-2">{a.views} مشاهدة</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
