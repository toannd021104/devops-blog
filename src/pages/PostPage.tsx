import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ChevronDown, Check, Copy, List, BookOpen, Lightbulb } from "lucide-react";
import { posts, featuredPost } from "@/data/posts";
import { allImages } from "@/data/images";
import Header from "@/components/blog/Header";
import Footer from "@/components/blog/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const allPosts = [featuredPost, ...posts];

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Heading = { text: string; id: string; level: 2 | 3 };

const stripMarkdown = (text: string) =>
  text.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1").replace(/`([^`]+)`/g, "$1").trim();

const extractHeadings = (content: string): Heading[] =>
  content
    .split("\n")
    .filter((line) => line.startsWith("## ") || line.startsWith("### "))
    .map((line) => {
      const level: 2 | 3 = line.startsWith("### ") ? 3 : 2;
      const raw = line.replace(/^#{2,3}\s/, "").trim();
      const text = stripMarkdown(raw);
      return { text, id: slugify(raw), level };
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
    <div className="fixed top-0 left-0 z-50 h-[3px] w-full">
      <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${progress}%` }} />
    </div>
  );
};

// Desktop sticky ToC (lg+), shows h2 and h3
const TableOfContents = ({ headings }: { headings: Heading[] }) => {
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
    <aside className="hidden lg:block w-52 shrink-0">
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
        <div className="mb-4 flex items-center gap-2">
          <List className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-primary">On this page</p>
        </div>
        <nav className="space-y-0.5">
          {headings.map(({ text, id, level }, i) => {
            const isH3 = level === 3;
            // Show the left-rail on an h3 only when the previous item exists
            const prevIsH2 = i > 0 && headings[i - 1].level === 2;
            const nextIsH3 = i < headings.length - 1 && headings[i + 1].level === 3;
            // h3 items are grouped under their parent h2 via a continuous left border
            return (
              <div key={id} className={isH3 ? "relative pl-3" : ""}>
                {isH3 && (
                  <span
                    className={`absolute left-0 top-0 w-px bg-border ${
                      prevIsH2 ? "top-0" : "-top-0.5"
                    } ${nextIsH3 ? "bottom-0" : "bottom-1/2"}`}
                  />
                )}
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActive(id);
                  }}
                  className={`block rounded-md py-1.5 text-[0.78rem] leading-snug transition-all duration-150 ${
                    isH3 ? "pl-3 text-[0.75rem]" : "pl-3"
                  } ${
                    active === id
                      ? "bg-primary/10 font-semibold text-primary"
                      : isH3
                        ? "text-muted-foreground/70 hover:text-foreground hover:bg-secondary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {text}
                </a>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

// Mobile collapsible ToC (below cover image, hidden on lg+)
const MobileTableOfContents = ({ headings }: { headings: Heading[] }) => {
  const [open, setOpen] = useState(false);
  if (headings.length === 0) return null;
  return (
    <div className="mb-8 rounded-xl border border-border lg:hidden overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-secondary/50"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-primary">
          <List className="h-3.5 w-3.5" /> On this page
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <nav className="border-t border-border px-4 pb-3 pt-2 space-y-0.5">
          {headings.map(({ text, id, level }, i) => {
            const isH3 = level === 3;
            const nextIsH3 = i < headings.length - 1 && headings[i + 1].level === 3;
            return (
              <div key={id} className={isH3 ? "relative pl-3" : ""}>
                {isH3 && (
                  <span
                    className={`absolute left-0 top-0 w-px bg-border ${nextIsH3 ? "bottom-0" : "bottom-1/2"}`}
                  />
                )}
                <a
                  href={`#${id}`}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md py-1.5 transition-colors hover:text-foreground hover:bg-secondary ${
                    isH3
                      ? "pl-3 text-[0.82rem] text-muted-foreground/70"
                      : "pl-2 text-sm text-muted-foreground"
                  }`}
                >
                  {text}
                </a>
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
};

// Code block with copy button
const CodeBlock = ({ children }: { children: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6 rounded-xl overflow-hidden border border-slate-700/50 dark:border-slate-700/80 shadow-sm">
      {/* terminal toolbar — always dark regardless of page theme */}
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-mono text-slate-400 transition-colors hover:text-slate-100"
        >
          {copied ? (
            <><Check className="h-3 w-3 text-emerald-400" />copied</>
          ) : (
            <><Copy className="h-3 w-3" />copy</>
          )}
        </button>
      </div>
      <pre
        ref={preRef}
        className="overflow-x-auto bg-slate-900 p-5 text-[0.84rem] font-mono leading-relaxed text-slate-200 m-0"
      >
        {children}
      </pre>
    </div>
  );
};

// Summary card shown at the top of the post
const PostSummaryCard = ({ summary, takeaways }: { summary: string[]; takeaways: string[] }) => {
  if (!summary?.length && !takeaways?.length) return null;
  return (
    <div className="mb-10 grid gap-4 sm:grid-cols-2">
      {summary?.length > 0 && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/15 dark:bg-teal-400/15">
              <BookOpen className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-teal-700 dark:text-teal-400">Summary</p>
          </div>
          <ul className="space-y-2">
            {summary.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {takeaways?.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/20 dark:bg-amber-400/15">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400">Key takeaways</p>
          </div>
          <ul className="space-y-2">
            {takeaways.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
    h3: ({ children }: { children: React.ReactNode }) => {
      const id = slugify(String(children));
      return (
        <h3 id={id} className="mt-8 mb-3 font-display text-lg font-semibold text-foreground scroll-mt-24">
          {children}
        </h3>
      );
    },
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
    pre: ({ children }: { children: React.ReactNode }) => <CodeBlock>{children}</CodeBlock>,
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="mb-6 rounded-r-xl border-l-[3px] border-primary bg-primary/5 py-4 pl-5 pr-5 text-[0.9625rem] leading-[1.75] text-foreground/90 [&_p]:mb-0 [&_p]:leading-[1.75]">
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
        <figure className="my-8">
          <img src={resolved} alt={alt ?? ""} className="w-full rounded-xl border border-border" />
          {alt && <figcaption className="mt-2 text-center text-sm text-muted-foreground italic">{alt}</figcaption>}
        </figure>
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
        <div className="mx-auto flex max-w-5xl gap-14">

          {/* Main content */}
          <div className="min-w-0 flex-1 max-w-[680px]">

            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" /> All posts
            </Link>

            {/* Hero: cover image with title/meta overlaid */}
            <div className="relative aspect-[2/1] overflow-hidden rounded-2xl">
              <img
                src={post.image}
                alt={post.title}
                className="h-full w-full object-cover"
              />
              {/* gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              {/* text on top of image */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">
                  {post.category}
                </div>
                <h1 className="font-display text-[1.6rem] font-bold leading-[1.2] text-white md:text-[2.1rem]">
                  {post.title}
                </h1>
                <div className="mt-3 flex items-center gap-3 font-mono text-xs text-white/55">
                  <span>{post.date}</span>
                  <span aria-hidden>·</span>
                  <span>{post.readTime}</span>
                </div>
              </div>
            </div>

            {/* Mobile ToC */}
            <div className="mt-8">
              <MobileTableOfContents headings={headings} />
            </div>

            {/* Summary + takeaways */}
            <PostSummaryCard summary={post.summary} takeaways={post.takeaways} />

            {/* Article body */}
            <article>
              {parseArticleSegments(post.content).map((segment, segmentIndex) => {
                if (segment.type === "markdown") {
                  return (
                    <React.Fragment key={`markdown-${segmentIndex}`}>
                      {renderMarkdown(segment.content)}
                    </React.Fragment>
                  );
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

          {/* Desktop ToC sidebar */}
          <TableOfContents headings={headings} />

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PostPage;
