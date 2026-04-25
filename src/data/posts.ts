export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  summary: string[];
  takeaways: string[];
  content: string;
};

type PostFrontmatter = Omit<Post, "image"> & {
  image: string;
  featured?: boolean;
};

const markdownModules = import.meta.glob("../content/posts/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;
const wallpaperModules = import.meta.glob("../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const wallpaperMap = Object.fromEntries(
  Object.entries(wallpaperModules).map(([filePath, assetUrl]) => [
    filePath.split("/").pop() ?? filePath,
    assetUrl,
  ])
);

const stripQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseFrontmatterValue = (value: string) => {
  const normalized = stripQuotes(value);

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return normalized;
};

const parseMarkdownFile = (raw: string, filePath: string) => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  if (lines[0] !== "---") {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const endIndex = lines.indexOf("---", 1);
  if (endIndex === -1) {
    throw new Error(`Unclosed frontmatter in ${filePath}`);
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const content = lines.slice(endIndex + 1).join("\n").trim();
  const meta: Record<string, string | string[] | boolean> = {};

  let currentArrayKey: string | null = null;

  for (const line of frontmatterLines) {
    if (!line.trim()) continue;

    const arrayMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayMatch && currentArrayKey) {
      const existing = meta[currentArrayKey];
      if (!Array.isArray(existing)) {
        throw new Error(`Invalid array frontmatter for ${currentArrayKey} in ${filePath}`);
      }
      existing.push(stripQuotes(arrayMatch[1]));
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) {
      throw new Error(`Unsupported frontmatter line "${line}" in ${filePath}`);
    }

    const [, key, value] = keyMatch;
    if (value === "") {
      meta[key] = [];
      currentArrayKey = key;
      continue;
    }

    meta[key] = parseFrontmatterValue(value);
    currentArrayKey = null;
  }

  const requiredFields = [
    "id",
    "slug",
    "title",
    "excerpt",
    "category",
    "date",
    "readTime",
    "image",
    "summary",
    "takeaways",
  ] as const;

  for (const field of requiredFields) {
    if (!(field in meta)) {
      throw new Error(`Missing "${field}" in ${filePath}`);
    }
  }

  const image = String(meta.image);
  const resolvedImage = wallpaperMap[image];
  if (!resolvedImage) {
    throw new Error(`Unknown wallpaper "${image}" in ${filePath}`);
  }

  return {
    ...meta,
    image: resolvedImage,
    content,
  } as PostFrontmatter & Post;
};

const sortByDateDesc = (a: Post, b: Post) => {
  const timeA = Date.parse(a.date);
  const timeB = Date.parse(b.date);

  if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
    return 0;
  }

  return timeB - timeA;
};

const allParsedPosts = Object.entries(markdownModules)
  .map(([filePath, raw]) => parseMarkdownFile(raw, filePath))
  .sort(sortByDateDesc);

const featuredCandidate = allParsedPosts.find((post) => post.featured) ?? allParsedPosts[0];

if (!featuredCandidate) {
  throw new Error("No blog posts were found in src/content/posts");
}

export const featuredPost: Post = featuredCandidate;
export const posts: Post[] = allParsedPosts.filter((post) => post.slug !== featuredPost.slug);
