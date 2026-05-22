---
id: "5"
slug: "aws-transform-vmware-migration"
title: "AWS Transform for VMware — Migrate VMware Workloads to AWS with Agentic AI"
excerpt: "AWS Transform là service đầu tiên của AWS dùng agentic AI để tự động hoá toàn bộ quá trình migrate VMware — từ discovery, wave planning, network conversion, đến cutover. Bài này giải thích nó hoạt động thế nào và khi nào nên dùng."
category: "AWS"
date: "May 21, 2026"
readTime: "8 min read"
image: "security.jpg"
featured: false
summary:
  - "AWS Transform dùng AI agent để tự động hoá discovery, dependency mapping, wave planning, network conversion và EC2 migration — thay vì phải dùng nhiều tool rời nhau"
  - "Input là RVTools CSV export — output là business case đầy đủ (PowerPoint + Excel + PDF) kèm EC2 recommendations và cost projection"
  - "Workspace UI là split-screen: job management bên trái, AI chat bên phải — tương tác qua hội thoại, không phải form"
takeaways:
  - "IAM Identity Center là bắt buộc — Transform web app authenticate qua SSO, không hỗ trợ IAM user thông thường"
  - "RVTools CSV (không phải XLSX) mới được chấp nhận để ingest inventory"
  - "Business case output gồm PowerPoint + Excel + PDF — sẵn sàng để present cho stakeholders"
  - "ADS Agentless Collector mới cho phép auto dependency mapping — RVTools chỉ cho snapshot tĩnh"
  - "Một migration job chỉ target một AWS Region — multi-region cần tạo job riêng"
---

Migrate VMware lên AWS theo cách thông thường thường trải qua nhiều bước rời nhau: export inventory bằng RVTools, import vào Application Discovery Service, vẽ tay dependency map, lên wave plan trong spreadsheet, cấu hình MGN cho từng server, rồi convert network config sang VPC. Mỗi bước một tool, mỗi tool một learning curve.

AWS Transform là nỗ lực của AWS để gom toàn bộ flow đó lại thành một agent-driven workflow. Thay vì điều phối thủ công, bạn upload inventory, đặt câu hỏi bằng ngôn ngữ tự nhiên, và agent xử lý phần còn lại — từ tạo business case đến orchestrate cutover.

---

## Kiến trúc tổng thể

Trước khi đi vào chi tiết, đây là flow tổng quan:

```
RVTools export / ADS Agentless Collector
            ↓
    AWS Transform Agent
  (discovery + planning + orchestration)
            ↓
   Wave planning  →  Network conversion
            ↓               ↓
    MGN replication    CloudFormation/CDK
            ↓
      EC2 cutover (Target VPC)
```

AWS Transform không trực tiếp migrate server — nó orchestrate MGN để làm việc đó. Phần giá trị nằm ở tầng phía trên: tự động nhóm application, lên wave plan, convert network config, và theo dõi tiến độ từ một dashboard.

---

## Giao diện làm việc

Khi vào workspace, màn hình chia đôi: bên trái là job management với các bước của migration plan, bên phải là chat interface với AI agent. Bạn không điền form hay click qua wizard — bạn mô tả những gì muốn làm, upload file, và agent propose plan.

Điều này cũng có nghĩa là AI response có thể thay đổi giữa các lần chạy. Workshop của AWS còn note rõ: "The AI agent's responses may differ from the screenshots shown." Đây là hành vi bình thường của agentic system — focus vào outcome, không phải wording.

---

## Trước khi bắt đầu

Cần có sẵn:

- **AWS Organizations** — Transform yêu cầu account phải nằm trong một organization
- **IAM Identity Center** — Transform web app authenticate hoàn toàn qua SSO. Không có IAM Identity Center thì không có cách nào login vào UI
- **Discovery account** — nơi lưu RVTools data và discovery output
- **Provisioning account** — nơi EC2 instances sẽ được deploy. Có thể dùng cùng account với discovery, nhưng tách riêng được khuyến nghị cho production

Khi enable lần đầu, Transform yêu cầu chọn KMS key để encrypt toàn bộ data ingested — VM inventory, application metadata, migration artifacts. Bước này không thể bỏ qua.

> **Tại sao IAM Identity Center thay vì IAM user thông thường?**
> IAM Identity Center cho phép quản lý quyền truy cập cho nhiều AWS application từ một nơi. User login một lần qua SSO và có access mà không cần credential riêng cho từng tool. IAM user thông thường không integrate được với Transform web app.

![AWS Access Portal sau khi setup — AWS Transform app xuất hiện dưới Applications](01-identity-center-portal.png)

---

## Discovery: ba cách ingest inventory

**RVTools export** là cách phổ biến nhất. RVTools là utility miễn phí scan vCenter và export VM specs, network config, disk layout, OS details thành CSV. Bạn zip lại và upload thẳng vào Transform.

**AWS Application Discovery Service (ADS) Agentless Collector** deploy như một OVA trong VMware environment và thu thập data liên tục — bao gồm TCP network connections. Đây là điểm khác biệt quan trọng: với ADS, agent có thể tự động phát hiện VM nào đang giao tiếp với nhau và group chúng thành application. Với RVTools, bạn phải tự map application groupings.

**Manual import** dành cho trường hợp đã có inventory data ở format khác.

Nếu bạn đang migrate một environment phức tạp với nhiều application dependencies, ADS là lựa chọn đáng đầu tư. Với môi trường nhỏ hoặc đã biết rõ topology, RVTools là đủ.

---

![Source EC2 instances mô phỏng môi trường on-premises — Source-Wordpress-DB, Source-Wordpress-WEB, Source-OFBiz-DB, Source-OFBiz-WEB](02-source-instances.png)

## Business case: từ RVTools export ra PowerPoint trong vài phút

Trước khi commit vào full migration, Transform có thể generate TCO analysis từ RVTools export. Bạn tạo một Assessment job, upload file, chọn target region, và agent map từng VM sang EC2 instance type phù hợp.

Output là một zip gồm ba file:

- **PowerPoint** — executive summary với cost comparison charts, sẵn sàng để present
- **Excel** — per-VM instance recommendations, có thể chỉnh assumptions và recalculate
- **PDF** — full report với methodology và assumptions

Kết quả thực tế từ môi trường lab gồm 4 VM (WordPress + OFBiz, 4 vCPU, 4 GiB RAM):

- On-Demand: **$1,798/năm**
- 1-Year Reserved: **$1,190/năm** (giảm 34%)
- 3-Year Reserved: **$792/năm** (giảm 56%)

Tất cả 4 VM được recommend `c7a.medium`. Agent generate xong trong chưa đến 5 phút.

Output là PowerPoint và Excel chứ không chỉ PDF vì business case này được thiết kế để present, không chỉ để đọc. Excel cho phép bạn thay đổi assumptions — reserved instance term, storage utilization, right-sizing preference — và tính lại ngay. Đây là thứ một static PDF không làm được.

---

## Migration workflow

Sau khi setup xong, một migration job end-to-end đi qua các giai đoạn: upload inventory → build migration plan (agent tự group application và đề xuất wave) → convert network từ NSX sang VPC → configure EC2 sizing → install MGN agent → launch test instances → cutover.

Điểm đáng chú ý là mọi action quan trọng đều cần human approval trước khi chạy — deploy network, launch test, launch cutover. Agent không tự làm gì mà không có người xác nhận. Đây là thiết kế có chủ ý: agentic AI đề xuất, con người quyết định.

![Migration plan sau khi agent phân tích inventory — wave plan và dependency mapping sẵn sàng](03-migration-plan-output.png)

Phần network conversion là chỗ tiết kiệm nhiều công sức nhất. Thay vì tự vẽ lại VPC architecture từ VMware topology, bạn upload NSX export và agent generate CloudFormation/CDK code. Có thể để Transform deploy thẳng hoặc download code về tích hợp vào pipeline riêng.

![Network migration hoàn thành — VPC deployed, bi-directional connectivity verified](04-network-migration-complete.png)

Trong quá trình thực tế với lab này, mình gặp lỗi MGN agent bị disconnect trên Wave 2 (OFBiz) sau khi để quá lâu. Agent timeout sau một thời gian idle — fix là reinstall agent hoặc skip wave nếu optional.

---

## Dashboard

Transform có unified dashboard theo dõi tiến độ theo bốn chiều: waves, applications, servers, networks. Replication status hiển thị Healthy/Lagging/Stalled ngay trên UI — không cần mở MGN console riêng.

![Wave completed — agent báo cáo Wave 0 Rehost hoàn thành với đầy đủ server summary](08-wave-completed.png)

---

## Khi nào nên — và không nên — dùng

Transform phù hợp nhất khi bạn có một VMware fleet đủ lớn mà việc lên wave plan và dependency mapping thủ công tốn nhiều tuần. Agentic workflow giúp nhất ở khâu planning và orchestration — những thứ trước đây cần nhiều người và nhiều tool.

Nếu bạn chỉ migrate vài server và đã biết rõ topology, overhead của việc setup Transform (Organizations, Identity Center, discovery account) có thể không đáng so với dùng MGN trực tiếp.

Một vài điểm cần biết trước khi dùng:

- Dừng một job đang chạy và restart lại sẽ mất toàn bộ progress (artifacts vẫn còn)
- Mỗi migration job chỉ target một AWS Region — multi-region cần tạo job riêng
- NSX import chỉ hoạt động trong end-to-end migration job
- Control plane phải đặt ở `us-east-1` hoặc `eu-central-1`

![Kết quả migrate — wordpress-web và wordpress-db chạy trên c7a.medium trong Target VPC, đúng với EC2 recommendation ban đầu](09-migrated-ec2-instances.png)

---

*Bài viết dựa trên AWS Workshop: "AWS Transform for VMware Migrations using Agentic AI" — Level 300, us-east-1.*
