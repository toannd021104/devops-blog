import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { posts, featuredPost } from "@/data/posts";
import { allImages } from "@/data/images";
import Header from "@/components/blog/Header";
import Footer from "@/components/blog/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const allPosts = [featuredPost, ...posts];

// Convert heading text to a URL-safe id
const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Extract ## headings from markdown
const extractHeadings = (content: string) =>
  content
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => {
      const text = line.replace(/^## /, "").trim();
      return { text, id: slugify(text) };
    });

// Reading progress bar
const ReadingProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div className="fixed top-0 left-0 z-50 h-[3px] w-full bg-border">
      <div className="h-full bg-primary transition-all duration-75" style={{ width: `${progress}%` }} />
    </div>
  );
};

// Sticky table of contents
const TableOfContents = ({ headings }: { headings: { text: string; id: string }[] }) => {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-20% 0% -70% 0%" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-28">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          // Table of contents
        </p>
        <nav className="space-y-1">
          {headings.map(({ text, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(id);
              }}
              className={`block rounded-md px-3 py-1.5 text-[0.8rem] leading-snug transition-all duration-200 ${
                active === id
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
};

type ArticleSegment =
  | { type: "markdown"; content: string }
  | { type: "accordion"; items: { title: string; content: string }[] };

const parseArticleSegments = (content: string): ArticleSegment[] => {
  const lines = content.split("\n");
  const segments: ArticleSegment[] = [];
  let markdownBuffer: string[] = [];
  let activeAccordion: { title: string; content: string[] }[] | null = null;
  let activeItem: { title: string; content: string[] } | null = null;

  const flushMarkdown = () => {
    const markdown = markdownBuffer.join("\n").trim();
    if (markdown) segments.push({ type: "markdown", content: markdown });
    markdownBuffer = [];
  };

  const flushItem = () => {
    if (activeAccordion && activeItem) {
      activeAccordion.push({
        title: activeItem.title,
        content: activeItem.content.join("\n").trim(),
      });
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
};

const PostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = allPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-20 text-center">
          <p className="text-muted-foreground">Post not found.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">← Back home</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const headings = extractHeadings(post.content);
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
      <h3 className="mt-8 mb-3 font-display text-lg font-semibold text-foreground scroll-mt-24">
        {children}
      </h3>
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
    ul: ({ children }: { children: React.ReactNode }) => <ul className="mb-5 space-y-2 pl-1">{children}</ul>,
    ol: ({ children }: { children: React.ReactNode }) => <ol className="mb-5 space-y-2 pl-1 list-none">{children}</ol>,
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
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      const filename = src?.split("/").pop() ?? "";
      const resolved = src ? allImages[src] ?? allImages[filename] ?? src : "";
      return (
        <img src={resolved} alt={alt ?? ""} className="my-6 w-full rounded-xl border border-border" />
      );
    },
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgress />
      <Header />

      <main className="container py-14">
        {/* Two-column layout: content + TOC */}
        <div className="mx-auto flex max-w-5xl gap-14">

          {/* Main content */}
          <div className="min-w-0 flex-1 max-w-[680px]">

            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" /> All posts
            </Link>

            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {post.category}
            </div>
            <h1 className="font-display text-[2rem] font-bold leading-[1.2] text-foreground md:text-[2.5rem]">
              {post.title}
            </h1>
            <div className="mt-4 flex items-center gap-3 font-mono text-xs text-muted-foreground">
              <span>{post.date}</span>
              <span aria-hidden>·</span>
              <span>{post.readTime}</span>
            </div>

            <div className="mt-8 aspect-[2/1] overflow-hidden rounded-xl border border-border">
              <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
            </div>

            {/* Article body */}
            <article className="mt-10">
              {parseArticleSegments(post.content).map((segment, segmentIndex) => {
                if (segment.type === "markdown") {
                  return <React.Fragment key={`markdown-${segmentIndex}`}>{renderMarkdown(segment.content)}</React.Fragment>;
                }

                return (
                  <Accordion key={`accordion-${segmentIndex}`} type="multiple" className="mb-8 rounded-xl border border-border">
                    {segment.items.map((item, itemIndex) => (
                      <AccordionItem key={item.title} value={`item-${itemIndex}`} className="px-4 last:border-b-0">
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
              })}
            </article>

            <div className="mt-14 border-t border-border pt-10">
              <Link
                to="/"
                className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" /> Back to all posts
              </Link>
            </div>

          </div>

          {/* TOC sidebar */}
          <TableOfContents headings={headings} />

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PostPage;
