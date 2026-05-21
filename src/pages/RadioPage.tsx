import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RadioStation } from "@/data/defaultStations";
import { getStations, getFavorites, toggleFavorite, getLastPlayed } from "@/lib/radioStorage";
import { useRadioPlayer, PlayerStatus } from "@/hooks/useRadioPlayer";
import { Search, Heart, Radio, Loader2, Pause, Play, AlertCircle, X, Volume2, VolumeX } from "lucide-react";

const RadioPage = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("radio_volume");
    return saved ? parseFloat(saved) : 0.8;
  });
  const [muted, setMuted] = useState(false);
  const { currentId, status, errorMsg, play, stop } = useRadioPlayer();

  // Sync volume to audio element
  useEffect(() => {
    const audio = document.querySelector("audio") as HTMLAudioElement | null;
    if (audio) {
      audio.volume = muted ? 0 : volume;
    }
  }, [volume, muted, currentId, status]);

  useEffect(() => {
    localStorage.setItem("radio_volume", String(volume));
  }, [volume]);

  const loadData = useCallback(() => {
    const all = getStations().filter((s) => s.enabled);
    setStations(all);
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("radio-stations-updated", loadData);
    return () => window.removeEventListener("radio-stations-updated", loadData);
  }, [loadData]);

  const countries = useMemo(() => {
    const set = new Set(stations.map((s) => s.country));
    return ["all", ...Array.from(set).sort()];
  }, [stations]);

  const filtered = useMemo(() => {
    let list = tab === "favorites" ? stations.filter((s) => favorites.has(s.id)) : stations;
    if (selectedCountry !== "all") list = list.filter((s) => s.country === selectedCountry);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const af = favorites.has(a.id) ? 0 : 1;
      const bf = favorites.has(b.id) ? 0 : 1;
      return af - bf;
    });
  }, [stations, favorites, search, tab, selectedCountry]);

  const handleFav = (id: string) => {
    const newFavs = toggleFavorite(id);
    setFavorites(new Set(newFavs));
  };

  const statusIcon = (id: string) => {
    if (currentId !== id) return <Play size={18} className="text-primary" />;
    if (status === "loading") return <Loader2 size={18} className="animate-spin text-primary" />;
    if (status === "playing") return <Pause size={18} className="text-primary" />;
    if (status === "error") return <AlertCircle size={18} className="text-destructive" />;
    return <Play size={18} className="text-primary" />;
  };

  const currentStation = stations.find((s) => s.id === currentId);

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={22} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">راديو عربي</h1>
          {currentId && (
            <button onClick={stop} className="mr-auto text-xs text-muted-foreground flex items-center gap-1 bg-secondary px-2 py-1 rounded-full">
              <X size={12} /> إيقاف
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن محطة..."
            className="w-full bg-secondary border border-border rounded-lg pr-9 pl-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setTab("all")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            جميع المحطات ({stations.length})
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === "favorites" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Heart size={12} /> المفضلة ({favorites.size})
          </button>
        </div>

        {/* Country filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {countries.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCountry(c)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                selectedCountry === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {c === "all" ? "الكل" : c}
            </button>
          ))}
        </div>
      </header>

      {/* Now playing bar with volume */}
      {currentId && currentStation && (
        <div className="sticky top-[200px] z-30 mx-3 mt-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 items-end">
              {status === "playing" && [1, 2, 3].map((i) => (
                <span key={i} className="w-1 bg-primary rounded-full animate-pulse" style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
              ))}
              {status === "loading" && <Loader2 size={16} className="animate-spin text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium truncate">{currentStation.name}</p>
              <p className="text-[10px] text-muted-foreground">{currentStation.city} · {currentStation.country}</p>
            </div>
            <button onClick={stop}>
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(!muted)} className="text-muted-foreground">
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setMuted(false);
              }}
              className="flex-1 h-1.5 bg-secondary rounded-full accent-primary cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Station list */}
      <div className="px-3 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {tab === "favorites" ? "لا توجد محطات مفضلة بعد" : "لا توجد نتائج"}
          </div>
        )}
        {filtered.map((station) => {
          const isActive = currentId === station.id;
          return (
            <div
              key={station.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isActive
                  ? "bg-primary/5 border-primary/30 shadow-sm"
                  : "bg-card border-border hover:bg-secondary/50"
              }`}
            >
              <button
                onClick={() => play(station.id, station.stream_url)}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? "bg-primary/20" : "bg-secondary"
                }`}
              >
                {statusIcon(station.id)}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                  {station.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {station.city} · {station.country}
                </p>
                {isActive && status === "error" && (
                  <p className="text-[10px] text-destructive mt-0.5">{errorMsg}</p>
                )}
              </div>

              <button
                onClick={() => handleFav(station.id)}
                className="flex-shrink-0 p-1.5 transition-transform active:scale-125"
              >
                <Heart
                  size={18}
                  className={`transition-colors ${
                    favorites.has(station.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default RadioPage;
