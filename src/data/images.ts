// Map tất cả ảnh trong wallpapers — dùng để resolve ảnh inline trong markdown
const imageModules = import.meta.glob("../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

// Map ảnh trong posts subfolders
const postImageModules = import.meta.glob("../assets/posts/**/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const allImages = Object.fromEntries(
  [
    ...Object.entries(imageModules),
    ...Object.entries(postImageModules),
  ].map(([filePath, assetUrl]) => [
    filePath.split("/").pop() ?? filePath,
    assetUrl,
  ])
);
