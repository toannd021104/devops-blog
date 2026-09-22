import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FrontmatterPanel, type Frontmatter } from "@/components/editor/FrontmatterPanel";
import { MarkdownEditorPane } from "@/components/editor/MarkdownEditorPane";
import { PostPreview } from "@/components/editor/PostPreview";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

const DEFAULT_FM: Frontmatter = {
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  category: "",
  date: "",
  readTime: "",
  image: "",
  featured: false,
  summary: [],
  takeaways: [],
};

function buildMarkdown(fm: Frontmatter, content: string): string {
  const lines: string[] = [
    "---",
    `id: "${fm.id}"`,
    `slug: "${fm.slug}"`,
    `title: "${fm.title.replace(/"/g, '\\"')}"`,
    `excerpt: "${fm.excerpt.replace(/"/g, '\\"')}"`,
    `category: "${fm.category}"`,
    `date: "${fm.date}"`,
    `readTime: "${fm.readTime}"`,
    `image: "${fm.image}"`,
    ...(fm.featured ? ["featured: true"] : []),
    "summary:",
    ...fm.summary.filter(Boolean).map((s) => `  - "${s.replace(/"/g, '\\"')}"`),
    "takeaways:",
    ...fm.takeaways.filter(Boolean).map((t) => `  - "${t.replace(/"/g, '\\"')}"`),
    "---",
    "",
    content.trim(),
    "",
  ];
  return lines.join("\n");
}

function parseFrontmatterFromRaw(raw: string): { fm: Frontmatter; content: string } {
  const lines = raw.split("\n");
  if (lines[0] !== "---") return { fm: { ...DEFAULT_FM }, content: raw };
  const endIdx = lines.indexOf("---", 1);
  if (endIdx < 0) return { fm: { ...DEFAULT_FM }, content: raw };

  const fmLines = lines.slice(1, endIdx);
  const content = lines.slice(endIdx + 1).join("\n").trim();

  const meta: Record<string, string | boolean | string[]> = {};
  let currentKey: string | null = null;

  for (const line of fmLines) {
    if (!line.trim()) continue;
    const arrItem = line.match(/^\s{2}-\s+(.+)$/);
    if (arrItem && currentKey) {
      const val = arrItem[1].replace(/^["']|["']$/g, "").trim();
      (meta[currentKey] as string[]).push(val);
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kvMatch) continue;
    const [, key, value] = kvMatch;
    if (value.trim() === "") {
      meta[key] = [];
      currentKey = key;
    } else {
      const clean = value.replace(/^["']|["']$/g, "").trim();
      meta[key] = clean === "true" ? true : clean === "false" ? false : clean;
      currentKey = null;
    }
  }

  return {
    fm: {
      id: String(meta.id ?? ""),
      slug: String(meta.slug ?? ""),
      title: String(meta.title ?? ""),
      excerpt: String(meta.excerpt ?? ""),
      category: String(meta.category ?? ""),
      date: String(meta.date ?? ""),
      readTime: String(meta.readTime ?? ""),
      image: String(meta.image ?? ""),
      featured: Boolean(meta.featured),
      summary: Array.isArray(meta.summary) ? meta.summary : [],
      takeaways: Array.isArray(meta.takeaways) ? meta.takeaways : [],
    },
    content,
  };
}

const PostEditorPage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const isNew = !slug;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fm, setFm] = useState<Frontmatter>({ ...DEFAULT_FM });
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [wallpapers, setWallpapers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [showPreview, setShowPreview] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Load wallpapers list
  useEffect(() => {
    fetch("/api/admin/wallpapers")
      .then((r) => r.json())
      .then(setWallpapers)
      .catch(() => {});
  }, []);

  // Load next ID for new posts
  useEffect(() => {
    if (!isNew) return;
    fetch("/api/admin/posts")
      .then((r) => r.json())
      .then((posts: { id?: string }[]) => {
        const maxId = posts.reduce((m, p) => Math.max(m, Number(p.id ?? 0)), 0);
        setFm((prev) => ({ ...prev, id: String(maxId + 1) }));
      })
      .catch(() => {});
  }, [isNew]);

  // Load existing post
  useEffect(() => {
    if (isNew || !slug) return;
    setLoading(true);
    fetch(`/api/admin/posts/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data: { filename?: string; content?: string; error?: string }) => {
        if (data.error) {
          toast({ title: "Post not found", variant: "destructive" });
          navigate("/admin");
          return;
        }
        if (data.filename && data.content) {
          setFilename(data.filename);
          const parsed = parseFrontmatterFromRaw(data.content);
          setFm(parsed.fm);
          setContent(parsed.content);
        }
      })
      .catch(() => toast({ title: "Failed to load post", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [slug, isNew]);

  const handleFmChange = useCallback((newFm: Frontmatter) => {
    setFm(newFm);
    setDirty(true);
  }, []);

  const handleContentChange = useCallback((v: string) => {
    setContent(v);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!fm.slug) {
      toast({ title: "Slug is required", variant: "destructive" });
      return;
    }
    if (!fm.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!fm.image) {
      toast({ title: "Cover image is required", variant: "destructive" });
      return;
    }

    const targetFilename = filename || `${fm.slug}.md`;
    const markdown = buildMarkdown(fm, content);
    setSaving(true);

    try {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/admin/posts" : `/api/admin/posts/${slug}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: targetFilename, content: markdown }),
      });

      if (!res.ok) throw new Error("Save failed");

      setFilename(targetFilename);
      setDirty(false);
      toast({ title: isNew ? "Post created!" : "Post saved!" });

      if (isNew) {
        navigate(`/admin/editor/${fm.slug}`, { replace: true });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
        <Link
          to="/admin"
          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Admin
        </Link>
        <div className="h-4 w-px bg-border" />
        <span className="flex-1 truncate font-display font-semibold text-foreground">
          {fm.title || (isNew ? "New Post" : "Edit Post")}
          {dirty && <span className="ml-2 text-xs text-muted-foreground font-normal">• unsaved</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "Hide preview" : "Show preview"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
      </header>

      {/* Main tabs */}
      <Tabs defaultValue="content" className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-4">
          <TabsList className="h-10 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="metadata"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-sm"
            >
              Metadata
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-sm"
            >
              Content
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Metadata tab */}
        <TabsContent value="metadata" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl">
              <FrontmatterPanel
                frontmatter={fm}
                wallpapers={wallpapers}
                content={content}
                onChange={handleFmChange}
              />
            </div>
          </div>
        </TabsContent>

        {/* Content tab — split editor / preview */}
        <TabsContent value="content" className="mt-0 flex-1 overflow-hidden">
          {showPreview ? (
            <PanelGroup direction="horizontal" className="h-full">
              <Panel defaultSize={50} minSize={25} className="flex flex-col overflow-hidden">
                <MarkdownEditorPane
                  content={content}
                  onChange={handleContentChange}
                  postSlug={fm.slug}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />
              <Panel defaultSize={50} minSize={25} className="overflow-hidden border-l border-border">
                <PostPreview frontmatter={fm} content={content} />
              </Panel>
            </PanelGroup>
          ) : (
            <div className="h-full overflow-hidden">
              <MarkdownEditorPane
                content={content}
                onChange={handleContentChange}
                postSlug={fm.slug}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PostEditorPage;
