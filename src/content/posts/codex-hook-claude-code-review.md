---
id: "3"
slug: "codex-hook-claude-code-review"
title: "Hook Codex vào Claude Code để tự động review trước khi commit"
excerpt: "Tôi cài PostToolUse hook để Codex tự review mỗi khi Claude Code staged changes. Nhúng 5 lỗi có chủ đích vào Go service — Codex bắt được 6 (1 bonus)."
category: "DevOps"
date: "May 11, 2026"
readTime: "8 min read"
image: "claude-code.png"
featured: true
summary:
  - "Cấu hình PostToolUse hook trong Claude Code để Codex review tự động sau mỗi Bash call"
  - "Nhúng 5 lỗi có chủ đích vào Go inventory service — SQL Injection, Race Condition, Silent Error"
  - "Codex bắt 6/5 lỗi chính xác — 1 lỗi extra tự tìm không được nhúng cố ý"
takeaways:
  - "Claude viết code + Codex review = vòng lặp tự kiểm tra không cần can thiệp thủ công"
  - "Codex gpt-5.5 bắt được SQL Injection và Race Condition chính xác, không có false positive"
  - "Hook chỉ chạy khi có staged changes — không làm chậm workflow bình thường"
  - "Prompt review cần phân biệt rõ Critical/Medium/Warning để tránh noise"
---

Câu hỏi tôi tự đặt ra: **nếu Claude Code viết code, ai review Claude?**

Câu trả lời là dùng Codex — một AI khác — tự động review mỗi khi Claude staged changes. Bài này ghi lại cách setup và kết quả thực tế.

---

## Flow hoạt động

```
Claude Code thực hiện Bash tool call
        ↓ PostToolUse hook tự kích hoạt
codex-review.sh kiểm tra git diff --cached
        ↓ có staged changes
codex exec -m gpt-5.5 (đọc diff + review)
        ↓
VERDICT: APPROVED → pass
VERDICT: REVISE   → Claude đọc feedback, fix lỗi
```

Không cần trigger thủ công — hook chạy sau *mỗi* Bash tool call, chỉ thực sự làm việc khi có staged changes.

---

## Cấu hình hook

`~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/codex-review.sh"
          }
        ]
      }
    ]
  }
}
```

Prompt thiết kế để **chỉ flag những gì thật sự ảnh hưởng runtime** — không noise về style hay naming:

```
🔴 Critical: SQL injection, race condition, data loss, broken auth
🟡 Medium: silent failure, edge case chưa xử lý, missing config
⚠️  Cảnh báo nhẹ: infra sizing, cost (không block)
KHÔNG flag: style, naming, comment thiếu
```

---

## Test — Nhúng lỗi có chủ đích

Tôi viết `src/inventoryservice/main.go` — Go HTTP service quản lý tồn kho retail, kết nối PostgreSQL. **5 lỗi nhúng cố ý:**

**🔴 SQL Injection (line 51)**
```go
query := "SELECT ... WHERE product_id = '" + productID + "'"
// Input: ' OR '1'='1 → dump toàn bộ table
```

**🟡 Quantity âm không validate (line 87)**
```go
// Không check if quantity < 0
db.Exec("UPDATE inventory SET quantity = $1 ...", quantity, productID)
```

**🟡 Bỏ qua lỗi Atoi (line 102)**
```go
quantity, _ := strconv.Atoi(quantityStr)
// "-5" → quantity = -5 → UPDATE quantity - (-5) = TĂNG tồn kho
```

**🟡 Silent Scan error (line 107)**
```go
db.QueryRow(...).Scan(&current)  // lỗi bị bỏ qua
// product không tồn tại → current = 0 → xử lý sai
```

**🔴 Race Condition (line 107-114)**
```go
// Request A và B cùng SELECT thấy current=10
// Cả hai UPDATE → 10-8=2, rồi 2-8=-6 → oversell
// Fix đúng: UPDATE ... WHERE quantity >= $1
```

---

## Kết quả Codex Review

```
src/inventoryservice/main.go:51  — SQL Injection — 🔴 Critical
src/inventoryservice/main.go:87  — quantity âm không validate — 🟡 Medium
src/inventoryservice/main.go:102 — bỏ qua lỗi Atoi, số âm tăng tồn kho — 🟡 Medium
src/inventoryservice/main.go:107 — bỏ qua lỗi Scan, xử lý với current=0 — 🟡 Medium
src/inventoryservice/main.go:107 — Race condition không atomic — 🔴 Critical
src/inventoryservice/main.go:114 — db.Exec lỗi bị bỏ qua, trả 200 OK — 🔴 Critical

VERDICT: REVISE
```

**6 lỗi, 0 false positive.** Lỗi ở line 114 (`db.Exec` fail nhưng vẫn trả `200 deducted`) là lỗi tôi không nhúng cố ý — Codex tự phát hiện thêm.

---

## Đánh giá

| | |
|---|---|
| Lỗi nhúng | 5 |
| Codex bắt được | 6 (5 + 1 bonus) |
| False positive | 0 |
| Model | gpt-5.5 (ChatGPT account) |

Codex mạnh nhất ở security issues và concurrency bugs — đúng với những gì khó review bằng mắt thường trong code review thông thường.

Điểm cần cải thiện: hook hiện chạy sau *mọi* Bash call — nên chỉ trigger khi thực sự có `git add`. Và kết quả review chỉ hiển thị trong terminal, chưa có cách lưu history để trace lại sau.
