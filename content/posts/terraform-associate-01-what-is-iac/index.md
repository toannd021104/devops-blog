---
title: "Terraform Associate - Infrastructure as Code (IaC) là gì? Vì sao DevOps bắt buộc phải dùng IaC?"
date: 2025-11-15T01:00:00+07:00
draft: false
tags: ["terraform", "iac", "infrastructure-as-code", "devops", "automation"]
categories: ["DevOps", "Terraform"]
series: ["Terraform Associate"]
description: "Tìm hiểu Infrastructure as Code (IaC), tại sao DevOps cần IaC, và sự khác biệt giữa Declarative vs Imperative"
ShowToc: true
TocOpen: true
---

# Giới thiệu

**Infrastructure as Code (IaC)** là một trong những khái niệm nền tảng của `DevOps` hiện đại. Thay vì click chuột và gõ lệnh thủ công để cấu hình server, IaC cho phép bạn quản lý toàn bộ hạ tầng bằng code.

**Terraform** là công cụ IaC phổ biến nhất hiện nay, giúp bạn tự động hóa việc tạo, cập nhật và quản lý infrastructure trên nhiều cloud platform (AWS, Azure, GCP...) chỉ bằng vài dòng code.

Bài này sẽ trả lời 2 câu hỏi exam objectives quan trọng:
- **1a**: Explain what IaC is
- **1b**: Describe advantages of IaC patterns

---

## 1. IaC là gì?

### 1.1. Định nghĩa

**Infrastructure as Code (IaC)** là phương pháp quản lý và cung cấp hạ tầng IT thông qua các file code (configuration files), thay vì cấu hình thủ công qua giao diện đồ họa hoặc CLI commands.

**Ví dụ đơn giản:**

Thay vì login vào AWS Console và click 20 lần để tạo một EC2 instance, bạn chỉ cần viết:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "WebServer"
  }
}
```

Chạy `terraform apply` → Done!

### 1.2. IaC Tools phổ biến

- **Terraform** (HashiCorp) - Multi-cloud, declarative
- **CloudFormation** (AWS) - AWS only
- **Ansible** (Red Hat) - Configuration management
- **Pulumi** - Dùng programming languages (Python, Go, TypeScript)

---

## 2. Manual vs IaC

### 2.1. Cách truyền thống (Manual)

```
1. Login AWS Console
2. Click EC2 → Launch Instance
3. Chọn AMI
4. Chọn instance type
5. Configure network
6. Add storage
7. Add tags
8. Configure security group
9. Review và Launch
10. Download keypair
```

**Vấn đề:**
- Mất thời gian (10-15 phút/instance)
- Dễ sai sót (quên bước, nhầm config)
- Không track được changes
- Không replicate được chính xác
- Khó scale (tạo 100 instances thì sao?)

### 2.2. Với IaC (Terraform)

```hcl
resource "aws_instance" "web" {
  count         = 100  # Tạo 100 instances
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "WebServer-${count.index}"
  }
}
```

```bash
terraform apply  # < 5 phút cho 100 instances
```

**Lợi ích:**
- Nhanh hơn (automation)
- Chính xác hơn (no human error)
- Có version control (Git)
- Dễ replicate (chạy lại code)
- Scale dễ dàng (thay số count)

---

## 3. Declarative vs Imperative

### 3.1. Imperative (Mệnh lệnh)

Bạn phải chỉ định **từng bước** phải làm (how):

```bash
#!/bin/bash
# Bước 1: Tạo VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)

# Bước 2: Tạo Subnet (phải có VPC_ID từ bước 1)
SUBNET_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --query 'Subnet.SubnetId' --output text)

# Bước 3: Tạo EC2 (phải có SUBNET_ID từ bước 2)
aws ec2 run-instances --image-id ami-xxx --subnet-id $SUBNET_ID --instance-type t2.micro
```

**Vấn đề:**
- Phải biết đúng thứ tự
- Chạy lại script → lỗi (duplicate resources)
- Khó maintain khi phức tạp

### 3.2. Declarative (Khai báo)

Bạn chỉ mô tả **kết quả mong muốn** (what), tool tự tính toán cách làm:

```hcl
# Terraform tự biết phải tạo VPC trước, rồi Subnet, cuối cùng EC2
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id  # Terraform tự hiểu dependency
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public.id
}
```

**Lợi ích:**
- Terraform tự tính thứ tự đúng
- **Idempotent**: Chạy nhiều lần → kết quả giống nhau
- Dễ đọc, dễ hiểu
- Easy to maintain

### 3.3. So sánh

| Aspect          | Imperative (Bash)    | Declarative (Terraform) |
| --------------- | -------------------- | ----------------------- |
| **Focus**       | How (làm thế nào)    | What (cái gì)           |
| **Thứ tự**      | Phải tự chỉ định     | Tự động tính            |
| **Idempotent**  | Không                | Có                      |
| **Maintenance** | Khó                  | Dễ                      |
| **Scalability** | Khó scale            | Dễ scale                |

---

## 4. Tại sao DevOps cần IaC?

### 4.1. Version Control

IaC code được lưu trong Git → Track mọi thay đổi:

```bash
git log infrastructure/
```

```
commit abc123
Author: DevOps Team
Date: 2024-11-15

Changed instance type from t2.micro → t2.small

commit def456
Author: DevOps Team
Date: 2024-11-14

Added production VPC and subnets
```

**Lợi ích:**
- Biết ai đổi gì, khi nào
- Rollback dễ dàng nếu có lỗi
- Code review trước khi apply

### 4.2. Reproducibility

Tạo môi trường giống hệt nhau nhiều lần:

```hcl
# Một đoạn code → tạo được dev, staging, prod
module "environment" {
  source = "./modules/env"

  env_name      = var.environment  # "dev" | "staging" | "prod"
  instance_type = var.instance_type
  instance_count = var.instance_count
}
```

```bash
# Dev environment
terraform apply -var="environment=dev" -var="instance_count=2"

# Prod environment (giống hệt config nhưng scale hơn)
terraform apply -var="environment=prod" -var="instance_count=10"
```

### 4.3. Idempotency

Chạy code nhiều lần → kết quả giống nhau, không tạo duplicate:

```bash
terraform apply  # Tạo 5 instances
terraform apply  # Không tạo thêm, vẫn 5 instances
terraform apply  # Vẫn 5 instances
```

Terraform so sánh:
- **Desired state** (trong code)
- **Actual state** (trên AWS)
- Chỉ thay đổi khi có diff

### 4.4. Speed & Automation

**Manual:** 10 phút/instance × 100 instances = **16+ giờ**

**IaC:** < 5 phút cho 100 instances

```hcl
resource "aws_instance" "web" {
  count = 100  # Parallel creation
  # ...
}
```

### 4.5. Collaboration

Team cùng làm việc trên infrastructure code:

```bash
# Developer A
git pull
# Edit infrastructure
git commit -m "Add Redis cluster"
git push

# Developer B
git pull  # Nhận changes từ A
# Review code
terraform plan  # Preview changes
terraform apply # Apply sau khi review
```

---

## 5. Ví dụ Terraform đơn giản

### 5.1. Install Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify
terraform version
```

### 5.2. First Terraform Project

**File: main.tf**

```hcl
# Configure AWS Provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Create EC2 instance
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"  # Ubuntu 20.04
  instance_type = "t2.micro"

  tags = {
    Name = "MyFirstTerraformInstance"
  }
}

# Output public IP
output "instance_ip" {
  value = aws_instance.web.public_ip
}
```

### 5.3. Workflow

```bash
# 1. Initialize (download AWS provider)
terraform init

# 2. Preview changes
terraform plan

# Output:
# Terraform will perform the following actions:
#   + aws_instance.web will be created

# 3. Apply changes
terraform apply

# Output:
# Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
# Outputs:
# instance_ip = "54.123.45.67"

# 4. Destroy (cleanup)
terraform destroy
```

### 5.4. Kết quả

Bạn vừa:
- Tạo EC2 instance bằng code (không cần console)
- Track infrastructure trong Git
- Có thể replicate exact environment
- Xóa tất cả resources bằng 1 lệnh

---

## 6. Tổng kết

### 6.1. Tóm tắt kiến thức

**Infrastructure as Code (IaC):**
- Quản lý infrastructure bằng code thay vì manual configuration
- Cho phép `version control`, `automation`, `reproducibility`

**Manual vs IaC:**
- Manual: Chậm, dễ sai, khó scale, không track được
- IaC: Nhanh, chính xác, dễ scale, version control

**Declarative vs Imperative:**
- **Imperative**: Mô tả "how" (từng bước) → khó maintain, không idempotent
- **Declarative**: Mô tả "what" (kết quả) → dễ maintain, idempotent

**Tại sao DevOps cần IaC:**
- **Version Control**: Track changes trong Git
- **Reproducibility**: Tạo môi trường giống hệt nhiều lần
- **Idempotency**: Chạy nhiều lần → kết quả nhất quán
- **Speed**: Tự động hóa → nhanh hơn manual 10-100x
- **Collaboration**: Team cùng work on code

**Terraform:**
- IaC tool phổ biến nhất
- Multi-cloud (AWS, Azure, GCP...)
- Declarative syntax (HCL)
- Strong state management

### 6.2. Exam Objectives Covered

**1a - Explain what IaC is:**
- IaC là quản lý infrastructure thông qua code files thay vì manual config
- Cho phép automation, version control, và reproducibility

**1b - Describe advantages of IaC patterns:**
- Version control (Git tracking)
- Reproducibility (tạo lại exact environment)
- Idempotency (consistent results)
- Speed (automation)
- Collaboration (team work on code)
- Reduced human errors

### 6.3. Bài tiếp theo

Trong bài tiếp theo, chúng ta sẽ tìm hiểu:
- Terraform Installation & Setup
- Terraform Configuration Language (HCL)
- Resources, Providers, và Dependencies

---

## Resources

**Official Docs:**
- Terraform Docs: https://developer.hashicorp.com/terraform
- Terraform Registry: https://registry.terraform.io

**Learning:**
- HashiCorp Learn: https://learn.hashicorp.com/terraform
- Terraform Associate Exam: https://www.hashicorp.com/certification/terraform-associate

**Book:**
- **"Terraform: Up and Running"** by Yevgeniy Brikman

---
