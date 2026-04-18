import { Search, X, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { posts, featuredPost } from "@/data/posts";

const nav = [
  { label: "Writing", href: "#writing" },
  { label: "About", href: "#about" },
];

const allPosts = [featuredPost, ...posts];

const Header = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { theme, setTheme } = useTheme();

  const results = query.trim()
    ? allPosts.filter((p) =>
        [p.title, p.excerpt, p.category].some((field) =>
          field.toLowerCase().includes(query.toLowerCase())
        )
      )
    : [];

  return (
    <>
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
            <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-24 px-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search posts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {query.trim() && (
              <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                {results.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">No posts found.</li>
                ) : (
                  results.map((post) => (
                    <li key={post.id}>
                      <a
                        href={`#writing`}
                        onClick={() => setOpen(false)}
                        className="flex flex-col gap-1 px-4 py-3 hover:bg-secondary/50 transition-colors"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{post.category}</span>
                        <span className="text-sm font-medium text-foreground line-clamp-1">{post.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{post.excerpt}</span>
                      </a>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
