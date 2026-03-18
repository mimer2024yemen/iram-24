interface CategoriesNavProps {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}

const CategoriesNav = ({ categories, activeCategory, onSelect }: CategoriesNavProps) => {
  return (
    <nav className="bg-background border-b border-border">
      <div className="flex overflow-x-auto scrollbar-hide gap-1 px-4 py-2" dir="rtl">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default CategoriesNav;
