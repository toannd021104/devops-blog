import { useMemo, useState } from "react";

import { Search, X } from "lucide-react";

import Header from "@/components/blog/Header";
import Hero from "@/components/blog/Hero";
import PostCard from "@/components/blog/PostCard";
import About from "@/components/blog/About";
import Footer from "@/components/blog/Footer";
import { posts, featuredPost } from "@/data/posts";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "newest" | "oldest" | "title-asc" | "title-desc";

const sortLabels: Record<SortOption, string> = {
  newest: "Ngày đăng: mới nhất",
  oldest: "Ngày đăng: cũ nhất",
  "title-asc": "Tên bài: A → Z",
  "title-desc": "Tên bài: Z → A",
};

const collator = new Intl.Collator("vi", { sensitivity: "base" });

const sortPosts = (items: typeof featuredPost[], sortBy: SortOption) => {
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (sortBy === "newest") {
      return Date.parse(right.date) - Date.parse(left.date);
    }

    if (sortBy === "oldest") {
      return Date.parse(left.date) - Date.parse(right.date);
    }

    const titleComparison = collator.compare(left.title, right.title);
    return sortBy === "title-asc" ? titleComparison : -titleComparison;
  });

  return sorted;
};

const Index = () => {
  const allPosts = [featuredPost, ...posts];
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const visiblePosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredPosts = allPosts.filter((post) => {
      if (!normalizedSearch) return true;

      return [post.title, post.excerpt, post.category, post.slug].some((field) =>
        field.toLowerCase().includes(normalizedSearch),
      );
    });

    return sortPosts(filteredPosts, sortBy);
  }, [allPosts, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />

        <section id="writing" className="container py-20">
          <div className="mb-12 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                // writing
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
                Recent posts
              </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,16rem)] lg:w-auto lg:min-w-[34rem]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm theo tiêu đề, mô tả, category..."
                    aria-label="Tìm bài viết"
                    className="pl-9 pr-10"
                  />
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                      aria-label="Xóa tìm kiếm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger aria-label="Sắp xếp bài viết">
                    <SelectValue placeholder="Sắp xếp" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(sortLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs text-muted-foreground">
                {visiblePosts.length} bài viết
              </p>
              <a
                href="#"
                className="hidden font-mono text-xs text-muted-foreground transition-smooth hover:text-primary sm:inline"
              >
                all posts →
              </a>
            </div>
          </div>

          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            {visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {visiblePosts.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
              Không tìm thấy bài viết phù hợp với bộ lọc hiện tại.
            </div>
          ) : null}
        </section>

        <About />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
