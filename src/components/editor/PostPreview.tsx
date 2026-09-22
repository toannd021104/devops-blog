import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Frontmatter = {
  title: string;
  category: string;
  date: string;
  readTime: string;
  image: string; // wallpaper filename
  slug: string;
  excerpt: string;
  summary: string[];
  takeaways: string[];
  featured: boolean;
};

type ArticleSegment =
  | { type: "markdown"; content: string }
  | { type: "accordion"; items: { title: string; content: string }[] };

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function parseArticleSegments(content: string): ArticleSegment[] {
  const lines = content.split("\n");
  const segments: ArticleSegment[] = [];
  let markdownBuffer: string[] = [];
  let activeAccordion: { title: string; content: string[] }[] | null = null;
  let activeItem: { title: string; content: string[] } | null = null;

  const flushMarkdown = () => {
    const md = markdownBuffer.join("\n").trim();
    if (md) segments.push({ type: "markdown", content: md });
    markdownBuffer = [];
  };

  const flushItem = () => {
    if (activeAccordion && activeItem) {
      activeAccordion.push({ title: activeItem.title, content: activeItem.content.join("\n").trim() });
      activeItem = null;
    }
  };

  for (const line of lines) {
    if (line.trim() === ":::debug-accordion") {
      flushMarkdown();
      activeAccordion = [];
      continue;
    }
    if (line.trim() === ":::") {
      if (activeAccordion) {
        flushItem();
        segments.push({ type: "accordion", items: activeAccordion });
        activeAccordion = null;
        continue;
      }
    }
    if (activeAccordion) {
      const itemMatch = line.match(/^::item\s+(.+)$/);
      if (itemMatch) {
        flushItem();
        activeItem = { title: itemMatch[1].trim(), content: [] };
        continue;
      }
      activeItem?.content.push(line);
      continue;
    }
    markdownBuffer.push(line);
  }

  flushMarkdown();
  return segments;
}

// Resolve image src for admin preview mode (uses /admin-assets/ path)
function resolveAdminImage(src: string | undefined, slug: string): string {
  if (!src) return "";
  // Already absolute URL
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  // Path like ../../assets/posts/slug/image.png
  const assetsMatch = src.match(/assets\/(.+)$/);
  if (assetsMatch) return `/admin-assets/${assetsMatch[1]}`;
  // Just a filename — look in post images dir
  if (!src.includes("/")) return `/admin-assets/posts/${slug}/${src}`;
  return src;
}

export function PostPreview({ frontmatter, content }: { frontmatter: Frontmatter; content: string }) {
  const { slug } = frontmatter;

  const markdownComponents = {
    h2: ({ children }: { children: React.ReactNode }) => {
      const id = slugify(String(children));
      return (
        <h2 id={id} className="mt-12 mb-4 font-display text-2xl font-bold text-foreground scroll-mt-24">
          {children}
        </h2>
      );
    },
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className="mt-8 mb-3 font-display text-lg font-semibold text-foreground">{children}</h3>
    ),
    p: ({ children }: { children: React.ReactNode }) => (
      <p className="mb-5 text-[1.0625rem] leading-[1.85] text-foreground/85">{children}</p>
    ),
    strong: ({ children }: { children: React.ReactNode }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
    em: ({ children }: { children: React.ReactNode }) => (
      <em className="font-medium text-foreground/70">{children}</em>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className="mb-5 space-y-2 pl-1">{children}</ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className="mb-5 space-y-2 pl-1 list-none">{children}</ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => (
      <li className="flex items-start gap-3 text-[1.0625rem] leading-[1.8] text-foreground/85">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
        <span>{children}</span>
      </li>
    ),
    code: ({ inline, children }: { inline?: boolean; children: React.ReactNode }) =>
      inline ? (
        <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-primary">
          {children}
        </code>
      ) : (
        <code>{children}</code>
      ),
    pre: ({ children }: { children: React.ReactNode }) => (
      <pre className="mb-6 overflow-x-auto rounded-xl border border-border bg-secondary p-5 text-sm font-mono leading-relaxed">
        {children}
      </pre>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="mb-5 rounded-r-lg border-l-4 border-primary bg-primary/5 py-3 pl-5 pr-4 text-[1rem] italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => (
      <div className="my-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs text-muted-foreground">§</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    ),
    table: ({ children }: { children: React.ReactNode }) => (
      <div className="mb-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    th: ({ children }: { children: React.ReactNode }) => (
      <th className="bg-secondary px-4 py-3 text-left font-display font-semibold text-foreground">{children}</th>
    ),
    td: ({ children }: { children: React.ReactNode }) => (
      <td className="border-t border-border px-4 py-3 text-foreground/80">{children}</td>
    ),
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
      <a href={href} className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity">
        {children}
      </a>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img
        src={resolveAdminImage(src, slug)}
        alt={alt ?? ""}
        className="my-6 w-full rounded-xl border border-border"
      />
    ),
  };

  const renderMarkdown = (md: string) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {md}
    </ReactMarkdown>
  );

  const coverSrc = frontmatter.image
    ? `/admin-assets/wallpapers/${frontmatter.image}`
    : "";

  return (
    <div className="min-h-full bg-background px-6 py-8 overflow-y-auto">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
          {frontmatter.category || "Category"}
        </div>
        <h1 className="font-display text-[2rem] font-bold leading-[1.2] text-foreground">
          {frontmatter.title || "Post Title"}
        </h1>
        <div className="mt-4 flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>{frontmatter.date || "Date"}</span>
          <span aria-hidden>·</span>
          <span>{frontmatter.readTime || "? min read"}</span>
        </div>

        {coverSrc && (
          <div className="mt-8 aspect-[2/1] overflow-hidden rounded-xl border border-border">
            <img src={coverSrc} alt={frontmatter.title} className="h-full w-full object-cover" />
          </div>
        )}

        <article className="mt-10">
          {content.trim() ? (
            parseArticleSegments(content).map((segment, i) => {
              if (segment.type === "markdown") {
                return <React.Fragment key={i}>{renderMarkdown(segment.content)}</React.Fragment>;
              }
              return (
                <Accordion key={i} type="multiple" className="mb-8 rounded-xl border border-border">
                  {segment.items.map((item, j) => (
                    <AccordionItem key={item.title} value={`item-${j}`} className="px-4 last:border-b-0">
                      <AccordionTrigger className="py-4 text-left font-display text-base font-semibold hover:no-underline">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        {renderMarkdown(item.content)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              );
            })
          ) : (
            <p className="text-muted-foreground italic">Start writing your content...</p>
          )}
        </article>
      </div>
    </div>
  );
}
