# DevOps & Cloud Blog

Blog cá nhân chia sẻ kiến thức về DevOps, Cloud, Kubernetes, Docker, CI/CD và các công nghệ liên quan.

Built with [Hugo](https://gohugo.io/) and [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme.

## Tính năng

- ✅ Responsive design
- ✅ Dark/Light mode
- ✅ Search functionality
- ✅ Series bài viết có hệ thống
- ✅ Categories và Tags
- ✅ Syntax highlighting
- ✅ Fast loading
- ✅ SEO optimized
- ✅ Auto deploy với GitHub Actions

## Local Development

### Prerequisites

- Hugo Extended v0.92.2 trở lên
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/devops-blog.git
cd devops-blog

# Clone theme
git submodule update --init --recursive

# Start development server
hugo server -D

# Build for production
hugo --minify
```

Server sẽ chạy tại: `http://localhost:1313`

## Tạo bài viết mới

```bash
# Tạo bài viết mới
hugo new posts/ten-bai-viet.md

# Edit file tại: content/posts/ten-bai-viet.md
```

### Front Matter mẫu

```yaml
---
title: "Tiêu đề bài viết"
date: 2024-01-15T09:00:00+07:00
draft: false
author: "Your Name"
description: "Mô tả ngắn gọn"
categories: ["Kubernetes", "Docker"]
tags: ["k8s", "devops", "container"]
series: ["Kubernetes từ Cơ Bản đến Nâng Cao"]
showToc: true
TocOpen: true
---
```

## Deploy lên GitHub Pages

### Bước 1: Tạo GitHub Repository

```bash
# Trong thư mục blog
git add .
git commit -m "Initial commit: Setup Hugo blog"

# Tạo repo trên GitHub với tên: devops-blog
# Sau đó push:
git branch -M main
git remote add origin https://github.com/yourusername/devops-blog.git
git push -u origin main
```

### Bước 2: Enable GitHub Pages

1. Vào **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: Chọn `gh-pages` hoặc để GitHub Actions tự động deploy
4. Click **Save**

### Bước 3: Configure GitHub Actions

1. Vào **Settings** → **Actions** → **General**
2. **Workflow permissions**: Chọn "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"
4. **Save**

### Bước 4: Update Config

Sửa file [config.toml](config.toml):

```toml
baseURL = 'https://yourusername.github.io/devops-blog/'
```

Thay `yourusername` bằng GitHub username của bạn.

### Bước 5: Push và Deploy

```bash
git add .
git commit -m "Update baseURL"
git push
```

GitHub Actions sẽ tự động build và deploy blog.

Truy cập blog tại: `https://yourusername.github.io/devops-blog/`

## Cấu trúc thư mục

```
devops-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── archetypes/
│   └── posts.md                # Template cho bài viết mới
├── content/
│   ├── posts/                  # Bài viết
│   │   ├── kubernetes-series-01-gioi-thieu.md
│   │   ├── kubernetes-series-02-cai-dat.md
│   │   └── docker-best-practices.md
│   └── archives.md             # Trang archive
├── themes/
│   └── PaperMod/               # Theme (git submodule)
├── config.toml                 # Config chính
├── .gitignore
└── README.md
```

## Customization

### Thay đổi thông tin cá nhân

Edit [config.toml](config.toml):

```toml
title = 'Your Blog Name'

[params.homeInfoParams]
  Title = "Your Blog Title"
  Content = "Your description"

[[params.socialIcons]]
  name = "github"
  url = "https://github.com/yourusername"

[[params.socialIcons]]
  name = "linkedin"
  url = "https://linkedin.com/in/yourusername"

[[params.socialIcons]]
  name = "email"
  url = "mailto:your.email@example.com"
```

### Thêm Google Analytics

```toml
[services.googleAnalytics]
  ID = 'G-XXXXXXXXXX'
```

### Thay đổi theme colors

Tạo file `assets/css/extended/custom.css`:

```css
:root {
    --primary: #1e90ff;
    --secondary: #ffa500;
}
```

## Useful Commands

```bash
# Tạo bài viết mới
hugo new posts/my-new-post.md

# Start dev server
hugo server -D

# Build
hugo

# Build with minify
hugo --minify

# Check version
hugo version

# Update theme
git submodule update --remote --merge
```

## Troubleshooting

### Build failed

```bash
# Update submodules
git submodule update --init --recursive

# Clear Hugo cache
hugo --cleanDestinationDir
```

### Theme not found

```bash
# Re-initialize submodules
git submodule update --init --recursive
```

## Resources

- [Hugo Documentation](https://gohugo.io/documentation/)
- [PaperMod Wiki](https://github.com/adityatelange/hugo-PaperMod/wiki)
- [Hugo Community](https://discourse.gohugo.io/)

## License

Content: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

Theme: [MIT License](https://github.com/adityatelange/hugo-PaperMod/blob/master/LICENSE)

---

Made with ❤️ using [Hugo](https://gohugo.io/) and [PaperMod](https://github.com/adityatelange/hugo-PaperMod)
