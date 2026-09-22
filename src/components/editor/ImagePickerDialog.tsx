import React, { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  postSlug: string;
  onClose: () => void;
  onInsert: (markdown: string) => void;
};

export function ImagePickerDialog({ open, postSlug, onClose, onInsert }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !postSlug) return;
    fetch(`/api/admin/images/${encodeURIComponent(postSlug)}`)
      .then((r) => r.json())
      .then(setImages)
      .catch(() => setImages([]));
  }, [open, postSlug]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const data = await fileToBase64(file);
      const res = await fetch("/api/admin/upload/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: postSlug, filename: file.name, data }),
      });
      if (res.ok) {
        setImages((prev) => [...prev, file.name]);
        setSelected(file.name);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleInsert = () => {
    if (!selected) return;
    const altText = alt || selected.replace(/\.[^.]+$/, "");
    const mdPath = `../../assets/posts/${postSlug}/${selected}`;
    onInsert(`![${altText}](${mdPath})`);
    onClose();
    setSelected(null);
    setAlt("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !postSlug}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload new image"}
            </Button>
            {!postSlug && (
              <p className="mt-1 text-xs text-muted-foreground">
                Save post with a slug first to enable uploads.
              </p>
            )}
          </div>

          {/* Image grid */}
          {images.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">
                Existing images ({images.length})
              </Label>
              <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                {images.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setSelected(img === selected ? null : img)}
                    className={`relative rounded-lg border-2 overflow-hidden aspect-square ${
                      selected === img ? "border-primary" : "border-border"
                    }`}
                  >
                    <img
                      src={`/admin-assets/posts/${postSlug}/${img}`}
                      alt={img}
                      className="h-full w-full object-cover"
                    />
                    {selected === img && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alt text */}
          {selected && (
            <div className="space-y-1">
              <Label htmlFor="img-alt">Alt text</Label>
              <Input
                id="img-alt"
                placeholder="Describe the image..."
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!selected}>
              Insert
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
