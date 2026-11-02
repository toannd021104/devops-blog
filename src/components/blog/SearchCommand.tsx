import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { posts, featuredPost } from "@/data/posts";
import { SearchContext, type SearchContextValue } from "@/components/blog/search-command-context";

const allPosts = [featuredPost, ...posts];

/**
 * Provides a single, app-wide command palette (Ctrl/Cmd+K) for jumping to a post.
 * Mounted once at the app root so the dialog and its keyboard listener are not
 * duplicated across pages.
 */
export const SearchCommandProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const goToPost = useCallback(
    (slug: string) => {
      setIsOpen(false);
      navigate(`/posts/${slug}`);
    },
    [navigate],
  );

  const value = useMemo<SearchContextValue>(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
        <CommandInput placeholder="Tìm bài viết..." />
        <CommandList>
          <CommandEmpty>Không tìm thấy bài viết nào.</CommandEmpty>
          <CommandGroup heading="Bài viết">
            {allPosts.map((post) => (
              <CommandItem
                key={post.id}
                // value drives cmdk's built-in fuzzy filtering + keyboard nav
                value={`${post.title} ${post.excerpt} ${post.category}`}
                onSelect={() => goToPost(post.slug)}
                aria-label={post.title}
                className="flex flex-col items-start gap-1"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  {post.category}
                </span>
                <span className="text-sm font-medium text-foreground line-clamp-1">{post.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">{post.excerpt}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SearchContext.Provider>
  );
};
