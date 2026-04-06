import { useState, useEffect, useMemo } from "react";
import { RadioStation } from "@/data/defaultStations";
import { getStations, saveStations } from "@/lib/radioStorage";
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Save, X, Radio } from "lucide-react";
import { toast } from "sonner";

const emptyStation: Omit<RadioStation, "id"> = {
  name: "", city: "", country: "", stream_url: "", logo: "", category: "", enabled: true,
};

const RadioAdminPanel = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RadioStation | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    setStations(getStations());
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return stations;
    const q = search.toLowerCase();
    return stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  }, [stations, search]);

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.stream_url.trim()) {
      toast.error("الاسم ورابط البث مطلوبان");
      return;
    }
    let updated: RadioStation[];
    if (isNew) {
      updated = [...stations, editing];
    } else {
      updated = stations.map((s) => (s.id === editing.id ? editing : s));
    }
    saveStations(updated);
    setStations(updated);
    setEditing(null);
    toast.success(isNew ? "تمت الإضافة" : "تم التحديث");
  };

  const remove = (id: string) => {
    const updated = stations.filter((s) => s.id !== id);
    saveStations(updated);
    setStations(updated);
    toast.success("تم الحذف");
  };

  const toggleEnabled = (id: string) => {
    const updated = stations.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    saveStations(updated);
    setStations(updated);
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({ ...emptyStation, id: `custom_${Date.now()}` });
  };

  const stats = {
    total: stations.length,
    active: stations.filter((s) => s.enabled).length,
    disabled: stations.filter((s) => !s.enabled).length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-primary">{stats.active}</p>
          <p className="text-[10px] text-muted-foreground">مفعّلة</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-destructive">{stats.disabled}</p>
          <p className="text-[10px] text-muted-foreground">معطّلة</p>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الدولة..."
            className="w-full bg-secondary border border-border rounded-lg pr-9 pl-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button onClick={startNew} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0">
          <Plus size={14} /> إضافة
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Radio size={18} className="text-primary" />
                {isNew ? "إضافة محطة" : "تعديل محطة"}
              </h2>
              <button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button>
            </div>
            {(["name", "stream_url", "city", "country", "category", "logo"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {field === "name" ? "الاسم" : field === "stream_url" ? "رابط البث" : field === "city" ? "المدينة" : field === "country" ? "الدولة" : field === "category" ? "التصنيف" : "الشعار (URL)"}
                </label>
                <input
                  value={(editing as any)[field]}
                  onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  dir={field === "stream_url" || field === "logo" ? "ltr" : "rtl"}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">مفعّلة</label>
              <button onClick={() => setEditing({ ...editing, enabled: !editing.enabled })}>
                {editing.enabled ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-muted-foreground" />}
              </button>
            </div>
            <button onClick={save} className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
              <Save size={14} /> حفظ
            </button>
          </div>
        </div>
      )}

      {/* Stations table */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">{filtered.length} محطة</p>
        {filtered.map((s) => (
          <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.enabled ? "bg-card border-border" : "bg-secondary/50 border-border opacity-60"}`}>
            {s.logo && (
              <img src={s.logo} alt={s.name} className="w-8 h-8 rounded-full object-cover bg-secondary shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.city} · {s.country} · {s.category}</p>
              <p className="text-[10px] text-muted-foreground/60 truncate" dir="ltr">{s.stream_url}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => toggleEnabled(s.id)} className="p-1.5">
                {s.enabled ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              </button>
              <button onClick={() => { setIsNew(false); setEditing(s); }} className="p-1.5">
                <Pencil size={15} className="text-muted-foreground" />
              </button>
              <button onClick={() => remove(s.id)} className="p-1.5">
                <Trash2 size={15} className="text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadioAdminPanel;
