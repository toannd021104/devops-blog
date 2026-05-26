// Map ảnh inline trong markdown. Wallpapers chỉ dùng cho cover/hero,
// còn ảnh riêng của từng bài nằm trong assets/posts/<post-slug>/.
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
  ].flatMap(([filePath, assetUrl]) => {
    const filename = filePath.split("/").pop() ?? filePath;
    const markdownPath = filePath.replace("../assets/", "../../assets/");

    return [
      [filename, assetUrl],
      [markdownPath, assetUrl],
    ];
  })
);
