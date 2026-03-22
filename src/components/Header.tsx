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

      {/* Left: Search + Language */}
      <div className="flex items-center gap-1">
        <button onClick={onSearchToggle} className="p-2 text-foreground">
          <Search size={20} />
        </button>
        <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => onLanguageChange("AR")}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              language === "AR" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            عربي
          </button>
          <button
            onClick={() => onLanguageChange("EN")}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              language === "EN" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
