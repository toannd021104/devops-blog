---
title: "Terraform Associate - Cài đặt Terraform & Bắt đầu với HCL"
date: 2025-11-16T01:00:00+07:00
draft: false
tags: ["terraform", "hcl", "installation", "setup", "devops"]
categories: ["DevOps", "Terraform"]
series: ["Terraform Associate"]
description: "Hướng dẫn cài đặt Terraform, làm quen với HCL (HashiCorp Configuration Language), và tạo first project"
ShowToc: true
TocOpen: true
---

# Giới thiệu

Sau khi hiểu **IaC là gì** và **tại sao DevOps cần IaC**, bây giờ chúng ta sẽ bắt đầu thực hành với Terraform.

Trong bài này, bạn sẽ học:
- Cài đặt Terraform trên máy (Windows, macOS, Linux)
- Hiểu cơ bản về **HCL** (HashiCorp Configuration Language)
- Cấu trúc của một Terraform project
- Tạo first project thực tế

Bài này cover exam objectives:
- **2a**: Terraform workflow (write → init → plan → apply)
- **2b**: Terraform files and directories
- **3a**: HCL syntax basics

---

## 1. Cài đặt Terraform

### 1.1. Cài trên macOS

**Option 1: Homebrew (Recommended)**

```bash
# Install Terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify installation
terraform version
```

**Output:**
```
Terraform v1.6.0
on darwin_amd64
```

**Option 2: Manual Download**

```bash
# Download binary
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_darwin_amd64.zip

# Unzip
unzip terraform_1.6.0_darwin_amd64.zip

# Move to PATH
sudo mv terraform /usr/local/bin/

# Verify
terraform version
```

### 1.2. Cài trên Linux (Ubuntu/Debian)

**Option 1: Package Manager**

```bash
# Add HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add HashiCorp repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list

# Update and install
sudo apt update
sudo apt install terraform

# Verify
terraform version
```

**Option 2: Manual Download**

```bash
# Download
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip

# Unzip
unzip terraform_1.6.0_linux_amd64.zip

# Move to PATH
sudo mv terraform /usr/local/bin/

# Verify
terraform version
```

### 1.3. Cài trên Windows

**Option 1: Chocolatey**

```powershell
# Install using Chocolatey
choco install terraform

# Verify
terraform version
```

**Option 2: Manual Download**

1. Download từ: https://www.terraform.io/downloads
2. Unzip file
3. Add thư mục vào System PATH
4. Mở Command Prompt mới và verify:

```cmd
terraform version
```

### 1.4. Enable Tab Completion

Terraform hỗ trợ autocomplete cho commands:

```bash
# Bash
terraform -install-autocomplete

# Reload shell
source ~/.bashrc

# Zsh
terraform -install-autocomplete
source ~/.zshrc
```

---

## 2. HashiCorp Configuration Language (HCL)

### 2.1. HCL là gì?

**HCL** (HashiCorp Configuration Language) là ngôn ngữ declarative được thiết kế để viết configuration dễ đọc cho con người.

**Đặc điểm:**
- Human-readable và machine-friendly
- Declarative (mô tả "what", không phải "how")
- Có cấu trúc blocks và arguments
- Hỗ trợ variables, functions, expressions

### 2.2. Cú pháp cơ bản

**Block Syntax:**

```hcl
<BLOCK_TYPE> "<BLOCK_LABEL>" "<BLOCK_LABEL>" {
  # Block body
  <IDENTIFIER> = <EXPRESSION>
}
```

**Ví dụ:**

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "WebServer"
  }
}
```

**Phân tích:**
- `resource`: Block type
- `"aws_instance"`: Resource type (provider + resource name)
- `"web"`: Resource name (local identifier)
- `ami`, `instance_type`, `tags`: Arguments
- `{...}`: Block body

### 2.3. Data Types

**Primitive Types:**

```hcl
# String
variable "region" {
  type    = string
  default = "us-east-1"
}

# Number
variable "instance_count" {
  type    = number
  default = 3
}

# Bool
variable "enable_monitoring" {
  type    = bool
  default = true
}
```

**Complex Types:**

```hcl
# List
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

# Map
variable "tags" {
  type = map(string)
  default = {
    Environment = "dev"
    Team        = "platform"
  }
}

# Object
variable "instance_config" {
  type = object({
    instance_type = string
    ami           = string
    monitoring    = bool
  })
  default = {
    instance_type = "t2.micro"
    ami           = "ami-123456"
    monitoring    = true
  }
}
```

### 2.4. Comments

```hcl
# Single line comment

/*
  Multi-line
  comment
*/

resource "aws_instance" "web" {
  ami           = "ami-123456"  # Inline comment
  instance_type = "t2.micro"
}
```

### 2.5. String Interpolation

```hcl
variable "environment" {
  default = "production"
}

variable "project" {
  default = "myapp"
}

resource "aws_instance" "web" {
  ami           = "ami-123456"
  instance_type = "t2.micro"

  tags = {
    Name = "${var.project}-${var.environment}-server"
    # Kết quả: "myapp-production-server"
  }
}
```

---

## 3. Terraform Project Structure

### 3.1. Basic Structure

```
my-terraform-project/
├── main.tf              # Main configuration
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── providers.tf         # Provider configuration
├── terraform.tfvars     # Variable values (GITIGNORE!)
├── .terraform/          # Provider plugins (auto-generated)
├── .terraform.lock.hcl  # Provider version lock
└── terraform.tfstate    # State file (auto-generated)
```

### 3.2. File Naming Conventions

Terraform load tất cả `.tf` files trong directory theo alphabetical order.

**Recommended file names:**

| File            | Purpose                                  |
| --------------- | ---------------------------------------- |
| `main.tf`       | Primary resources                        |
| `variables.tf`  | Input variable declarations              |
| `outputs.tf`    | Output value declarations                |
| `providers.tf`  | Provider configurations                  |
| `versions.tf`   | Terraform và provider version constraints |
| `backend.tf`    | Backend configuration (remote state)     |
| `locals.tf`     | Local values                             |

### 3.3. File Examples

**providers.tf:**

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy = "Terraform"
      Project   = var.project_name
    }
  }
}
```

**variables.tf:**

```hcl
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"

  validation {
    condition     = contains(["t2.micro", "t2.small", "t2.medium"], var.instance_type)
    error_message = "Instance type must be t2.micro, t2.small, or t2.medium."
  }
}
```

**main.tf:**

```hcl
# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
}

# Create EC2 instance
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  tags = {
    Name = "${var.project_name}-web-server"
  }
}
```

**outputs.tf:**

```hcl
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "Public IP address"
  value       = aws_instance.web.public_ip
}

output "instance_private_ip" {
  description = "Private IP address"
  value       = aws_instance.web.private_ip
}
```

**terraform.tfvars:**

```hcl
# Variable values
project_name  = "myapp"
aws_region    = "us-west-2"
instance_type = "t2.small"
```

---

## 4. Terraform Workflow

### 4.1. Core Workflow

```
┌─────────────────────────────────────────┐
│ 1. WRITE                                │
│    - Viết .tf files                     │
│    - Define resources                   │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 2. INIT                                 │
│    terraform init                       │
│    - Download providers                 │
│    - Initialize backend                 │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 3. PLAN                                 │
│    terraform plan                       │
│    - Preview changes                    │
│    - Validation                         │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 4. APPLY                                │
│    terraform apply                      │
│    - Create/modify resources            │
│    - Update state                       │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 5. DESTROY (optional)                   │
│    terraform destroy                    │
│    - Remove all resources               │
└─────────────────────────────────────────┘
```

### 4.2. terraform init

**Purpose:** Initialize working directory

```bash
terraform init
```

**Thực hiện:**
- Download providers từ Terraform Registry
- Initialize backend (local hoặc remote)
- Tạo `.terraform/` directory
- Tạo `.terraform.lock.hcl` file

**Output:**

```
Initializing the backend...

Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.31.0...
- Installed hashicorp/aws v5.31.0

Terraform has been successfully initialized!
```

### 4.3. terraform plan

**Purpose:** Preview changes trước khi apply

```bash
terraform plan
```

**Output:**

```
Terraform will perform the following actions:

  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami                          = "ami-0c55b159cbfafe1f0"
      + instance_type                = "t2.micro"
      + id                           = (known after apply)
      + public_ip                    = (known after apply)
      + tags                         = {
          + "Name" = "myapp-web-server"
        }
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

**Plan Options:**

```bash
# Save plan to file
terraform plan -out=tfplan

# Apply từ saved plan
terraform apply tfplan

# Plan với specific var file
terraform plan -var-file="prod.tfvars"
```

### 4.4. terraform apply

**Purpose:** Apply changes to infrastructure

```bash
terraform apply
```

**Interactive:**

```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes

aws_instance.web: Creating...
aws_instance.web: Still creating... [10s elapsed]
aws_instance.web: Creation complete after 32s [id=i-0abcd1234efgh5678]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:

instance_id = "i-0abcd1234efgh5678"
instance_public_ip = "54.123.45.67"
```

**Auto-approve (CI/CD):**

```bash
terraform apply -auto-approve
```

### 4.5. terraform destroy

**Purpose:** Destroy all managed resources

```bash
terraform destroy
```

**Output:**

```
Terraform will perform the following actions:

  # aws_instance.web will be destroyed
  - resource "aws_instance" "web" {
      - ami           = "ami-0c55b159cbfafe1f0"
      - instance_type = "t2.micro"
      ...
    }

Plan: 0 to add, 0 to change, 1 to destroy.

Do you really want to destroy all resources?
  Enter a value: yes

aws_instance.web: Destroying... [id=i-0abcd1234efgh5678]
aws_instance.web: Destruction complete after 31s

Destroy complete! Resources: 1 destroyed.
```

---

## 5. First Project thực tế

### 5.1. Setup AWS Credentials

**Option 1: AWS CLI**

```bash
# Install AWS CLI
brew install awscli  # macOS
# or
sudo apt install awscli  # Linux

# Configure credentials
aws configure

# Input:
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region: us-east-1
# Default output format: json
```

**Option 2: Environment Variables**

```bash
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY"
export AWS_DEFAULT_REGION="us-east-1"
```

### 5.2. Create Project

```bash
# Create project directory
mkdir terraform-first-project
cd terraform-first-project

# Create files
touch providers.tf variables.tf main.tf outputs.tf terraform.tfvars
```

### 5.3. Write Configuration

**providers.tf:**

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

**variables.tf:**

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 1
}
```

**main.tf:**

```hcl
# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Create EC2 instances
resource "aws_instance" "web" {
  count         = var.instance_count
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  tags = {
    Name        = "${var.project_name}-web-${count.index + 1}"
    Environment = "development"
    ManagedBy   = "Terraform"
  }
}
```

**outputs.tf:**

```hcl
output "instance_ids" {
  description = "IDs of EC2 instances"
  value       = aws_instance.web[*].id
}

output "public_ips" {
  description = "Public IP addresses"
  value       = aws_instance.web[*].public_ip
}

output "private_ips" {
  description = "Private IP addresses"
  value       = aws_instance.web[*].private_ip
}
```

**terraform.tfvars:**

```hcl
project_name   = "my-first-project"
aws_region     = "us-east-1"
instance_type  = "t2.micro"
instance_count = 2
```

### 5.4. Execute Workflow

```bash
# 1. Initialize
terraform init

# 2. Format code
terraform fmt

# 3. Validate configuration
terraform validate

# Output: Success! The configuration is valid.

# 4. Plan
terraform plan

# 5. Apply
terraform apply

# Review output và type "yes"

# 6. Check outputs
terraform output

# Output:
# instance_ids = [
#   "i-0abc123",
#   "i-0def456",
# ]
# public_ips = [
#   "54.123.45.67",
#   "54.123.45.68",
# ]
```

### 5.5. Modify và Update

Thay đổi instance count từ 2 → 3:

**terraform.tfvars:**

```hcl
instance_count = 3  # Changed from 2
```

```bash
# Plan changes
terraform plan

# Output:
# Plan: 1 to add, 0 to change, 0 to destroy.

# Apply
terraform apply
```

### 5.6. Cleanup

```bash
# Destroy all resources
terraform destroy

# Type "yes" to confirm
```

---

## 6. Common Commands

### 6.1. Essential Commands

```bash
# Initialize working directory
terraform init

# Format code to canonical style
terraform fmt

# Validate configuration
terraform validate

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure
terraform destroy

# Show current state
terraform show

# List resources in state
terraform state list

# Get output values
terraform output
```

### 6.2. Useful Flags

```bash
# Auto-approve (skip confirmation)
terraform apply -auto-approve

# Use specific var file
terraform plan -var-file="prod.tfvars"

# Set variable via CLI
terraform apply -var="instance_count=5"

# Target specific resource
terraform apply -target=aws_instance.web

# Refresh state only
terraform refresh

# Show plan in JSON
terraform show -json
```

---

## 7. Tổng kết

### 7.1. Tóm tắt kiến thức

**Installation:**
- Terraform có thể cài trên macOS, Linux, Windows
- Recommended: Package manager (Homebrew, apt, choco)
- Verify: `terraform version`

**HCL Basics:**
- Declarative language cho infrastructure
- Block-based syntax: `<TYPE> "<LABEL>" { ... }`
- Data types: string, number, bool, list, map, object
- Support variables, functions, string interpolation

**Project Structure:**
- `main.tf`: Primary resources
- `variables.tf`: Input variables
- `outputs.tf`: Output values
- `providers.tf`: Provider config
- `terraform.tfvars`: Variable values (gitignore)

**Terraform Workflow:**
1. **Write**: Viết .tf files
2. **Init**: Download providers
3. **Plan**: Preview changes
4. **Apply**: Create/modify resources
5. **Destroy**: Cleanup resources

**Core Commands:**
- `terraform init` → Initialize directory
- `terraform plan` → Preview changes
- `terraform apply` → Apply changes
- `terraform destroy` → Remove resources

### 7.2. Exam Objectives Covered

**2a - Terraform workflow:**
- Write → Init → Plan → Apply → Destroy
- Hiểu purpose của từng command

**2b - Terraform files:**
- `.tf` files: Configuration
- `.tfvars`: Variable values
- `.terraform/`: Provider plugins
- `terraform.tfstate`: State file

**3a - HCL syntax:**
- Block syntax và structure
- Data types (primitive + complex)
- Variables và interpolation

### 7.3. Best Practices

- Luôn chạy `terraform fmt` trước khi commit
- Chạy `terraform validate` để check syntax
- Review `terraform plan` kỹ trước khi apply
- Gitignore: `*.tfstate`, `*.tfvars`, `.terraform/`
- Sử dụng remote backend cho production
- Enable tab completion cho productivity

### 7.4. Bài tiếp theo

Trong bài tiếp theo, chúng ta sẽ tìm hiểu:
- Terraform State chi tiết
- Remote Backend (S3, Terraform Cloud)
- State locking và team collaboration

---

## Resources

**Official Docs:**
- Terraform CLI: https://developer.hashicorp.com/terraform/cli
- HCL Syntax: https://developer.hashicorp.com/terraform/language/syntax
- AWS Provider: https://registry.terraform.io/providers/hashicorp/aws

**Learning:**
- HashiCorp Learn: https://learn.hashicorp.com/terraform
- Terraform Registry: https://registry.terraform.io

---
