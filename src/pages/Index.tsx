import { useNavigate } from "react-router-dom";
import eramLogo from "@/assets/eram-logo.png";
import { Globe, BookOpen } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6" dir="rtl">
      <img src={eramLogo} alt="Eram News" className="h-24 object-contain mb-8" />
      <h1 className="text-foreground text-2xl font-bold mb-2 font-arabic">إيرام نيوز</h1>
      <p className="text-muted-foreground text-sm mb-10">اختر القسم الذي ترغب بمتابعته</p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate("/arabic")}
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-lg transition-transform active:scale-[0.97] shadow-lg"
        >
          <BookOpen size={24} />
          أخبار عربية
        </button>
        <button
          onClick={() => navigate("/global")}
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-secondary text-secondary-foreground font-bold text-lg transition-transform active:scale-[0.97] border border-border"
        >
          <Globe size={24} />
          Global News
        </button>
      </div>
    </div>
  );
};

export default Index;
