import { Search, Menu } from "lucide-react";
import eramLogo from "@/assets/eram-logo.png";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchToggle?: () => void;
}

const Header = ({ onMenuToggle, onSearchToggle }: HeaderProps) => {
  return (
    <header className="h-16 flex items-center justify-between px-4 bg-background border-b border-border">
      <button onClick={onSearchToggle} className="p-2 text-foreground">
        <Search size={24} />
      </button>
      <div className="flex items-center gap-2">
        <img src={eramLogo} alt="Eram News" className="h-10 object-contain" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-live" />
          <span className="text-xs font-medium">مباشر</span>
        </div>
        <button onClick={onMenuToggle} className="p-2 text-foreground">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};

export default Header;
