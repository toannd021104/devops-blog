---
id: "14"
slug: "aws-dopc02-section-1-org-identity-center"
title: "AWS DOP-C02: Section 1 - IAM | Part 4: AWS Organizations & IAM Identity Center"
excerpt: "Hiểu cách AWS Organizations quản lý multi-account bằng SCP và OU, và cách IAM Identity Center cấp SSO tập trung qua Permission Set."
category: "AWS DOP-C02"
date: "Jun 28, 2026"
readTime: "10 min read"
image: "dvp-c02.png"
summary:
  - "AWS Organizations quản lý nhiều account bằng cấu trúc OU và guardrail SCP"
  - "IAM Identity Center cấp Single Sign-On tập trung, thay thế IAM user riêng lẻ ở từng account"
  - "Permission Set là đơn vị cấp quyền của Identity Center, được AWS tự động dựng thành IAM role ở từng account"
takeaways:
  - "SCP đặt trần quyền tối đa cho account/OU, không tự cấp quyền, kể cả root user cũng bị giới hạn"
  - "Identity Center tách biệt rõ Identity Source (ai đăng nhập) và Permission Set (được làm gì)"
  - "Permission Set khi gán vào account sẽ tự sinh IAM role, không cần tạo role thủ công"
  - "Xu hướng AWS khuyến nghị: dùng Identity Center + Permission Set thay vì tạo IAM user ở từng account"
---

Ba bài trước, mình đã đi từ **IAM Identity**, **IAM Policy**, đến **IAM Access Analyzer** — tất cả đều nằm trong phạm vi **một account**. Nhưng thực tế, một tổ chức hiếm khi chỉ có một account AWS. Họ có account riêng cho dev, staging, production, security, logging...

Hai dịch vụ giải quyết bài toán multi-account này là **AWS Organizations** (quản lý cấu trúc và guardrail) và **IAM Identity Center** (quản lý ai được đăng nhập vào account nào, với quyền gì).

![Kiến trúc tổng quan: Organization quản lý account, Identity Center cấp SSO xuyên account](https://claude.ai/assets/posts/aws-dopc02/section-1-org-identity-center/org-identity-center-overview.png)

## Phần 1: AWS Organizations

**AWS Organizations** cho phép bạn gom nhiều AWS account vào một tổ chức duy nhất, quản lý tập trung về billing, cấu trúc và policy.

### Cấu trúc cơ bản

```
Root
 ├── OU: Security
 │     ├── Account: log-archive
 │     └── Account: security-tooling
 ├── OU: Workloads
 │     ├── OU: Production
 │     │     └── Account: prod-app
 │     └── OU: Non-Production
 │           ├── Account: dev-app
 │           └── Account: staging-app
```

- **Management account**: account gốc tạo ra Organization, có quyền cao nhất, thường **không** dùng để chạy workload.
- **Member account**: các account còn lại trong tổ chức.
- **Organizational Unit (OU)**: nhóm các account lại theo môi trường, team hoặc mức độ tin cậy, để áp policy hàng loạt thay vì áp từng account.

### Service Control Policy (SCP)

SCP là **guardrail** áp lên account hoặc OU, đặt trần quyền tối đa — **không tự cấp quyền**, kể cả root user của member account cũng bị giới hạn bởi SCP.

```
{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "aws:RequestedRegion": "ap-southeast-1"
    }
  }
}
```

Hai chế độ SCP:

- **Deny list (mặc định)**: `FullAWSAccess` được attach sẵn, bạn thêm SCP dạng Deny để chặn thứ không muốn.
- **Allow list**: gỡ `FullAWSAccess`, chỉ định rõ action nào được phép — mọi thứ khác implicit deny.

> **Lưu ý quan trọng cho exam**: SCP **không áp dụng lên management account**. Muốn giới hạn cả management account, phải kết hợp thêm resource-based policy hoặc kiến trúc tách riêng account quản trị.

### Các policy khác trong Organizations

Ngoài SCP, Organizations còn hỗ trợ:

Loại policy
Mục đích

**SCP**
Giới hạn API action tối đa

**Resource Control Policy (RCP)**
Giới hạn quyền tối đa ở tầng resource, áp dụng cho principal kể cả ngoài Organization

**Tag Policy**
Chuẩn hóa quy tắc đặt tag trên resource

**Backup Policy**
Chuẩn hóa cấu hình AWS Backup xuyên account

**AI services opt-out policy**
Kiểm soát việc dữ liệu có được dùng để cải thiện AI service của AWS hay không

### AWS Control Tower

Đề thi hay nhắc tới **AWS Control Tower** như lớp tự động hóa nằm trên Organizations: tự dựng **Landing Zone** chuẩn với OU mẫu (Security, Sandbox...), tự bật CloudTrail/Config toàn tổ chức, và cung cấp **Account Factory** để tạo account mới theo template có sẵn — thay vì tự cấu hình Organizations bằng tay.

## Phần 2: AWS IAM Identity Center

Nếu Organizations trả lời câu hỏi *"tổ chức có bao nhiêu account và giới hạn ra sao"*, thì **IAM Identity Center** (tên cũ: **AWS SSO**) trả lời câu hỏi *"ai được đăng nhập vào account nào, với quyền gì, thông qua một lần đăng nhập duy nhất"*.

### Hai thành phần cốt lõi

**1. Identity Source** — nơi chứa danh tính người dùng:

```
Identity Center directory (mặc định, tự quản lý user/group)
AWS Managed Microsoft AD hoặc Self-managed AD (qua AD Connector)
External IdP bên ngoài qua SAML 2.0 (Okta, Azure AD, Google Workspace...)
```

**2. Permission Set** — đơn vị cấp quyền, tương tự IAM policy nhưng được thiết kế riêng để **tái sử dụng giữa nhiều account**.

```
{
  "name": "ReadOnlyDeveloper",
  "sessionDuration": "PT4H",
  "managedPolicies": ["arn:aws:iam::aws:policy/ReadOnlyAccess"],
  "inlinePolicy": {
    "Effect": "Deny",
    "Action": "s3:DeleteObject",
    "Resource": "*"
  }
}
```

Khi bạn gán một Permission Set cho một user/group vào một account cụ thể, Identity Center sẽ **tự động tạo một IAM role** trong account đó (kèm trust policy trỏ về Identity Center) — bạn không cần tạo role thủ công.

```
Assignment = User/Group + Permission Set + Target Account
           ↓
Identity Center tự sinh IAM role tương ứng trong account đó
```

### Trải nghiệm người dùng: AWS access portal

Người dùng đăng nhập **một lần** vào access portal, sau đó thấy danh sách account và role họ được cấp, click vào là AWS tự động thực hiện tương đương `AssumeRole` phía sau, cấp credential tạm thời.

```
Đăng nhập 1 lần
   ↓
Chọn: dev-app account → ReadOnlyDeveloper
   ↓
Nhận session credential tạm thời cho account đó
```

Identity Center cũng hỗ trợ SSO cho **ứng dụng SaaS bên ngoài** (Salesforce, Slack, Box...) qua cùng một cổng đăng nhập, không chỉ giới hạn ở AWS account.

### Vì sao AWS khuyến nghị Identity Center thay vì IAM user

Tiêu chí
IAM user truyền thống
IAM Identity Center

Quản lý credential
Access key/password riêng từng account
Không cần access key dài hạn, dùng session tạm thời

Quản lý ở nhiều account
Phải tạo user riêng ở từng account
Một danh tính, gán quyền vào nhiều account

MFA
Cấu hình riêng lẻ từng account
Cấu hình tập trung tại Identity Center

Thu hồi quyền khi nghỉ việc
Phải xóa ở từng account
Xóa/disable một nơi duy nhất

Best practice hiện tại của AWS
Không khuyến khích cho human user
Được khuyến nghị mặc định

## Kết hợp Organizations và Identity Center trong thực tế

Một luồng vận hành điển hình:

```
1. AWS Organizations tạo cấu trúc OU: Security / Workloads / Sandbox
2. SCP áp vào OU Workloads: chặn region ngoài ap-southeast-1
3. Identity Center kết nối Identity Source: Azure AD (qua SAML)
4. Tạo Permission Set: "DeveloperAccess", "SecurityAudit", "BillingReadOnly"
5. Gán Permission Set cho group tương ứng vào từng account trong OU Workloads
```

Kết quả: một developer đăng nhập Azure AD một lần, thấy đúng những account họ được cấp, với đúng quyền được giới hạn hai lớp — vừa bởi Permission Set (identity-based, tự cấp quyền), vừa bởi SCP của OU chứa account đó (guardrail, không tự cấp quyền).

```
Effective permission của developer trong account dev-app
= Permission Set "DeveloperAccess" (Allow)
  ∩ SCP của OU Workloads (giới hạn region)
```

Đây chính là bức tranh đầy đủ nối lại với công thức **policy evaluation** ở Part 2: identity-based/resource-based policy có thể cấp quyền, còn SCP, permissions boundary, session policy chỉ giới hạn — dù bây giờ ngữ cảnh đã mở rộng ra toàn bộ Organization.

## Những điểm hay bị nhầm trong exam

- **SCP không áp dụng cho management account** — nhầm điểm này rất thường gặp trong câu hỏi về giới hạn quyền toàn tổ chức.
- **Identity Center không lưu trữ mật khẩu nếu dùng external IdP** — việc xác thực thực sự diễn ra ở IdP, Identity Center chỉ nhận SAML assertion.
- **Permission Set khác Permissions Boundary**: Permission Set là cách Identity Center cấp quyền (tương đương identity-based policy tự sinh ra role), còn Permissions Boundary là guardrail giới hạn quyền tối đa của một role/user — hai khái niệm khác lớp trong công thức evaluation.
- **Control Tower không thay thế Organizations** — Control Tower dùng Organizations bên dưới, chỉ là lớp tự động hóa và best-practice mặc định.

## Kết luận

AWS Organizations cho bạn **khung xương** để quản lý guardrail xuyên nhiều account bằng OU và SCP. IAM Identity Center cho bạn **cánh cửa vào duy nhất** để con người truy cập vào đúng account, đúng quyền, mà không cần rải IAM user và access key khắp nơi.

Ghi nhớ nhanh cho exam: thấy từ khóa **"multi-account guardrail"**, **"OU"**, **"prevent leaving organization"** → nghĩ tới **SCP/Organizations**. Thấy từ khóa **"single sign-on"**, **"centralized human access"**, **"Permission Set"** → nghĩ tới **Identity Center**.

Đến đây, Section 1 về IAM đã đi qua đủ 4 mảnh ghép: **Identity → Policy → Access Analyzer → Organizations/Identity Center**. Section tiếp theo sẽ chuyển sang chủ đề mới trong lộ trình DOP-C02.

Tài liệu AWS nên đọc thêm:

- [AWS Organizations overview](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html)
- [Service control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [What is IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [Permission sets in IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html)