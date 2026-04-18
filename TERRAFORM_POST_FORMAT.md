# PROMPT TEMPLATE - TERRAFORM ASSOCIATE SERIES

## Cách dùng
Copy prompt bên dưới, điền vào các phần [ĐIỀN VÀO ĐÂY], và gửi cho Claude để tạo bài viết mới.

---

## PROMPT TEMPLATE

```
Viết bài "[ĐIỀN TIÊU ĐỀ BÀI VIẾT]" cho series Terraform Associate.

### Thông tin bài viết:
- Title: "Terraform Associate - [ĐIỀN TIÊU ĐỀ]"
- Date: 2025-11-[ĐIỀN NGÀY]T01:00:00+07:00
- Tags: ["terraform", "[TAG1]", "[TAG2]", "devops", "automation"]
- Description: "[ĐIỀN MÔ TẢ NGẮN GỌN]"

### Nội dung cần cover:
[ĐIỀN CÁC ĐIỂM CHÍNH CẦN NÓI ĐẾN]
- Điểm 1: ...
- Điểm 2: ...
- Điểm 3: ...

### Yêu cầu format:
- Viết bằng tiếng Việt
- Không dùng emoji icons (✅, ❌, 🔍), chỉ dùng → cho luồng/kết quả
- Code blocks có syntax highlighting (```hcl, ```bash, ```yaml)
- Có ví dụ so sánh (traditional vs Terraform, before vs after)
- Có ví dụ thực tế minh họa
- Tất cả headings phải bằng tiếng Việt

### Cấu trúc:
1. Giới thiệu (2-3 đoạn)
2. [3-5 sections chính - tùy nội dung]
3. Tổng kết
4. Resources

Tạo file markdown hoàn chỉnh theo format trên.
```

---

## VÍ DỤ PROMPT ĐÃ ĐIỀN

### Example 1: Terraform State

```
Viết bài "Terraform State Management" cho series Terraform Associate.

### Thông tin bài viết:
- Title: "Terraform Associate - Terraform State Management"
- Date: 2025-11-16T01:00:00+07:00
- Tags: ["terraform", "state", "state-management", "devops", "automation"]
- Description: "Tìm hiểu về Terraform State, cách quản lý state file, remote backend, và best practices"

### Nội dung cần cover:
- Terraform State là gì và tại sao cần thiết
- State file structure và nội dung
- Local vs Remote state
- State locking và concurrency
- Remote backends (S3, Terraform Cloud, Consul)
- State commands (terraform state list, mv, rm, show)
- Best practices và security considerations

### Yêu cầu format:
- Viết bằng tiếng Việt
- Không dùng emoji icons (✅, ❌, 🔍), chỉ dùng → cho luồng/kết quả
- Code blocks có syntax highlighting (```hcl, ```bash, ```yaml)
- Có ví dụ so sánh (local vs remote state)
- Có ví dụ thực tế về S3 backend configuration
- Tất cả headings phải bằng tiếng Việt

### Cấu trúc:
1. Giới thiệu
2. Terraform State là gì?
3. Local vs Remote State
4. Remote Backends
5. State Commands
6. Best Practices
7. Tổng kết
8. Resources

Tạo file markdown hoàn chỉnh theo format trên.
```

### Example 2: Terraform Variables

```
Viết bài "Terraform Variables và Input/Output" cho series Terraform Associate.

### Thông tin bài viết:
- Title: "Terraform Associate - Variables và Input/Output"
- Date: 2025-11-17T01:00:00+07:00
- Tags: ["terraform", "variables", "input", "output", "devops"]
- Description: "Tìm hiểu cách sử dụng variables, input variables, output values trong Terraform"

### Nội dung cần cover:
- Input Variables (variable blocks)
- Variable types (string, number, bool, list, map, object)
- Variable definition methods (.tfvars, CLI, environment variables)
- Variable validation
- Output values
- Sensitive data handling
- Local values

### Yêu cầu format:
- Viết bằng tiếng Việt
- Không dùng emoji icons (✅, ❌, 🔍), chỉ dùng → cho luồng/kết quả
- Code blocks có syntax highlighting (```hcl, ```bash)
- Có ví dụ thực tế cho từng loại variable
- So sánh các cách define variables
- Tất cả headings phải bằng tiếng Việt

### Cấu trúc:
1. Giới thiệu
2. Input Variables
3. Variable Types
4. Cách định nghĩa Variables
5. Output Values
6. Sensitive Data
7. Tổng kết
8. Resources

Tạo file markdown hoàn chỉnh theo format trên.
```

---

## QUY TẮC FORMAT CỐ ĐỊNH (Không thay đổi)

### 1. Style Requirements
- ✓ Viết bằng tiếng Việt
- ✗ KHÔNG dùng emoji icons (✅, ❌, 🔍)
- ✓ Dùng → cho luồng/kết quả
- ✓ All headings bằng tiếng Việt
- ✓ Professional tone

### 2. Code Blocks
- Luôn có syntax highlighting: ```hcl, ```bash, ```yaml
- Comment giải thích khi cần
- Indent đúng chuẩn

### 3. Content Structure
- Giới thiệu (2-3 đoạn)
- 3-5 sections chính
- Có ví dụ so sánh (before/after, traditional vs Terraform)
- Tổng kết với recap
- Resources links

### 4. Frontmatter (Cố định)
```yaml
---
title: "Terraform Associate - [Tiêu đề]"
date: 2025-11-[ngày]T01:00:00+07:00
draft: false
tags: ["terraform", "[tags...]", "devops", "automation"]
categories: ["DevOps", "Terraform"]
series: ["Terraform Associate"]
description: "[Mô tả ngắn]"
ShowToc: true
TocOpen: true
---
```

---

## QUICK REFERENCE

### Checklist khi dùng prompt:
- [ ] Điền tiêu đề bài viết
- [ ] Điền date (format: 2025-11-[ngày]T01:00:00+07:00)
- [ ] Điền tags phù hợp
- [ ] List ra các điểm chính cần cover
- [ ] Xác định cấu trúc sections (3-5 sections)

### Common Topics cho Terraform Associate:
- Terraform State Management
- Variables và Input/Output
- Terraform Providers
- Resource Dependencies
- Terraform Modules
- Provisioners
- Workspaces
- Best Practices & Security
