import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type PostMeta = {
  filename: string;
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
  date?: string;
  featured?: string;
};

const AdminPage = () => {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/posts");
      if (res.ok) setPosts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
    const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Post deleted" });
      loadPosts();
    } else {
      toast({ title: "Failed to delete post", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to blog
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display font-bold text-foreground">Admin Panel</h1>
          <div className="flex-1" />
          <Button onClick={() => navigate("/admin/editor")} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Post
          </Button>
        </div>
      </header>

      <main className="container py-10">
        <div className="mx-auto max-w-4xl">
          {/* Stats */}
          <div className="mb-8 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-xl font-semibold text-foreground">
              Posts
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                ({posts.length})
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-20 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No posts yet.</p>
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => navigate("/admin/editor")}
              >
                <Plus className="h-4 w-4" />
                Create your first post
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Title
                    </th>
                    <th className="hidden px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:table-cell">
                      Category
                    </th>
                    <th className="hidden px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:table-cell">
                      Date
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.slug ?? post.filename}
                      className="border-t border-border transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {post.title || post.filename}
                          </span>
                          {post.featured === "true" && (
                            <Badge className="shrink-0 bg-primary/10 text-primary text-[10px]">
                              featured
                            </Badge>
                          )}
                        </div>
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {post.slug}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        {post.category && (
                          <Badge variant="secondary">{post.category}</Badge>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 font-mono text-sm text-muted-foreground md:table-cell">
                        {post.date}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {post.slug && (
                            <Button size="sm" variant="ghost" asChild className="h-7 w-7 p-0 text-muted-foreground">
                              <Link to={`/posts/${post.slug}`} target="_blank">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" asChild>
                            <Link to={`/admin/editor/${post.slug}`}>
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(post.slug!, post.title ?? post.filename)}
                            disabled={!post.slug}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
