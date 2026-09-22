---
id: "13"
slug: "aws-dopc02-section-1-iam-access-analyzer"
title: "AWS DOP-C02: Section 1 - IAM | Part 3: IAM Access Analyzer"
excerpt: "Hiểu cách IAM Access Analyzer dùng automated reasoning để phát hiện external access và unused permission trong tài khoản AWS."
category: "AWS DOP-C02"
date: "Jun 21, 2026"
readTime: "8 min read"
image: "dvp-c02.png"
summary:
  - "Access Analyzer dùng automated reasoning để tìm resource được chia sẻ ra ngoài zone of trust"
  - "Có hai loại analyzer chính: External Access Analyzer và Unused Access Analyzer"
  - "Access Analyzer chỉ phát hiện và cảnh báo, không tự động chặn hay sửa policy"
takeaways:
  - "Zone of trust là account hoặc organization mà bạn định nghĩa, mọi truy cập ngoài phạm vi này đều bị flag"
  - "Finding không có nghĩa là sai, mà là cần được review để xác nhận Intended hay Unintended"
  - "Unused Access Analyzer hỗ trợ trực tiếp cho nguyên tắc least privilege"
  - "Policy validation và policy generation là hai tính năng đi kèm giúp viết policy an toàn hơn ngay từ đầu"
---

Ở hai bài trước, mình đã đi qua **IAM Identity** và **IAM Policy** — hai thứ quyết định *ai* được làm *gì*. Nhưng trong thực tế vận hành, câu hỏi khó trả lời nhất không phải là "policy này đúng cú pháp không", mà là **"tài nguyên của tôi có đang bị chia sẻ ra ngoài mà tôi không biết không?"**

Đây chính là bài toán mà **IAM Access Analyzer** được sinh ra để giải quyết.

**IAM Access Analyzer** là dịch vụ phân tích các resource-based policy và một số cấu hình chia sẻ khác, để phát hiện resource nào đang được truy cập từ **bên ngoài phạm vi tin cậy (zone of trust)** mà bạn định nghĩa.

Điểm khác biệt lớn nhất so với việc đọc policy bằng tay: Access Analyzer dùng **automated reasoning** — một kỹ thuật suy luận dựa trên logic toán học (formal verification), tương tự công nghệ đứng sau AWS Zelkova. Nó không đoán, nó **chứng minh** được đường nào trong policy dẫn tới truy cập ngoài mong muốn.

![Access Analyzer so sánh policy với zone of trust để sinh finding](https://claude.ai/assets/posts/aws-dopc02/section-1-iam-access-analyzer/access-analyzer-overview.png)

DOP-C02 thường hỏi về Access Analyzer ở dạng: cho một tình huống rò rỉ quyền truy cập, chọn dịch vụ nào phát hiện được sớm nhất, hoặc phân biệt Access Analyzer với các tool tương tự như IAM Policy Simulator, Trusted Advisor, Security Hub.

## Zone of trust là gì?

Trước khi tạo analyzer, bạn phải chọn **zone of trust**:

- **Account**: chỉ tin tưởng chính account đó, mọi truy cập từ account khác đều bị flag.
- **Organization**: tin tưởng toàn bộ AWS Organizations, chỉ flag truy cập từ **bên ngoài organization**.

```
Zone of trust = Account
→ Account B truy cập resource ở Account A trong cùng Organization vẫn bị flag là external.

Zone of trust = Organization
→ Account B truy cập resource ở Account A trong cùng Organization KHÔNG bị flag.
→ Chỉ account ngoài Organization mới bị flag.
```

Đây là điểm dễ gây nhầm trong exam: **cùng Organization không đồng nghĩa với "an toàn"** nếu analyzer của bạn được tạo ở mức account.

## Hai loại analyzer chính

### 1. External Access Analyzer

Quét các **resource-based policy** và cấu hình chia sẻ trên các service sau, tìm principal nằm ngoài zone of trust:

```
S3 bucket policy
IAM role trust policy
KMS key policy
Lambda function policy
SQS queue policy
Secrets Manager secret policy
SNS topic policy
EFS file system policy
RDS DB snapshot / DB cluster snapshot
ECR repository (private)
```

Mỗi khi phát hiện một truy cập nằm ngoài zone of trust, Access Analyzer sinh ra một **finding** gồm: resource nào, principal nào, action nào, điều kiện nào cho phép truy cập đó.

```
{
  "resourceType": "AWS::S3::Bucket",
  "resource": "arn:aws:s3:::shared-artifacts",
  "principal": "arn:aws:iam::999999999999:role/ExternalReadRole",
  "action": ["s3:GetObject"],
  "isPublic": false,
  "status": "ACTIVE"
}
```

Với mỗi finding, bạn có hai lựa chọn:

- **Archive**: nếu truy cập đó là **có chủ đích** (Intended) — ví dụ chia sẻ artifact cho đối tác.
- **Xử lý / thu hồi**: nếu truy cập đó là **ngoài ý muốn** (Unintended) — sửa policy để loại bỏ quyền dư thừa.

Bạn cũng có thể tạo **archive rule** để tự động archive các finding khớp điều kiện định sẵn, tránh phải review lại thủ công mỗi lần finding mới xuất hiện do thay đổi nhỏ trong policy.

### 2. Unused Access Analyzer

Khác với External Access Analyzer (nhìn resource-based policy), **Unused Access Analyzer** nhìn vào **identity-based policy** và hoạt động thực tế để tìm quyền **được cấp nhưng không dùng tới**, gồm:

```
Unused permission: action được allow nhưng chưa từng được gọi
Unused role: role được tạo nhưng không được assume trong khoảng thời gian cấu hình
Unused access key: access key không được dùng
Unused password: IAM user có password nhưng không đăng nhập
```

Bạn cấu hình một **tracking period** (ví dụ 90 ngày). Nếu một quyền không được sử dụng trong khoảng thời gian đó, finding sẽ được sinh ra, giúp bạn dọn dẹp permission theo đúng nguyên tắc **least privilege**.

> **Mental model**: External Access Analyzer trả lời "ai đang vào được tài nguyên của tôi từ bên ngoài?". Unused Access Analyzer trả lời "tôi đang cấp thừa quyền gì cho chính identity của mình?".

## Hai tính năng đi kèm: Policy Validation và Policy Generation

Ngoài việc phát hiện finding trên resource đã tồn tại, Access Analyzer còn hỗ trợ ngay **lúc viết policy**:

- **Policy validation**: tích hợp trực tiếp trong IAM console và CLI (`validate-policy`). Kiểm tra cú pháp JSON, đồng thời cảnh báo các vấn đề bảo mật như policy quá rộng (`"Resource": "*"` với action nhạy cảm), hoặc policy không tuân theo best practice của AWS.
- **Policy generation**: dựa trên **CloudTrail log** thực tế của một IAM role hoặc user trong một khoảng thời gian, Access Analyzer sinh ra một **least-privilege policy** chỉ chứa đúng những action đã thực sự được gọi.

```
Quy trình dùng Policy Generation:
1. Chọn IAM role cần thu hẹp quyền
2. Chọn khoảng thời gian CloudTrail để phân tích (ví dụ 30 ngày gần nhất)
3. Access Analyzer trả về policy mới, chỉ chứa action đã dùng
4. Review và thay thế policy cũ
```

Đây là câu trả lời trực tiếp cho tình huống thi hay gặp: *"Làm sao thu hẹp quyền của một role đang có quyền quá rộng mà không làm gián đoạn ứng dụng đang chạy?"*

## Access Analyzer KHÔNG làm gì

DOP-C02 hay đánh lừa bằng cách gợi ý Access Analyzer có thể tự động chặn hoặc sửa policy. Cần nhớ:

Access Analyzer làm được
Access Analyzer KHÔNG làm được

Phát hiện (detect) external access và unused access
Tự động chặn (block) truy cập

Cảnh báo lỗi cú pháp/bảo mật khi viết policy
Tự động sửa policy đang áp dụng

Sinh gợi ý policy least-privilege
Tự động deploy policy mới

Chạy liên tục, tái đánh giá khi policy thay đổi
Thay thế SCP hoặc permissions boundary

Nếu đề bài yêu cầu **ngăn chặn** ngay lập tức (preventive control), câu trả lời đúng thường là **SCP** hoặc **permissions boundary**, không phải Access Analyzer — vì Access Analyzer thuộc nhóm **detective control**.

## Ví dụ thực tế: phát hiện S3 bucket bị public do nhầm

Bài toán:

```
Một S3 bucket chứa dữ liệu nội bộ vô tình bị gắn bucket policy cho phép Principal: "*".
```

Với zone of trust là Organization, Access Analyzer sẽ:

1. Đọc bucket policy, phát hiện `Principal: "*"` không nằm trong zone of trust.
2. Sinh finding với `isPublic: true`.
3. Gửi cảnh báo qua **EventBridge** (Access Analyzer publish finding dưới dạng event), có thể tích hợp với **Security Hub**, **Chatbot** hoặc **SNS** để báo động tự động.

```
{
  "resourceType": "AWS::S3::Bucket",
  "resource": "arn:aws:s3:::internal-reports",
  "isPublic": true,
  "condition": {},
  "status": "ACTIVE"
}
```

Vì đây là finding nghiêm trọng (public access), đội security nên **xử lý ngay** thay vì archive, đồng thời rà lại vì sao policy bị đổi — thường liên quan tới một CI/CD pipeline deploy nhầm policy.

## So sánh nhanh Access Analyzer với các tool liên quan

Tool
Mục đích chính
Loại control

IAM Access Analyzer
Phát hiện external access & unused permission
Detective

IAM Policy Simulator
Test thủ công một action có được allow/deny không
Testing/debug

AWS Trusted Advisor
Kiểm tra best practice tổng quát (cost, security, fault tolerance...)
Detective, phạm vi rộng hơn

AWS Security Hub
Tổng hợp finding bảo mật từ nhiều service (bao gồm cả Access Analyzer)
Aggregation/detective

SCP / Permissions boundary
Đặt trần quyền, ngăn chặn ngay từ đầu
Preventive

## Kết luận

IAM Access Analyzer không cấp hay thu hồi quyền — nó **nhìn thấy thứ mắt thường khó thấy** trong hàng trăm policy phức tạp, nhờ automated reasoning. Hai luồng chính cần nhớ: **External Access Analyzer** để canh chừng truy cập từ ngoài zone of trust, và **Unused Access Analyzer** để dọn dẹp quyền dư thừa bên trong.

Ghi nhớ ngắn gọn cho exam: thấy từ khóa **"external access"**, **"public bucket"**, **"unused permission"**, **"least privilege recommendation"** → nghĩ ngay đến Access Analyzer.

Bài tiếp theo sẽ chuyển sang bức tranh lớn hơn: **AWS Organizations và IAM Identity Center**, nơi các khái niệm SCP và zone of trust ở bài này sẽ được đặt trong ngữ cảnh quản lý nhiều account.

Tài liệu AWS nên đọc thêm:

- [IAM Access Analyzer overview](https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html)
- [Using Access Analyzer to identify unused access](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-unused-access.html)
- [Access Analyzer policy validation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-validation.html)
- [Generate policies based on access activity](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)