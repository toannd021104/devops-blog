---
id: "4"
slug: "aws-rag-chatbot-terraform-pgvector"
title: "Dựng RAG chatbot trên AWS bằng Terraform, Lambda, RDS pgvector và React"
excerpt: "Ghi lại quá trình biến một RAG demo thành hệ thống có thể deploy, test, cải thiện UX, kiểm soát chi phí và destroy khi không dùng."
category: "AWS"
date: "May 20, 2026"
readTime: "9 min read"
image: "rag-aws-serverless.jpg"
summary:
  - "Kiến trúc RAG chatbot chạy trên API Gateway, Lambda, Cognito, S3, DynamoDB và RDS PostgreSQL pgvector"
  - "Các lỗi thực tế: answer bị hard-code, message role sai, duplicate documents, source khó kiểm chứng"
  - "Cách dùng Terraform để recreate/destroy stack và kiểm soát chi phí demo"
takeaways:
  - "RAG tốt không chỉ nằm ở model — metadata, retrieval filter và source citation quan trọng không kém"
  - "Dev environment vẫn phải có đường destroy rõ ràng vì RDS và NAT Gateway tốn tiền theo giờ"
  - "Khi Bedrock quota chưa sẵn sàng, extractive fallback vẫn giúp demo có câu trả lời grounded"
  - "UX của chatbot phải cho người dùng thấy tài liệu, nguồn trích dẫn và trạng thái indexing"
---

Tôi vừa dựng lại một **AWS RAG chatbot** từ đầu bằng Terraform. Mục tiêu không chỉ là “chatbot trả lời được”, mà là làm sao để nó giống một hệ thống DevOps thật hơn: deploy lại được, test được, debug được, biết nó đang tốn bao nhiêu tiền, và quan trọng nhất là **destroy sạch khi không dùng**.

Stack hiện tại gồm:

- React + Vite cho frontend
- S3 static website hosting
- Cognito User Pool cho đăng nhập
- API Gateway làm REST API
- Lambda cho upload, ingestion, chat, history
- S3 lưu raw documents
- RDS PostgreSQL + pgvector làm vector store
- DynamoDB lưu chat history
- Secrets Manager lưu database password
- Terraform quản lý toàn bộ infrastructure

Nghe khá nhiều service, nhưng đây là kiểu stack rất hay gặp khi biến RAG demo thành một tool nội bộ có auth, upload tài liệu, chat history và source citation.

---

## Vì sao không dùng demo đơn giản?

Demo RAG thường chỉ cần vài thứ:

1. upload file
2. chunk text
3. embedding
4. vector search
5. gọi LLM

Nhưng khi đưa cho user dùng thật, một loạt vấn đề xuất hiện ngay:

- User hỏi một câu rất cụ thể nhưng bot trả lời lan man.
- Bot không nói rõ lấy thông tin từ file nào.
- Upload trùng tài liệu làm retrieval nhiễu.
- User không biết tài liệu nào đã được index.
- Chat history không xóa được hoặc xóa nhầm chỗ.
- Message của user đôi khi bị render thành message của assistant.
- Dev stack để qua đêm là RDS + NAT Gateway tiếp tục tính tiền.

Vì vậy tôi chọn hướng làm lại có kiểm soát hơn: **IaC trước, pipeline ingestion rõ ràng, metadata đầy đủ, UX có evidence, và smoke test sau deploy**.

---

## Kiến trúc hiện tại

Luồng chính của hệ thống:

```text
User
  ↓
React frontend trên S3 website
  ↓ Cognito JWT
API Gateway
  ├── /upload  → upload_handler Lambda → presigned S3 POST
  ├── /chat    → chat_handler Lambda → pgvector retrieval → answer
  └── /history → chat_history Lambda → DynamoDB

S3 document upload
  ↓ event
document_ingestion Lambda
  ↓ extract text + chunk + embedding
RDS PostgreSQL pgvector
```

Terraform chia module theo boundary:

```text
terraform/modules/
  api_gateway/
  cognito/
  dynamodb/
  iam/
  lambda/
  rds_postgres/
  s3/
  vpc/
```

Điểm quan trọng là Lambda chat và ingestion nằm trong VPC để truy cập RDS private. Vì Lambda vẫn cần gọi AWS service bên ngoài, stack có NAT Gateway. Đây là phần tiện nhưng cũng là phần phải để ý chi phí.

---

## Document ingestion: metadata quan trọng hơn tưởng tượng

Ban đầu chỉ lưu `document_key`, `chunk_text`, `embedding`. Như vậy chạy demo được, nhưng debug và phân quyền rất khó.

Tôi bổ sung metadata cho mỗi chunk:

```json
{
  "bucket": "rag-chatbot-documents-xxxx",
  "document_key": "uploads/user-id/file.txt",
  "user_id": "user-id",
  "original_filename": "file.txt",
  "content_hash": "sha256...",
  "chunk_index": 0,
  "total_chunks": 5,
  "chunk_size_chars": 1200,
  "ingested_at": "2026-05-20T..."
}
```

Metadata này giải quyết nhiều việc cùng lúc:

- filter retrieval theo `user_id`
- hiện tên file sạch trên UI
- biết chunk nằm ở vị trí nào
- chống upload trùng bằng `content_hash`
- dễ log và debug retrieval

Duplicate detection được làm bằng normalized content hash. Nếu user upload cùng một nội dung với tên file khác, ingestion sẽ bỏ qua bản trùng để giảm nhiễu retrieval và giảm storage thừa.

---

## Retrieval: đừng để vector search quyết định tất cả

Vector search tốt cho semantic similarity, nhưng không phải lúc nào cũng đủ. Với câu hỏi có keyword cụ thể như service name, mã sản phẩm, EKS, Docker, IAM, một chunk “ngữ nghĩa gần” có thể vẫn sai tài liệu.

Tôi dùng hybrid scoring đơn giản:

- vector score từ pgvector
- lexical overlap score từ query terms
- exact term boost nhẹ
- diversify để không lấy quá nhiều chunk từ cùng một document group

Ngoài ra retrieval chỉ lấy chunk của đúng user:

```sql
WHERE metadata->>'user_id' = :current_user_id
```

Đây là guardrail bắt buộc. Nếu không có filter này, user A có thể vô tình retrieve document của user B nếu cùng nằm trong một bảng vector.

---

## Lỗi trả lời sai: hard-code fallback là con dao hai lưỡi

Một lỗi thực tế tôi gặp: bot cứ trả lời nguyên một template “Proposed technical architecture...” dù user hỏi câu khác như:

```text
what is nova health tech challenge
```

Nguyên nhân là fallback backend có logic kiểu:

```python
if query contains architecture/propose/pipeline:
    return fixed architecture proposal
```

Khi retrieval context có nhiều đoạn liên quan architecture, fallback này quá mạnh và làm bot trả lời sai ngữ cảnh.

Cách sửa:

- bỏ template hard-code dài
- ưu tiên extractive answer từ context thật
- chỉ dùng fallback có scope hẹp cho các câu như `challenge`, `scenario`, `requirements`
- nếu không có context thì nói rõ không tìm thấy trong uploaded documents

Kết quả smoke test sau đó:

```text
Question: what is nova health tech challenge

Answer:
Nova Health Tech's challenge:
- Nova Health Tech challenge
- The flagship clinical support tool is struggling to meet physician expectations for speed and medical relevance.

Source:
nova-smoke.txt · Chunk 1
```

Đó là hành vi tốt hơn nhiều: ngắn, đúng câu hỏi, có nguồn.

---

## UX: RAG cần evidence, không chỉ chat bubble

Một chatbot nội bộ mà không cho xem source thì rất khó tin. Tôi cải thiện UI theo hướng:

- trang upload hiện danh sách tài liệu đã upload
- mỗi answer có evidence drawer
- source hiển thị tên file và chunk locator
- có score “evidence match”
- chat history có xóa từng conversation
- `Delete all` chỉ nằm trong sidebar, không nằm ngoài main header
- message normalize cả `type` và `message_type`

Bug message role cũng khá điển hình. Backend DynamoDB lưu `message_type`, frontend lại đọc `type`, nên một số message user bị fallback thành assistant. Fix đơn giản là normalize:

```ts
const rawType = message.type || message.message_type || "assistant";
const type = rawType === "user" ? "user" : "assistant";
```

Nhỏ nhưng ảnh hưởng UX rất lớn.

---

## Deploy lại từ zero

Flow deploy dev hiện tại:

```bash
./scripts/build-lambda-packages.sh

terraform -chdir=terraform init
terraform -chdir=terraform plan -out=tfplan
terraform -chdir=terraform apply tfplan

npm --prefix src/web run build
aws s3 sync src/web/build s3://<web-bucket-name> --delete
```

Sau apply, Terraform output trả ra:

- API Gateway URL
- Cognito User Pool ID
- Cognito Client ID
- document bucket
- web bucket
- RDS endpoint
- VPC ID

Frontend `.env` phải trỏ đúng API/Cognito mới trước khi build. Nếu rebuild stack mà quên đổi `.env`, frontend vẫn gọi API cũ đã destroy.

---

## Smoke test sau deploy

Tôi không tin deploy chỉ vì Terraform báo success. Smoke test tối thiểu gồm:

```bash
aws lambda get-function \
  --function-name rag-chatbot-chat-handler-<suffix> \
  --region us-east-1
```

Gọi chat khi chưa có document:

```bash
aws lambda invoke \
  --function-name rag-chatbot-chat-handler-<suffix> \
  --cli-binary-format raw-in-base64-out \
  --payload '{"requestContext":{"authorizer":{"sub":"smoke-user","email":"smoke@example.com"}},"body":"{\"query\":\"hello\"}"}' \
  /tmp/chat-smoke-response.json
```

Expected: bot nói không tìm thấy thông tin trong uploaded documents.

Sau đó upload một file nhỏ:

```bash
aws s3 cp /tmp/nova-smoke.txt \
  s3://<document-bucket>/uploads/smoke-user/nova-smoke.txt
```

Invoke ingestion:

```bash
aws lambda invoke \
  --function-name rag-chatbot-document-ingestion-<suffix> \
  --cli-binary-format raw-in-base64-out \
  --payload '{"Records":[{"eventSource":"aws:s3","s3":{"bucket":{"name":"<document-bucket>"},"object":{"key":"uploads/smoke-user/nova-smoke.txt"}}}]}' \
  /tmp/ingest-smoke-response.json
```

Rồi hỏi lại document-specific question. Nếu answer có source đúng file, retrieval path đã chạy ổn.

---

## Chi phí: RDS + NAT Gateway là phần phải canh

Ở dev stack hiện tại, cost đáng kể nhất là:

- RDS PostgreSQL `db.t3.medium`
- NAT Gateway
- RDS storage

Ước tính demo khoảng **0.12 USD/giờ** trước traffic lớn. Lambda, API Gateway, DynamoDB, S3, Cognito ở mức demo thường nhỏ hơn nhiều.

Bài học là: với dev environment, `destroy` cũng là một phần của workflow.

```bash
terraform -chdir=terraform destroy
```

Khi destroy, Lambda VPC ENI có thể giữ subnet/security group khá lâu. Nếu Terraform fail vì dependency, kiểm tra ENI, đợi AWS release, rồi chạy destroy lại. Đừng tự detach `ela-attach` của Lambda vì AWS không cho quản lý trực tiếp loại attachment đó.

---

## Những gì nên làm tiếp

Nếu đưa project này đi xa hơn, tôi sẽ làm tiếp các phần sau:

- GitHub Actions cho lint, test, Terraform fmt/validate/plan
- CloudFront trước S3 website
- CloudWatch dashboard cho API latency, Lambda errors, ingestion failures
- alarm cho 5xx, timeout, RDS CPU/storage
- retrieval evaluation test set
- lifecycle rule cho raw document bucket
- tách dev/staging/prod state backend
- request Bedrock model access/quota để bỏ dần extractive fallback

---

## Kết luận

RAG chatbot muốn dùng được trong nội bộ doanh nghiệp cần nhiều thứ hơn một vector database và một LLM call.

Trong project này, cải thiện lớn nhất đến từ các phần rất DevOps:

- infrastructure reproducible bằng Terraform
- metadata rõ ràng
- user-level access filtering
- smoke test sau deploy
- UI có evidence
- cost awareness
- destroy hygiene

Model tốt giúp câu trả lời mượt hơn, nhưng **hệ thống tốt** mới giúp chatbot đáng tin và vận hành được.
