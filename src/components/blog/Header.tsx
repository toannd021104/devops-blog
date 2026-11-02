import { Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSearchCommand } from "@/components/blog/search-command-context";

const nav = [
  { label: "Bài viết", href: "#writing" },
  { label: "Giới thiệu", href: "#about" },
];

const Header = () => {
  const { theme, setTheme } = useTheme();
  const { open } = useSearchCommand();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="font-display text-lg font-semibold tracking-tight text-foreground">
          Toan Nguyen<span className="text-primary">.</span>devops
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-muted-foreground transition-smooth hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {/* Desktop: search field with discoverable shortcut hint */}
          <button
            type="button"
            onClick={open}
            aria-label="Tìm bài viết"
            className="hidden items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground sm:flex"
          >
            <Search className="h-4 w-4" />
            <span>Tìm bài viết</span>
            <kbd className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Ctrl K
            </kbd>
          </button>

          {/* Mobile: compact icon button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tìm bài viết"
            onClick={open}
            className="sm:hidden"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun aria-hidden className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon aria-hidden className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
