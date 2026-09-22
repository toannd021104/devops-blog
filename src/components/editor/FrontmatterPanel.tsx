import React, { useRef, useState } from "react";
import { Plus, Trash2, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type Frontmatter = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string; // wallpaper filename
  featured: boolean;
  summary: string[];
  takeaways: string[];
};

type Props = {
  frontmatter: Frontmatter;
  wallpapers: string[];
  content: string;
  onChange: (fm: Frontmatter) => void;
};

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function calcReadTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FrontmatterPanel({ frontmatter: fm, wallpapers, content, onChange }: Props) {
  const set = (partial: Partial<Frontmatter>) => onChange({ ...fm, ...partial });
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

  const handleWallpaperUpload = async (file: File) => {
    setUploadingWallpaper(true);
    try {
      const data = await fileToBase64(file);
      const res = await fetch("/api/admin/upload/wallpaper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data }),
      });
      if (res.ok) set({ image: file.name });
    } finally {
      setUploadingWallpaper(false);
    }
  };

  const updateArrayItem = (
    key: "summary" | "takeaways",
    index: number,
    value: string,
  ) => {
    const arr = [...fm[key]];
    arr[index] = value;
    set({ [key]: arr });
  };

  const addArrayItem = (key: "summary" | "takeaways") =>
    set({ [key]: [...fm[key], ""] });

  const removeArrayItem = (key: "summary" | "takeaways", index: number) => {
    const arr = fm[key].filter((_, i) => i !== index);
    set({ [key]: arr });
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* ID */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Post ID">
          <Input
            value={fm.id}
            onChange={(e) => set({ id: e.target.value })}
            placeholder="1"
            className="font-mono"
          />
        </Field>
        <Field label="Featured">
          <div className="flex h-9 items-center gap-2">
            <Switch
              checked={fm.featured}
              onCheckedChange={(v) => set({ featured: v })}
            />
            <span className="text-sm text-muted-foreground">
              {fm.featured ? "Yes" : "No"}
            </span>
          </div>
        </Field>
      </div>

      {/* Title + Slug */}
      <Field label="Title">
        <Input
          value={fm.title}
          onChange={(e) => {
            const title = e.target.value;
            const slug = fm.slug === toSlug(fm.title) ? toSlug(title) : fm.slug;
            set({ title, slug });
          }}
          placeholder="Post title"
        />
      </Field>

      <Field label="Slug">
        <div className="flex gap-2">
          <Input
            value={fm.slug}
            onChange={(e) => set({ slug: e.target.value })}
            placeholder="post-url-slug"
            className="font-mono text-sm"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Regenerate from title"
            onClick={() => set({ slug: toSlug(fm.title) })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Field>

      {/* Excerpt */}
      <Field label="Excerpt">
        <Textarea
          value={fm.excerpt}
          onChange={(e) => set({ excerpt: e.target.value })}
          placeholder="Short description shown in post list..."
          rows={2}
        />
      </Field>

      {/* Category / Date / ReadTime */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Input
            value={fm.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="AWS, DevOps, ..."
          />
        </Field>
        <Field label="Date">
          <div className="flex gap-2">
            <Input
              value={fm.date}
              onChange={(e) => set({ date: e.target.value })}
              placeholder="Jun 11, 2026"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="Set to today"
              onClick={() => set({ date: todayStr() })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>
      </div>

      <Field label="Read time">
        <div className="flex gap-2">
          <Input
            value={fm.readTime}
            onChange={(e) => set({ readTime: e.target.value })}
            placeholder="8 min read"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Auto-calculate"
            onClick={() => set({ readTime: calcReadTime(content) })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Field>

      {/* Wallpaper / Cover image */}
      <Field label="Cover image (wallpaper)">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={fm.image}
              onChange={(e) => set({ image: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Select wallpaper --</option>
              {wallpapers.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleWallpaperUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="Upload new wallpaper"
              onClick={() => wallpaperInputRef.current?.click()}
              disabled={uploadingWallpaper}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </div>
          {fm.image && (
            <img
              src={`/admin-assets/wallpapers/${fm.image}`}
              alt="cover preview"
              className="h-24 w-full rounded-lg border border-border object-cover"
            />
          )}
        </div>
      </Field>

      {/* Summary */}
      <ArrayField
        label="Summary"
        items={fm.summary}
        placeholder="Key point..."
        onAdd={() => addArrayItem("summary")}
        onChange={(i, v) => updateArrayItem("summary", i, v)}
        onRemove={(i) => removeArrayItem("summary", i)}
      />

      {/* Takeaways */}
      <ArrayField
        label="Takeaways"
        items={fm.takeaways}
        placeholder="Takeaway..."
        onAdd={() => addArrayItem("takeaways")}
        onChange={(i, v) => updateArrayItem("takeaways", i, v)}
        onRemove={(i) => removeArrayItem("takeaways", i)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ArrayField({
  label,
  items,
  placeholder,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onAdd: () => void;
  onChange: (i: number, v: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className="text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No items yet. Click Add.</p>
        )}
      </div>
    </div>
  );
}
