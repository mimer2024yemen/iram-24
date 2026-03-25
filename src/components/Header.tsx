import { Search, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import eramLogo from "@/assets/eram-logo.png";

interface HeaderProps {
  language: "AR" | "EN";
  onLanguageChange: (lang: "AR" | "EN") => void;
  onMenuToggle?: () => void;
  onSearchToggle?: () => void;
}

const Header = ({ language, onLanguageChange, onMenuToggle, onSearchToggle }: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 flex items-center justify-between px-3 bg-background border-b border-border" dir="rtl">
      {/* Right: Menu */}
      <button onClick={onMenuToggle} className="p-2 text-foreground">
        <Menu size={22} />
      </button>

      {/* Center: Logo */}
      <button onClick={() => navigate("/")} className="flex items-center">
        <img src={eramLogo} alt="Eram News" className="h-10 object-contain" />
      </button>

      {/* Left: Search + Language Toggles */}
      <div className="flex items-center gap-2">
        <button onClick={onSearchToggle} className="p-2 text-foreground">
          <Search size={22} />
        </button>
        <button
          onClick={() => onLanguageChange("AR")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            language === "AR"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
        >
          <span className="text-base">🇸🇦</span>
          <span>اخبار عربية</span>
        </button>
        <button
          onClick={() => onLanguageChange("EN")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            language === "EN"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
        >
          <span className="text-base">🌍</span>
          <span>World News</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
