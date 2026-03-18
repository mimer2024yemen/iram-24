import { Search, Menu } from "lucide-react";
import eramLogo from "@/assets/eram-logo.png";

interface HeaderProps {
  language: "AR" | "EN";
  onLanguageChange: (lang: "AR" | "EN") => void;
  onMenuToggle?: () => void;
  onSearchToggle?: () => void;
}

const Header = ({ language, onLanguageChange, onMenuToggle, onSearchToggle }: HeaderProps) => {
  return (
    <header className="h-16 flex items-center justify-between px-3 bg-background border-b border-border">
      <button onClick={onSearchToggle} className="p-2 text-foreground">
        <Search size={22} />
      </button>
      <div className="flex items-center gap-2">
        <img src={eramLogo} alt="Eram News" className="h-14 object-contain" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => onLanguageChange("AR")}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              language === "AR"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🇸🇦 عربي
          </button>
          <button
            onClick={() => onLanguageChange("EN")}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              language === "EN"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🌍 Global
          </button>
        </div>
        <button onClick={onMenuToggle} className="p-2 text-foreground">
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
};

export default Header;
