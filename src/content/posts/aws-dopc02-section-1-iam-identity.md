---
id: "8"
slug: "aws-dopc02-section-1-iam-identity"
title: "AWS DOP-C02: Section 1 - IAM | Part 1: Identity"
excerpt: "Mở đầu series AWS Certified DevOps Engineer Professional DOP-C02 với nền tảng IAM Identity: User, Group, Role, STS và cách chọn đúng identity cho workload."
category: "AWS DOP-C02"
date: "Jun 11, 2026"
readTime: "8 min read"
image: "security.jpg"
summary:
  - "IAM identity là lớp nền để kiểm soát ai hoặc cái gì được phép gọi AWS API"
  - "IAM User, Group và Role khác nhau ở credential, cách cấp quyền và use case vận hành"
  - "Trong workload hiện đại, IAM Role và temporary credentials nên là lựa chọn mặc định"
takeaways:
  - "IAM User có long-term credentials, cần MFA và rotation nếu buộc phải dùng access key"
  - "IAM Group chỉ dùng để gom permission cho nhiều user, không login và không assume được"
  - "IAM Role dùng trust policy, permission policy và STS temporary credentials"
  - "DOP-C02 hay kiểm tra cross-account access, service role, service-linked role và federation"
---

Đây là bài đầu tiên trong series **AWS Certified DevOps Engineer - Professional DOP-C02**. Tôi sẽ đi theo hướng dễ đọc cho người đang ôn cert nhưng vẫn bám sát cách dùng thực tế trong DevOps: hiểu service dùng để làm gì, dùng sai sẽ hở ở đâu, và khi đi thi nên nhận diện keyword nào.

Trong phần IAM, bài đầu tiên nên bắt đầu từ **Identity**. Trước khi nói đến policy, permission boundary, SCP hay Access Analyzer, mình cần phân biệt được ba đối tượng cơ bản nhất:

- **IAM User**
- **IAM Group**
- **IAM Role**

Nghe đơn giản, nhưng rất nhiều thiết kế AWS bị yếu bảo mật chỉ vì dùng sai identity. Ví dụ: hardcode access key của IAM User vào CI/CD, để EC2 dùng static credential thay vì instance profile, hoặc tạo user riêng cho từng service trong khi workload đáng lẽ nên dùng role.

---

## IAM Identity là gì?

Trong AWS, **identity** là đối tượng đại diện cho một principal có thể được cấp quyền để gọi AWS API.

Nói thực tế hơn:

```text
Identity trả lời câu hỏi: Ai hoặc cái gì đang gọi AWS?
Policy trả lời câu hỏi: Được phép làm gì?
Resource trả lời câu hỏi: Làm trên tài nguyên nào?
```

Ví dụ:

```text
User alice gọi s3:ListBucket trên bucket devops-blog-assets
Lambda function gọi dynamodb:PutItem trên bảng deployment-events
ECS task gọi secretsmanager:GetSecretValue để đọc database password
Account tooling assume role sang account production để deploy
```

Tất cả các case trên đều cần IAM identity. Điểm khác nhau nằm ở loại identity nào phù hợp nhất.

---

## IAM User

**IAM User** đại diện cho một người dùng hoặc một workload cụ thể trong một AWS account.

IAM User có thể có hai kiểu access:

- **Console access**: username, password và MFA
- **Programmatic access**: access key ID và secret access key

Điểm quan trọng nhất của IAM User là credential thường là **long-term credentials**. Access key của user không tự hết hạn sau vài phút hay vài giờ. Nó tồn tại cho đến khi bị deactivate, delete hoặc rotate.

Đây là lý do IAM User cần được dùng rất thận trọng.

Ví dụ một IAM User dùng AWS CLI:

```text
aws configure --profile devops-admin

AWS Access Key ID: AKIA...
AWS Secret Access Key: ...
Default region name: ap-southeast-1
Default output format: json
```

Sau đó profile này có thể gọi AWS API:

```text
aws s3 ls --profile devops-admin
```

Về mặt vận hành, IAM User dễ dùng nhưng cũng dễ tạo rủi ro:

- Access key bị commit vào Git.
- Key nằm trong biến môi trường của laptop hoặc CI/CD quá lâu.
- Không có rotation định kỳ.
- User có quyền quá rộng vì gắn trực tiếp `AdministratorAccess`.
- Không bật MFA cho console user.

Với DOP-C02, khi đề bài nói đến workload chạy trên AWS như EC2, Lambda, ECS, CodeBuild hoặc GitHub Actions OIDC, bạn nên nghĩ ngay đến **IAM Role**, không phải IAM User access key.

---

## IAM Group

**IAM Group** là cách gom nhiều IAM User lại để quản lý permission dễ hơn.

Thay vì gắn policy riêng cho từng user:

```text
alice -> ReadOnlyAccess
bob   -> ReadOnlyAccess
minh  -> ReadOnlyAccess
```

Bạn tạo một group:

```text
Group: Developers
Policy: ReadOnlyAccess

Members:
- alice
- bob
- minh
```

Khi cần thêm user mới vào nhóm developer, bạn chỉ cần thêm user đó vào group. Permission sẽ được kế thừa từ group.

Những điểm cần nhớ:

- Group chứa IAM User.
- Group không thể chứa group khác.
- Một IAM User có thể thuộc nhiều group.
- Group không có password.
- Group không có access key.
- Group không thể login vào AWS Console.
- Group không thể assume role.

Group chỉ là công cụ quản lý permission cho user. Nó không phải một runtime identity cho workload.

Ví dụ cách chia group đơn giản:

```text
Developers
- ReadOnlyAccess
- quyền deploy staging

Operators
- CloudWatch read
- Systems Manager Session Manager
- quyền restart ECS service

Billing
- quyền xem billing và cost explorer

SecurityAudit
- SecurityAudit managed policy
- IAM Access Analyzer read
```

Trong môi trường enterprise, IAM User và Group thường dần được thay bằng **AWS IAM Identity Center** hoặc federation từ IdP như Okta, Entra ID, Google Workspace. Nhưng trong bài thi, bạn vẫn phải hiểu Group vì nó là thành phần IAM nền tảng.

---

## IAM Role

**IAM Role** là identity được thiết kế để được assume tạm thời bởi một principal khác.

Role khác IAM User ở điểm rất quan trọng:

```text
IAM User có long-term credentials.
IAM Role không có long-term credentials.
```

Khi một principal assume role, AWS STS sẽ cấp **temporary security credentials**. Credential này có thời hạn, tự hết hạn và có thể được rotate tự động bởi AWS service.

Một role thường có hai phần quan trọng:

- **Trust policy**: ai được phép assume role này?
- **Permission policy**: sau khi assume role, role được phép làm gì?

Ví dụ đơn giản:

```text
Trust policy:
EC2 được phép assume role này

Permission policy:
Role được phép đọc object trong S3 bucket app-config
```

Khi EC2 instance được gắn role thông qua instance profile, application bên trong EC2 có thể dùng AWS SDK để gọi S3 mà không cần hardcode access key.

Luồng thực tế:

```text
EC2 instance
  -> Instance profile
  -> Assume IAM Role
  -> Nhận temporary credentials từ STS
  -> Gọi AWS API
```

Đây là pattern nên dùng cho workload chạy trong AWS.

---

## Các loại IAM Role thường gặp

### Service Role

Service role là role được AWS service assume để thực hiện hành động thay bạn.

Ví dụ:

```text
Lambda execution role
EC2 instance profile role
ECS task role
CodeBuild service role
CodeDeploy service role
CloudFormation execution role
```

Case phổ biến:

```text
Lambda cần ghi log vào CloudWatch Logs
Lambda execution role có permission logs:CreateLogStream và logs:PutLogEvents
```

Hoặc:

```text
CodeBuild cần pull source, build image, push image lên ECR
CodeBuild service role cần quyền với CodeCommit/GitHub connection, S3, ECR và CloudWatch Logs
```

### Service-Linked Role

Service-linked role là role được liên kết trực tiếp với một AWS service. Role này thường do AWS tự tạo khi bạn bật một tính năng nào đó.

Ví dụ:

```text
AWSServiceRoleForAutoScaling
AWSServiceRoleForECS
AWSServiceRoleForElasticLoadBalancing
```

Đặc điểm:

- Được AWS service sử dụng để quản lý resource thay bạn.
- Trust policy gắn với service cụ thể.
- Permission thường do AWS quản lý.
- Không nên chỉnh sửa tùy tiện.

Trong DOP-C02, nếu câu hỏi nói service cần tự quản lý resource liên quan và AWS tạo role đặc biệt cho service đó, keyword thường là **service-linked role**.

### Cross-Account Role

Cross-account role cho phép principal từ account khác assume role vào account của bạn.

Ví dụ setup multi-account:

```text
tooling account
  -> assume role
production account
  -> deploy CloudFormation stack
```

Đây là pattern rất phổ biến trong DevOps:

- CI/CD account deploy sang staging và production.
- Security account đọc CloudTrail, Config, GuardDuty từ nhiều account.
- Audit account có quyền read-only trên các workload account.
- Shared services account truy cập resource có kiểm soát.

Cross-account role cần trust policy rõ ràng. Không nên trust nguyên một account nếu có thể giới hạn thêm bằng condition như external ID, principal ARN hoặc organization ID.

### Federated Role

Federated role dùng khi user đăng nhập qua identity provider bên ngoài, sau đó được map sang IAM Role.

Ví dụ:

```text
User đăng nhập qua IAM Identity Center
User thuộc group DevOps
AWS cấp quyền assume role DevOpsPowerUser trong account staging
```

Hoặc:

```text
GitHub Actions dùng OIDC
Workflow assume role trong AWS
Không cần lưu AWS access key trong GitHub secrets
```

Đây là hướng hiện đại hơn so với tạo IAM User access key cho automation.

---

## Ví dụ thực tế: ECS Task đọc Secrets Manager

Giả sử application chạy trong ECS cần đọc database password từ AWS Secrets Manager.

Cách không nên làm:

```text
Tạo IAM User
Tạo access key
Đưa access key vào environment variable của container
Application dùng key đó để gọi Secrets Manager
```

Cách này chạy được, nhưng rủi ro cao. Key có thể bị leak qua log, image layer, task definition, CI/CD hoặc source code.

Cách đúng hơn:

```text
ECS Task
  -> assume ECS Task Role
  -> nhận temporary credentials
  -> gọi Secrets Manager
```

Các bước thiết kế:

1. Tạo IAM Role cho ECS Task.
2. Trust policy cho phép `ecs-tasks.amazonaws.com` assume role.
3. Gắn permission `secretsmanager:GetSecretValue` vào đúng secret ARN.
4. Khai báo role trong `taskRoleArn` của task definition.
5. Application dùng AWS SDK bình thường, không cần hardcode credential.

Một điểm rất hay bị nhầm:

```text
taskRoleArn:
Quyền của application bên trong container.
Ví dụ: gọi S3, DynamoDB, SQS, Secrets Manager.

executionRoleArn:
Quyền của ECS agent.
Ví dụ: pull image từ ECR, ghi log về CloudWatch Logs, lấy secret để inject vào container.
```

Nếu app trong container gọi AWS API mà bị `AccessDenied`, hãy kiểm tra `taskRoleArn`. Nếu ECS không pull được image hoặc không ghi được log, hãy kiểm tra `executionRoleArn`.

---

## So sánh nhanh User, Group và Role

| Identity | Có credential riêng? | Long-term credential? | Assume được? | Use case chính |
|---|---:|---:|---:|---|
| IAM User | Có | Có | Không | Human user, legacy script, break-glass user |
| IAM Group | Không | Không | Không | Gom permission cho nhiều IAM User |
| IAM Role | Có, nhưng là temporary credentials từ STS | Không | Có | AWS service, workload, cross-account, federation |

Nếu phải nhớ một câu ngắn:

```text
User dùng cho danh tính cố định, Group dùng để gom user, Role dùng cho quyền tạm thời.
```

---

## Best practices cần nhớ cho DOP-C02

Với IAM User:

- Bật MFA cho user có console access.
- Không dùng root user cho công việc hằng ngày.
- Rotate access key nếu bắt buộc phải dùng.
- Xóa access key không dùng.
- Tránh gắn quyền trực tiếp quá rộng cho user.

Với IAM Group:

- Dùng group để quản lý permission theo team hoặc function.
- Không thiết kế group như workload identity.
- Tránh gắn quá nhiều policy chồng chéo làm khó audit.

Với IAM Role:

- Ưu tiên role cho workload chạy trên AWS.
- Dùng least privilege cho permission policy.
- Giới hạn trust policy càng cụ thể càng tốt.
- Dùng condition trong trust policy khi cần.
- Với cross-account, cân nhắc external ID hoặc organization condition.
- Với CI/CD hiện đại, ưu tiên OIDC federation thay vì long-term access key.

---

## Keyword đi thi

Khi làm DOP-C02, các keyword sau thường gợi ý chọn IAM Role:

```text
EC2 instance cần gọi AWS API
Lambda cần truy cập DynamoDB
ECS task cần đọc secret
CodeBuild cần push image lên ECR
Account A cần deploy sang Account B
External IdP login vào AWS
GitHub Actions không muốn lưu access key
Temporary credentials
STS AssumeRole
```

Các keyword sau thường gợi ý IAM User hoặc Group:

```text
Human user trong cùng AWS account
Console password
Access key rotation
Gom nhiều user theo team
Một user thuộc nhiều nhóm permission
```

Nhưng trong môi trường production hiện đại, nếu có lựa chọn giữa static access key và role/federation, đa số tình huống bảo mật tốt hơn sẽ nghiêng về **role hoặc federated access**.

---

## Kết luận

IAM Identity là nền móng của bảo mật AWS. Nếu chọn sai identity, các lớp phía sau như policy, permission boundary, SCP hay detective control đều khó cứu được thiết kế.

Tóm tắt lại:

- **IAM User**: danh tính cố định, có long-term credentials.
- **IAM Group**: công cụ gom permission cho nhiều IAM User.
- **IAM Role**: identity tạm thời, được assume qua STS, phù hợp cho workload và cross-account.

Trong bài tiếp theo của series, mình sẽ đi tiếp vào **IAM Policy Types**: identity-based policy, resource-based policy, permission boundary, session policy, SCP và ACL khác nhau như thế nào.

Tài liệu AWS nên đọc thêm:

- [IAM identities](https://docs.aws.amazon.com/IAM/latest/UserGuide/id.html)
- [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [Temporary security credentials in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html)
- [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
