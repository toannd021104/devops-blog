// Map tất cả ảnh trong wallpapers — dùng để resolve ảnh inline trong markdown
const imageModules = import.meta.glob("../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const allImages = Object.fromEntries(
  Object.entries(imageModules).map(([filePath, assetUrl]) => [
    filePath.split("/").pop() ?? filePath,
    assetUrl,
  ])
);
