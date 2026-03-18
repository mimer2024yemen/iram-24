const TickerBar = () => {
  return (
    <div className="bg-secondary border-y border-border py-1.5 overflow-hidden">
      <div className="flex items-center gap-6 px-4 text-xs tabular-nums whitespace-nowrap animate-ticker-rtl" dir="rtl">
        <span className="flex items-center gap-1">
          <span className="text-gold">💰</span>
          <span className="text-muted-foreground">ذهب:</span>
          <span className="text-foreground font-medium">$2,150</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-400">💵</span>
          <span className="text-muted-foreground">فضة:</span>
          <span className="text-foreground font-medium">$24.5</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">USD/YER:</span>
          <span className="text-green-400 font-medium">1,650</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">SAR/YER:</span>
          <span className="text-primary font-medium">435</span>
        </span>
      </div>
    </div>
  );
};

export default TickerBar;
