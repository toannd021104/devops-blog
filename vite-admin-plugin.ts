import type { Plugin, ViteDevServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const ROOT = path.resolve(import.meta.dirname);
const POSTS_DIR = path.join(ROOT, "src/content/posts");
const WALLPAPERS_DIR = path.join(ROOT, "src/assets/wallpapers");
const POST_IMAGES_DIR = path.join(ROOT, "src/assets/posts");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(data));
}

function parseSlugFromContent(raw: string): string {
  const m = raw.match(/^slug:\s*["']?([^"'\n\r]+)["']?/m);
  return m?.[1]?.trim() ?? "";
}

function parseSimpleMeta(raw: string): Record<string, string> {
  const lines = raw.split("\n");
  const endIdx = lines.indexOf("---", 1);
  const meta: Record<string, string> = {};
  if (endIdx < 0) return meta;
  for (const line of lines.slice(1, endIdx)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return meta;
}

export function adminPlugin(): Plugin {
  return {
    name: "vite-admin-plugin",
    configureServer(server: ViteDevServer) {
      // Serve raw asset files so admin preview can display images
      server.middlewares.use("/admin-assets", (req, res, next) => {
        const urlPath = (req.url ?? "/").split("?")[0];
        const filePath = path.join(ROOT, "src/assets", urlPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mime: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".avif": "image/avif",
          };
          res.setHeader("Content-Type", mime[ext] ?? "application/octet-stream");
          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(filePath).pipe(res as NodeJS.WritableStream);
          return;
        }
        next();
      });

      // REST API
      server.middlewares.use("/api/admin", async (req, res, next) => {
        const pathname = (req.url ?? "/").split("?")[0];
        const method = (req.method ?? "GET").toUpperCase();

        // CORS preflight
        if (method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          // GET /posts — list all posts metadata
          if (method === "GET" && pathname === "/posts") {
            const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
            const list = files.map((filename) => {
              const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
              return { filename, ...parseSimpleMeta(raw) };
            });
            // Sort by id descending
            list.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
            return json(res, list);
          }

          // GET /wallpapers — list available wallpaper filenames
          if (method === "GET" && pathname === "/wallpapers") {
            const files = fs
              .readdirSync(WALLPAPERS_DIR)
              .filter((f) => /\.(png|jpg|jpeg|webp|avif)$/i.test(f));
            return json(res, files);
          }

          // GET /posts/:slug — get raw markdown content
          if (method === "GET" && pathname.startsWith("/posts/")) {
            const slug = decodeURIComponent(pathname.slice("/posts/".length));
            const files = fs.readdirSync(POSTS_DIR);
            const filename = files.find((f) => {
              const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
              return parseSlugFromContent(raw) === slug;
            });
            if (!filename) return json(res, { error: "Not found" }, 404);
            const content = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
            return json(res, { filename, content });
          }

          // GET /images/:slug — list uploaded images for a post
          if (method === "GET" && pathname.startsWith("/images/")) {
            const slug = decodeURIComponent(pathname.slice("/images/".length));
            const dir = path.join(POST_IMAGES_DIR, slug);
            if (!fs.existsSync(dir)) return json(res, []);
            const files: string[] = [];
            const walk = (d: string, rel = "") => {
              fs.readdirSync(d).forEach((f) => {
                const full = path.join(d, f);
                const relPath = rel ? `${rel}/${f}` : f;
                if (fs.statSync(full).isDirectory()) walk(full, relPath);
                else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(f)) files.push(relPath);
              });
            };
            walk(dir);
            return json(res, files);
          }

          // POST /posts — create post file
          if (method === "POST" && pathname === "/posts") {
            const body = JSON.parse(await readBody(req)) as { filename: string; content: string };
            fs.writeFileSync(path.join(POSTS_DIR, body.filename), body.content, "utf-8");
            return json(res, { ok: true, filename: body.filename });
          }

          // PUT /posts/:slug — update post file
          if (method === "PUT" && pathname.startsWith("/posts/")) {
            const body = JSON.parse(await readBody(req)) as { filename: string; content: string };
            fs.writeFileSync(path.join(POSTS_DIR, body.filename), body.content, "utf-8");
            return json(res, { ok: true });
          }

          // DELETE /posts/:slug — delete post file
          if (method === "DELETE" && pathname.startsWith("/posts/")) {
            const slug = decodeURIComponent(pathname.slice("/posts/".length));
            const files = fs.readdirSync(POSTS_DIR);
            const filename = files.find((f) => {
              const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
              return parseSlugFromContent(raw) === slug;
            });
            if (!filename) return json(res, { error: "Not found" }, 404);
            fs.unlinkSync(path.join(POSTS_DIR, filename));
            return json(res, { ok: true });
          }

          // POST /upload/wallpaper — upload a new wallpaper (base64)
          if (method === "POST" && pathname === "/upload/wallpaper") {
            const body = JSON.parse(await readBody(req)) as { filename: string; data: string };
            fs.writeFileSync(
              path.join(WALLPAPERS_DIR, body.filename),
              Buffer.from(body.data, "base64"),
            );
            return json(res, { ok: true, filename: body.filename });
          }

          // POST /upload/image — upload a post inline image (base64)
          if (method === "POST" && pathname === "/upload/image") {
            const body = JSON.parse(await readBody(req)) as {
              slug: string;
              subdir?: string;
              filename: string;
              data: string;
            };
            const dir = body.subdir
              ? path.join(POST_IMAGES_DIR, body.slug, body.subdir)
              : path.join(POST_IMAGES_DIR, body.slug);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, body.filename), Buffer.from(body.data, "base64"));
            return json(res, { ok: true, filename: body.filename });
          }

          next();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return json(res, { error: msg }, 500);
        }
      });
    },
  };
}
