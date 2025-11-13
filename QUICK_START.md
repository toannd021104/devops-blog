# Quick Start Guide

## 🎯 Deploy Blog lên GitHub Pages trong 5 phút

### Bước 1: Tạo GitHub Repository

1. Vào [GitHub](https://github.com) → **New repository**
2. **Repository name**: `devops-blog`
3. Chọn **Public**
4. **KHÔNG** tick "Add README"
5. Click **Create repository**

### Bước 2: Update Config

Sửa file `config.toml` (dòng 1):

```toml
baseURL = 'https://YOUR-USERNAME.github.io/devops-blog/'
```

**Thay `YOUR-USERNAME`** bằng GitHub username của bạn.

### Bước 3: Update thông tin cá nhân

Sửa file `config.toml` (dòng 80-116):

```toml
[params.homeInfoParams]
  Title = "Tên Blog của bạn"
  Content = "Mô tả về bạn..."

[[params.socialIcons]]
  name = "github"
  url = "https://github.com/your-username"

[[params.socialIcons]]
  name = "linkedin"
  url = "https://linkedin.com/in/your-profile"

[[params.socialIcons]]
  name = "email"
  url = "mailto:your.email@example.com"
```

### Bước 4: Push lên GitHub

```bash
cd /home/ubuntu/devops-blog

# Add all files
git add .

# Commit
git commit -m "Initial commit: DevOps blog setup"

# Link với GitHub repo (THAY YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/devops-blog.git

# Push
git branch -M main
git push -u origin main
```

### Bước 5: Enable GitHub Pages

1. Vào repo → **Settings** → **Pages**
2. **Source**: GitHub Actions
3. **Save**

### Bước 6: Configure Permissions

1. Vào **Settings** → **Actions** → **General**
2. Scroll xuống **Workflow permissions**
3. Chọn "**Read and write permissions**"
4. Check "**Allow GitHub Actions to create and approve pull requests**"
5. Click **Save**

### Bước 7: Trigger Deploy

GitHub Actions sẽ tự động chạy sau khi push. Hoặc trigger manually:

1. Vào tab **Actions**
2. Click workflow "**Deploy Hugo site to GitHub Pages**"
3. Click **Run workflow** → **Run workflow**

Đợi 1-2 phút để build xong.

### Bước 8: Truy cập Blog

Blog của bạn sẽ có tại:

```
https://YOUR-USERNAME.github.io/devops-blog/
```

## 📝 Tạo bài viết mới

```bash
cd /home/ubuntu/devops-blog

# Tạo bài mới
hugo new posts/ten-bai-viet-cua-ban.md

# Edit file
nano content/posts/ten-bai-viet-cua-ban.md
```

**Template:**

```yaml
---
title: "Tiêu đề bài viết"
date: 2024-01-15T09:00:00+07:00
draft: false
author: "Tên bạn"
description: "Mô tả ngắn"
categories: ["Docker"]
tags: ["docker", "devops"]
series: []
showToc: true
TocOpen: true
---

## Giới thiệu

Nội dung bài viết...
```

**Quan trọng:**
- `draft: false` - Để bài viết hiển thị public
- `categories` - Chủ đề chính (Docker, Kubernetes, Cloud, CI/CD...)
- `tags` - Tags chi tiết
- `series` - Nếu bài viết thuộc 1 series

### Push bài viết mới

```bash
git add content/posts/ten-bai-viet-cua-ban.md
git commit -m "Add: Bài viết về XXX"
git push
```

GitHub Actions sẽ tự động deploy!

## 🧪 Test local

```bash
cd /home/ubuntu/devops-blog

# Start server
hugo server -D

# Hoặc với bind tất cả interfaces
hugo server --bind=0.0.0.0 -D
```

Truy cập: `http://localhost:1313/devops-blog/`

## 📂 Cấu trúc Blog

```
devops-blog/
├── .github/workflows/
│   └── deploy.yml              ← GitHub Actions (auto deploy)
├── content/posts/
│   ├── kubernetes-series-01-gioi-thieu.md
│   ├── kubernetes-series-02-cai-dat.md
│   ├── docker-best-practices.md
│   └── github-actions-cicd.md  ← Bài viết mẫu
├── config.toml                 ← Config chính (QUAN TRỌNG!)
└── README.md                   ← Hướng dẫn đầy đủ
```

## 🎨 Tính năng có sẵn

- ✅ **Menu**: Trang chủ, Bài viết, Chủ đề, Series, Tags, Archive
- ✅ **Series**: Nhóm bài viết theo series (VD: Kubernetes từ cơ bản đến nâng cao)
- ✅ **Search**: Tìm kiếm bài viết
- ✅ **Dark/Light mode**: Tự động theo system
- ✅ **Syntax highlighting**: Code blocks đẹp
- ✅ **TOC**: Table of contents tự động
- ✅ **SEO**: Optimized cho Google
- ✅ **Fast**: Load nhanh, responsive

## 🔧 Customization

### Đổi màu theme

Tạo file `assets/css/extended/custom.css`:

```css
:root {
    --primary: #1e90ff;
}
```

### Add Google Analytics

Thêm vào `config.toml`:

```toml
[services.googleAnalytics]
  ID = 'G-XXXXXXXXXX'
```

### Đổi font

Thêm vào `assets/css/extended/custom.css`:

```css
body {
    font-family: 'Inter', -apple-system, sans-serif;
}
```

## ❓ Troubleshooting

### Blog không hiển thị sau push

1. Check Actions: `https://github.com/YOUR-USERNAME/devops-blog/actions`
2. Xem có lỗi không
3. Verify permissions (Bước 6)

### 404 Not Found

- Check `baseURL` trong `config.toml`
- Phải đúng format: `https://username.github.io/devops-blog/`

### Theme không load

```bash
cd /home/ubuntu/devops-blog
git submodule update --init --recursive
```

## 📚 Next Steps

1. **Viết thêm bài**: Share kiến thức của bạn!
2. **Tùy chỉnh**: Đổi màu, font, layout
3. **Add domain**: Dùng custom domain (VD: blog.yourdomain.com)
4. **Analytics**: Theo dõi traffic với Google Analytics
5. **Comments**: Thêm Disqus hoặc Giscus

## 🎓 Learn More

- [Hugo Docs](https://gohugo.io/documentation/)
- [PaperMod Wiki](https://github.com/adityatelange/hugo-PaperMod/wiki)
- [Markdown Guide](https://www.markdownguide.org/)

---

**Chúc bạn viết blog vui vẻ!** 🚀

Có vấn đề? Xem [README.md](README.md) để biết chi tiết hơn.
