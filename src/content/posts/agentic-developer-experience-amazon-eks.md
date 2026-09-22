---
id: "15"

slug: "xay-dung-kiro-cli-agent-amazon-eks"

title: "Xây dựng Kiro CLI Agent cho Amazon EKS"

excerpt: "Một workshop khám phá cách cấu hình Kiro CLI Agent cho Amazon EKS với MCP server, tools, permissions và project-specific context, sau đó áp dụng agent vào một tình huống troubleshooting thực tế."

category: "Kubernetes"

date: "Sep 23, 2026"

readTime: "8 min read"

image: "agentic-eks-architecture.png"

featured: true

summary:
  - "Tìm hiểu cách cấu hình Kiro CLI Agent cho Amazon EKS với prompt, MCP servers, tools và resources"
  - "Khám phá cách EKS MCP và AWS Knowledge MCP kết nối agent với EKS và AWS documentation"
  - "Thử nghiệm agent với một tình huống troubleshooting thực tế để xem toàn bộ workflow hoạt động như thế nào"

takeaways:
  - "Kiro CLI Agent có thể được định nghĩa cho một domain cụ thể bằng prompt, tools, MCP servers và project-specific context"
  - "MCP giúp agent tương tác với hệ thống bên ngoài thay vì chỉ dựa vào knowledge của model"
  - "Steering files và skills cung cấp thêm context và quy tắc cho từng project"
  - "Một use case thực tế cho thấy cách agent chuyển từ natural-language request sang investigation và execution"
---

# Xây dựng Kiro CLI Agent cho Amazon EKS

![Tổng quan workshop về Kiro CLI Agent và Amazon EKS](image-1.png)

Gần đây mình tham gia một workshop để khám phá cách xây dựng **AI agent cho Amazon EKS** bằng Kiro CLI.

Điều mình quan tâm không chỉ là deploy một ứng dụng lên Kubernetes. Mình muốn hiểu rõ hơn một câu hỏi khác:

> **Một AI agent được cấu hình như thế nào để có thể thực sự làm việc với một môi trường EKS?**

Workshop sử dụng Kiro CLI cùng với EKS MCP server, AWS Knowledge MCP, các tools và project-specific instructions. Nhờ đó, mình có thể dùng ngôn ngữ tự nhiên để yêu cầu agent kiểm tra cluster, tìm thông tin và xử lý một số vấn đề trong môi trường EKS.

Trong bài này, mình tập trung vào cách **Kiro CLI Agent được cấu hình**, các thành phần phía sau nó và cách chúng phối hợp với nhau. Cuối bài, mình dùng một tình huống troubleshooting để kiểm tra agent trong thực tế.

---

## Kiro CLI Agent được cấu hình như thế nào?

Workshop cung cấp một custom agent tên `kiro_eks_agent`.

Configuration của agent xác định bốn phần chính:

**agent là ai, có thể sử dụng gì, được phép làm gì và nên dựa vào context nào.**

```json
{
  "name": "kiro_eks_agent",
  "description": "Kiro custom agent for AWS EKS management and operations",

  "prompt": "You are an AWS EKS expert, you are teaching and helping a user manage their AWS EKS cluster",

  "mcpServers": {
    "eks-mcp-server": {
      "disabled": false,
      "type": "stdio",
      "command": "uvx",
      "args": [
        "mcp-proxy-for-aws@latest",
        "https://eks-mcp.us-west-2.api.aws/mcp",
        "--service",
        "eks-mcp"
      ]
    },

    "aws-knowledge-mcp-server": {
      "url": "https://knowledge-mcp.global.api.aws",
      "type": "http"
    }
  },

  "tools": [
    "@eks-mcp-server",
    "@aws-knowledge-mcp-server",
    "read",
    "write",
    "shell",
    "aws",
    "thinking",
    "introspect"
  ],

  "allowedTools": ["read", "thinking", "introspect"],

  "resources": [
    "file://.kiro/steering/**/*.md",
    "file://terraform/README.md",
    "skill://.kiro/skills/*/SKILL.md"
  ]
}
```

### Prompt

`prompt` định nghĩa role của agent.

Ở đây, agent được đặt vào vai trò một **AWS EKS expert**, thay vì một assistant chung chung.

### MCP Servers

Agent được kết nối với hai MCP server:

| MCP Server                 | Vai trò                               |
| -------------------------- | ------------------------------------- |
| `eks-mcp-server`           | Tương tác với EKS và Kubernetes       |
| `aws-knowledge-mcp-server` | Tra cứu AWS documentation và guidance |

Đây là phần giúp agent kết nối với những hệ thống và dữ liệu bên ngoài model.

### Tools

Agent có thể sử dụng nhiều loại tools như:

```text
read
write
shell
aws
thinking
introspect
```

Ngoài ra còn có các tools được cung cấp từ MCP servers.

Điểm đáng chú ý là **tool access và permission được tách riêng**. Không phải mọi thao tác agent có thể thực hiện đều được tự động cho phép.

Ví dụ, những thao tác thay đổi infrastructure có thể yêu cầu approval trước khi thực thi.

### Resources

Phần mình thấy thú vị nhất là:

```json
"resources": [
  "file://.kiro/steering/**/*.md",
  "file://terraform/README.md",
  "skill://.kiro/skills/*/SKILL.md"
]
```

Các resources cung cấp **context riêng cho project**.

Ví dụ, `.kiro/steering/` có thể chứa hướng dẫn về EKS, Terraform, observability hoặc troubleshooting. Các skills cung cấp thêm instruction cho những task cụ thể.

Điều này có nghĩa agent không chỉ biết:

> "EKS thường hoạt động như thế nào?"

mà còn biết:

> "Trong project này, nên xử lý EKS theo cách nào?"

---

## Từ Natural Language đến EKS

Sau khi hiểu configuration, mình thử sử dụng agent.

Đầu tiên, mình yêu cầu agent tổng quan cluster:

```text
Provide a comprehensive overview of my EKS cluster including:

- Cluster basic information and configuration
- All namespaces and their purposes
- Node information and capacity
- Installed add-ons and their status
```

Agent trả về:

```text
Cluster: agentic-devops-eks
Kubernetes: 1.34
Mode: EKS Auto Mode

Namespaces:
- retail-store
- monitoring
- adot-collector
- kube-system

Compute:
- 1 x c6a.large
- ~79% memory utilization
- 10 pods running
```

Sau đó mình yêu cầu agent phân tích application:

```text
Analyze the application running on my cluster and show the current
health status of all application components with pods associated
with each component.
```

Kết quả cho thấy các application pods đều đang `Running` và không có restart.

Điều mình thấy tiện ở đây là thay vì phải nhớ và chạy nhiều câu lệnh `kubectl`, mình chỉ mô tả thứ mình muốn biết.

Workflow lúc này có thể hình dung đơn giản:

```text
Natural-language request
          ↓
       Kiro CLI
          ↓
        Agent
          ↓
   Tools / MCP / Context
          ↓
       EKS / AWS
          ↓
        Result
```

---

## Context ảnh hưởng đến Agent như thế nào?

Để hiểu rõ hơn vai trò của resources, mình xem các steering documents đi kèm workshop.

Một trong những tài liệu quan trọng là troubleshooting methodology.

Nó định hướng agent theo một quy trình cụ thể:

```text
Verify the problem
        ↓
Collect evidence
        ↓
Search relevant guidance
        ↓
Inspect infrastructure
        ↓
Plan the change
        ↓
Apply the change
        ↓
Verify the result
```

Ví dụ, agent được yêu cầu kiểm tra Terraform state trước khi đi sâu vào infrastructure, chạy `terraform plan` trước `apply`, và xác minh kết quả sau khi thay đổi.

Điểm này khá quan trọng.

**Model có knowledge, nhưng context quyết định cách agent áp dụng knowledge đó trong một project cụ thể.**

---

## Thử nghiệm với một tình huống troubleshooting

Sau khi hiểu cách agent được cấu hình, mình đưa cho nó một task thực tế:

```text
Check if my retail application in the namespace retail-store is accessible.
If it's not accessible, please help me troubleshoot and fix the issue.
Ensure you use the best practices outlined in the troubleshooting guide.
```

![Agent kiểm tra EKS và trạng thái application](image-2.png)

Agent bắt đầu kiểm tra Ingress:

```text
$ kubectl get ingress -n retail-store

NAME   CLASS   HOSTS   ADDRESS   PORTS
ui     alb     *                 80
```

Điểm đáng chú ý:

```text
ADDRESS: <none>
```

Agent tiếp tục kiểm tra chi tiết Ingress và tìm được:

```text
Warning  FailedBuildModel

Failed build model due to couldn't auto-discover subnets:
subnets count less than minimal required count: 1 < 2
```

![Ingress báo lỗi FailedBuildModel](image-3.png)

Đến đây, agent đã có một hướng điều tra cụ thể thay vì chỉ đưa ra một danh sách command.

Nó tiếp tục kiểm tra Terraform state và VPC configuration, sau đó phát hiện public subnet configuration có vấn đề.

Cấu hình ban đầu chỉ tạo public subnet từ một Availability Zone:

```hcl
public_subnets = [
  for k, v in slice(local.azs, 0, 1) :
  cidrsubnet(local.vpc_cidr, 8, k + 48)
]
```

Agent sửa thành:

```hcl
public_subnets = [
  for k, v in local.azs :
  cidrsubnet(local.vpc_cidr, 8, k + 48)
]

public_subnet_tags = {
  "kubernetes.io/role/elb" = 1
}
```

Sau đó nó chạy:

```text
terraform plan
```

và kiểm tra thay đổi trước khi apply.

Cuối cùng, infrastructure được cập nhật, Ingress được tạo lại và ALB được provision thành công.

Agent tiếp tục verify kết quả:

```text
HTTP Status: 200
```

và:

```text
TargetHealth:

State: healthy
```

---

## Nhìn lại toàn bộ workflow

Case troubleshooting này giúp mình nhìn rõ hơn cách các thành phần trong agent phối hợp:

```text
Natural-language request
          ↓
       Kiro CLI
          ↓
     Agent reasoning
          ↓
 ┌────────┼───────────┐
 ↓        ↓           ↓
Context   MCP        Tools
 ↓        ↓           ↓
Steering  EKS/AWS    Shell/Files
          ↓
      Infrastructure
          ↓
       Verified result
```

Ở đây:

**Kiro CLI** cung cấp môi trường để tương tác với agent.

**MCP** kết nối agent với EKS, AWS và các nguồn dữ liệu bên ngoài.

**Tools** cho phép agent thực sự đọc thông tin hoặc thực hiện hành động.

**Steering files và skills** bổ sung context và cách làm việc phù hợp với project.

Đó cũng là phần mình thấy đáng chú ý nhất trong workshop.

AI agent không chỉ đơn giản là:

**Model + Prompt**

Mà có thể trở thành:

**Model + Context + Tools + External Systems**

và được sử dụng như một interface mới để làm việc với infrastructure.

---

## Kết luận

Workshop này giúp mình hiểu rõ hơn cách xây dựng một **Kiro CLI Agent cho một domain cụ thể như Amazon EKS**.

Điểm mình quan tâm nhất không phải là agent biết bao nhiêu command Kubernetes, mà là cách mình có thể **cấu hình agent để nó hiểu role, có đúng tools, có quyền hạn phù hợp và được cung cấp context của project**.

Khi thêm MCP, steering files và skills vào workflow, natural language trở thành một cách khác để tương tác với infrastructure.

Và case troubleshooting cuối bài là một ví dụ khá rõ: mình chỉ đưa ra vấn đề, còn agent có thể đi qua quá trình **investigate → inspect → change → verify** bằng những capability đã được cấu hình từ trước.
