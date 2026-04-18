---
title: "Part 5: AWS + Terraform - Deploy Microservices lên ECS"
date: 2025-11-17T08:00:00+07:00
draft: false
tags: ["aws", "ecs", "terraform", "infrastructure-as-code", "devops"]
categories: ["DevOps", "AWS", "Terraform"]
series: ["DevOps Skills Showcase"]
weight: 5
description: "Part 5 - Phân tích Terraform code: VPC, ECS, ALB, Security Groups - Deploy microservices production-ready trên AWS"
ShowToc: true
TocOpen: true
---

> **Part 5 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → AWS + Terraform → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

---

# Giới thiệu

Bài viết này hướng dẫn deploy microservices từ project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform) lên AWS ECS bằng Terraform.

Chúng ta sẽ xem xét:
- VPC setup với public/private subnets
- ECS Cluster và Task Definitions
- Application Load Balancer
- Security Groups và IAM roles
- Best practices cho production

---

## Kiến trúc tổng quan

```
                         Internet
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                      AWS Cloud                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                VPC (10.0.0.0/16)                    │  │
│  │                                                      │  │
│  │  ┌──────────────────┐    ┌──────────────────┐     │  │
│  │  │ Public Subnet 1  │    │ Public Subnet 2  │     │  │
│  │  │   10.0.0.0/24    │    │   10.0.1.0/24    │     │  │
│  │  │                  │    │                  │     │  │
│  │  │  ┌────────────┐  │    │  ┌────────────┐  │     │  │
│  │  │  │    ALB     │  │    │  │  NAT GW    │  │     │  │
│  │  │  └────────────┘  │    │  └────────────┘  │     │  │
│  │  └──────────────────┘    └──────────────────┘     │  │
│  │           │                       │               │  │
│  │           ▼                       ▼               │  │
│  │  ┌──────────────────┐    ┌──────────────────┐     │  │
│  │  │ Private Subnet 1 │    │ Private Subnet 2 │     │  │
│  │  │   10.0.10.0/24   │    │   10.0.11.0/24   │     │  │
│  │  │                  │    │                  │     │  │
│  │  │  ┌────────────┐  │    │  ┌────────────┐  │     │  │
│  │  │  │ ECS Tasks  │  │    │  │ ECS Tasks  │  │     │  │
│  │  │  │ Frontend   │  │    │  │ Currency   │  │     │  │
│  │  │  └────────────┘  │    │  └────────────┘  │     │  │
│  │  │  ┌────────────┐  │    │  ┌────────────┐  │     │  │
│  │  │  │ElastiCache │  │    │  │    RDS     │  │     │  │
│  │  │  │   Redis    │  │    │  │  Postgres  │  │     │  │
│  │  │  └────────────┘  │    │  └────────────┘  │     │  │
│  │  └──────────────────┘    └──────────────────┘     │  │
│  │                                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Security Groups:                                          │
│  • ALB SG: Allow 80,443 from 0.0.0.0/0                    │
│  • ECS SG: Allow 8080 from ALB SG                         │
│  • Redis SG: Allow 6379 from ECS SG                       │
│  • RDS SG: Allow 5432 from ECS SG                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: VPC - Network Foundation

### 1.1. VPC Terraform Code

Setup network infrastructure:

**File**: `terraform/vpc.tf`

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "boutique-vpc"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "boutique-public-subnet-${count.index + 1}"
    Type = "public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "boutique-private-subnet-${count.index + 1}"
    Type = "private"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "boutique-igw"
  }
}

# NAT Gateway
resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  tags = {
    Name = "boutique-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "boutique-nat-${count.index + 1}"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "boutique-public-rt"
  }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "boutique-private-rt-${count.index + 1}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
```

### 1.2. Phân tích VPC Setup

**1. VPC CIDR Block**

```hcl
cidr_block = "10.0.0.0/16"
```

**Giải thích**:
- CIDR `/16` = 65,536 địa chỉ IP
- Range: 10.0.0.0 → 10.0.255.255
- Đủ cho hàng ngàn resources

**Tại sao 10.0.0.0/16?**
- Private IP range (RFC 1918)
- Không conflict với internet
- Flexible để chia subnets

**2. DNS Settings**

```hcl
enable_dns_hostnames = true
enable_dns_support   = true
```

**Tại sao cần?**
- ECS tasks cần resolve service names
- RDS endpoints cần DNS
- Internal service discovery

**3. Public Subnets**

```hcl
cidr_block = "10.0.${count.index}.0/24"
map_public_ip_on_launch = true
```

**Giải thích**:
- 2 public subnets: `10.0.0.0/24`, `10.0.1.0/24`
- Mỗi subnet: 256 IPs
- Auto-assign public IP cho EC2/ECS

**Tại sao 2 subnets?**
- High availability: 2 AZs (Availability Zones)
- ALB requires minimum 2 AZs
- Redundancy: 1 AZ down, still working

**4. Private Subnets**

```hcl
cidr_block = "10.0.${count.index + 10}.0/24"
```

**Giải thích**:
- 2 private subnets: `10.0.10.0/24`, `10.0.11.0/24`
- ECS tasks chạy trong private subnets
- Không có public IP

**Tại sao private?**
- Security: Backend services không expose ra internet
- Only accessible qua ALB
- Reduced attack surface

**5. Internet Gateway**

```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}
```

**Tại sao cần?**
- Public subnets cần access internet
- ALB nhận traffic từ internet
- Public traffic in/out

**6. NAT Gateway**

```hcl
resource "aws_nat_gateway" "main" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}
```

**Giải thích**:
- 2 NAT Gateways (1 per AZ)
- NAT trong public subnet
- Elastic IP attached

**Tại sao cần NAT?**
- Private subnets cần pull Docker images
- Download packages, updates
- Outbound traffic only (không accept inbound)

**Tại sao 2 NAT Gateways?**
- High availability: 1 NAT fail, còn 1 NAT
- Cost vs availability tradeoff
- Production best practice

**7. Route Tables**

```hcl
# Public route
route {
  cidr_block = "0.0.0.0/0"
  gateway_id = aws_internet_gateway.main.id
}

# Private route
route {
  cidr_block     = "0.0.0.0/0"
  nat_gateway_id = aws_nat_gateway.main[count.index].id
}
```

**Giải thích**:
- Public RT → Internet Gateway
- Private RT → NAT Gateway
- `0.0.0.0/0` = default route (all traffic)

### 1.3. VPC Architecture

**<VPC Network Diagram - Public/Private Subnets across 2 AZs với IGW và NAT>**

---

## Part 2: Application Load Balancer

### 2.1. ALB Terraform Code

**File**: `terraform/alb.tf`

```hcl
# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "boutique-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "boutique-alb-sg"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "boutique-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "boutique-alb"
    Environment = "production"
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name        = "boutique-frontend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/healthz"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "boutique-frontend-tg"
  }
}

# Listener - HTTP
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener - HTTPS (with redirect)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
```

### 2.2. Phân tích ALB

**1. ALB Security Group**

```hcl
ingress {
  from_port   = 80
  to_port     = 80
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}
```

**Giải thích**:
- Allow HTTP (80) và HTTPS (443) từ internet
- `0.0.0.0/0` = anywhere
- Egress: allow all outbound

**Tại sao?**
- ALB là entry point, cần public access
- Users từ anywhere có thể truy cập
- Outbound để connect tới ECS tasks

**2. ALB Configuration**

```hcl
internal           = false
load_balancer_type = "application"
subnets            = aws_subnet.public[*].id
```

**Giải thích**:
- `internal = false`: Internet-facing ALB
- `application`: Layer 7 load balancer (HTTP/HTTPS)
- Deploy trong public subnets

**Tại sao Application LB?**
- HTTP/HTTPS routing
- Path-based routing: `/api/*` → backend
- Host-based routing: `api.example.com` → API service
- WebSocket support

**3. Cross-Zone Load Balancing**

```hcl
enable_cross_zone_load_balancing = true
```

**Tại sao?**
- Distribute traffic evenly across all AZs
- Tránh imbalance khi 1 AZ có ít targets hơn
- Better resource utilization

**4. Target Group**

```hcl
target_type = "ip"
port        = 8080
```

**Giải thích**:
- `ip`: Target là IP addresses (ECS tasks)
- Port 8080: Container port của frontend

**Tại sao target_type = ip?**
- ECS Fargate chỉ support IP targets
- Dynamic IPs: Tasks có thể thay đổi IP
- ALB tự động register/deregister

**5. Health Check**

```hcl
health_check {
  path                = "/healthz"
  healthy_threshold   = 2
  unhealthy_threshold = 3
  interval            = 30
}
```

**Giải thích**:
- Check `/healthz` mỗi 30 giây
- 2 lần success → healthy
- 3 lần fail → unhealthy

**Tại sao?**
- ALB chỉ route traffic tới healthy targets
- Auto remove unhealthy tasks
- Zero downtime deployments

**6. Deregistration Delay**

```hcl
deregistration_delay = 30
```

**Tại sao?**
- Khi task stop, ALB đợi 30s trước khi remove
- Existing connections có thể finish
- Graceful shutdown

**7. SSL/TLS Configuration**

```hcl
ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"
```

**Tại sao?**
- Modern TLS 1.3 and TLS 1.2
- Secure ciphers only
- Best practice security

### 2.3. ALB Traffic Flow

**<ALB Traffic Flow - Internet → ALB → Target Group → ECS Tasks>**

---

## Part 3: ECS Cluster và Task Definitions

### 3.1. ECS Cluster

**File**: `terraform/ecs.tf`

```hcl
# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "boutique-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "boutique-cluster"
    Environment = "production"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/boutique"
  retention_in_days = 30

  tags = {
    Name = "boutique-ecs-logs"
  }
}
```

### 3.2. Task Definition - Frontend

```hcl
# Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "boutique-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task Definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "boutique-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${aws_ecr_repository.frontend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "8080"
        },
        {
          name  = "PRODUCT_CATALOG_SERVICE_ADDR"
          value = "productcatalogservice.local:3550"
        },
        {
          name  = "CURRENCY_SERVICE_ADDR"
          value = "currencyservice.local:7000"
        },
        {
          name  = "CART_SERVICE_ADDR"
          value = "cartservice.local:7070"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "frontend"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -q --spider http://localhost:8080/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "boutique-frontend-task"
  }
}
```

### 3.3. ECS Service

```hcl
# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "boutique-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Traffic from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "boutique-ecs-tasks-sg"
  }
}

# ECS Service
resource "aws_ecs_service" "frontend" {
  name            = "boutique-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 8080
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "boutique-frontend-service"
  }
}
```

### 3.4. Phân tích ECS

**1. Container Insights**

```hcl
setting {
  name  = "containerInsights"
  value = "enabled"
}
```

**Tại sao?**
- Monitoring: CPU, memory, network metrics
- CloudWatch dashboards
- Troubleshooting performance issues

**2. Fargate Launch Type**

```hcl
requires_compatibilities = ["FARGATE"]
network_mode             = "awsvpc"
```

**Tại sao Fargate?**
- Serverless: Không cần manage EC2
- Pay per use: Only running tasks
- Auto scaling
- Less operational overhead

**3. CPU và Memory**

```hcl
cpu    = "256"  # 0.25 vCPU
memory = "512"  # 512 MB
```

**Tại sao 256/512?**
- Frontend service nhẹ, không cần nhiều resources
- Cost optimization
- Có thể scale horizontally (more tasks)

**4. Task Execution Role**

```hcl
execution_role_arn = aws_iam_role.ecs_task_execution.arn
```

**Tại sao cần?**
- Pull images từ ECR
- Write logs to CloudWatch
- Access Secrets Manager

**5. Service Discovery**

```hcl
environment = [
  {
    name  = "PRODUCT_CATALOG_SERVICE_ADDR"
    value = "productcatalogservice.local:3550"
  }
]
```

**Giải thích**:
- Service discovery qua AWS Cloud Map
- DNS: `productcatalogservice.local`
- Internal communication

**6. Deployment Configuration**

```hcl
deployment_configuration {
  maximum_percent         = 200
  minimum_healthy_percent = 100
}
```

**Giải thích**:
- `maximum_percent = 200`: Có thể chạy 2x tasks during deployment
- `minimum_healthy_percent = 100`: Luôn có minimum tasks healthy

**Tại sao 200/100?**
- Zero downtime deployments
- Rolling update: Start new tasks → Stop old tasks
- Always have 2 healthy tasks minimum

**7. ECS Task Security Group**

```hcl
ingress {
  from_port       = 8080
  security_groups = [aws_security_group.alb.id]
}
```

**Tại sao?**
- Only accept traffic từ ALB
- No direct internet access
- Security best practice

### 3.5. ECS Architecture

**<ECS Service Architecture - ALB → Target Group → ECS Tasks trong Private Subnets>**

---

## Part 4: Auto Scaling

### 4.1. Auto Scaling Configuration

**File**: `terraform/autoscaling.tf`

```hcl
# Auto Scaling Target
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - CPU
resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "boutique-frontend-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - Memory
resource "aws_appautoscaling_policy" "ecs_memory" {
  name               = "boutique-frontend-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - ALB Request Count
resource "aws_appautoscaling_policy" "ecs_requests" {
  name               = "boutique-frontend-requests-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.frontend.arn_suffix}"
    }
    target_value       = 1000.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

### 4.2. Phân tích Auto Scaling

**1. Capacity Limits**

```hcl
max_capacity = 10
min_capacity = 2
```

**Tại sao?**
- Minimum 2 tasks: High availability
- Maximum 10 tasks: Cost control
- Scale giữa 2-10 tasks based on metrics

**2. CPU-based Scaling**

```hcl
predefined_metric_type = "ECSServiceAverageCPUUtilization"
target_value           = 70.0
```

**Giải thích**:
- Target: 70% CPU utilization
- CPU > 70% → scale out (add tasks)
- CPU < 70% → scale in (remove tasks)

**Tại sao 70%?**
- Headroom cho traffic spikes
- Không quá aggressive (prevent thrashing)
- Cost-effective

**3. Cooldown Periods**

```hcl
scale_in_cooldown  = 300  # 5 minutes
scale_out_cooldown = 60   # 1 minute
```

**Tại sao khác nhau?**
- Scale out nhanh: Handle traffic spike immediately
- Scale in chậm: Avoid flapping, ensure traffic stable
- Cost optimization: Keep tasks longer

**4. Multiple Metrics**

- CPU utilization
- Memory utilization
- ALB request count per target

**Tại sao 3 metrics?**
- Different bottlenecks: CPU-bound vs memory-bound
- Request-based: Scale based on actual traffic
- Comprehensive coverage

### 4.3. Auto Scaling Flow

**<Auto Scaling Diagram - CloudWatch Metrics → Auto Scaling Policies → ECS Service Scaling>**

---

## Part 5: ElastiCache cho Redis

### 5.1. ElastiCache Setup

**File**: `terraform/elasticache.tf`

```hcl
# Security Group for Redis
resource "aws_security_group" "redis" {
  name        = "boutique-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "boutique-redis-sg"
  }
}

# Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "boutique-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "boutique-redis-subnet-group"
  }
}

# ElastiCache Replication Group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "boutique-redis"
  replication_group_description = "Redis for cart service"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 2
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true
  auth_token                 = random_password.redis_auth.result

  automatic_failover_enabled = true
  multi_az_enabled           = true

  maintenance_window       = "sun:05:00-sun:07:00"
  snapshot_window          = "03:00-05:00"
  snapshot_retention_limit = 5

  tags = {
    Name        = "boutique-redis"
    Environment = "production"
  }
}

# Random password for Redis
resource "random_password" "redis_auth" {
  length  = 32
  special = true
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth" {
  name = "boutique/redis/auth-token"

  tags = {
    Name = "boutique-redis-auth"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}
```

### 5.2. Phân tích ElastiCache

**1. Replication Group**

```hcl
num_cache_clusters         = 2
automatic_failover_enabled = true
multi_az_enabled           = true
```

**Tại sao?**
- 2 nodes: Primary + Replica
- Multi-AZ: High availability
- Auto failover: Primary fail → Replica promoted

**2. Encryption**

```hcl
at_rest_encryption_enabled = true
transit_encryption_enabled = true
auth_token_enabled         = true
```

**Tại sao?**
- At-rest: Data encrypted on disk
- In-transit: TLS encryption
- Auth token: Password protection

**3. Node Type**

```hcl
node_type = "cache.t3.micro"
```

**Tại sao t3.micro?**
- Small cache for cart data
- Cost-effective
- Có thể upgrade later

**4. Backup Configuration**

```hcl
snapshot_retention_limit = 5
snapshot_window          = "03:00-05:00"
```

**Tại sao?**
- Daily backups
- 5 days retention
- Off-peak hours (3-5 AM)

---

## Part 6: Terraform Best Practices

### 6.1. Variables và Outputs

**File**: `terraform/variables.tf`

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "frontend_task_count" {
  description = "Number of frontend tasks"
  type        = number
  default     = 2
}

variable "enable_container_insights" {
  description = "Enable Container Insights"
  type        = bool
  default     = true
}
```

**File**: `terraform/outputs.tf`

```hcl
output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}
```

### 6.2. Backend Configuration

**File**: `terraform/backend.tf`

```hcl
terraform {
  backend "s3" {
    bucket         = "boutique-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "boutique-terraform-locks"
  }

  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Project     = "boutique"
    }
  }
}
```

### 6.3. Best Practices Summary

**1. State Management**
- S3 backend với encryption
- DynamoDB table cho state locking
- Versioning enabled

**2. Tagging Strategy**
- Consistent tags: Name, Environment, ManagedBy
- Resource tracking
- Cost allocation

**3. Security**
- Private subnets cho workloads
- Security groups với least privilege
- Secrets trong Secrets Manager
- Encryption at rest và in transit

**4. High Availability**
- Multi-AZ deployment
- Auto scaling
- Health checks
- Graceful shutdown

**5. Cost Optimization**
- Fargate Spot cho non-critical workloads
- Right-sizing: t3.micro cho small workloads
- Auto scaling: Scale down khi idle

---

## Part 7: Deploy Commands

### 7.1. Terraform Workflow

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan changes
terraform plan -out=tfplan

# Review plan
terraform show tfplan

# Apply changes
terraform apply tfplan

# Show outputs
terraform output

# Destroy infrastructure (careful!)
terraform destroy
```

### 7.2. Verify Deployment

```bash
# Get ALB DNS
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test application
curl http://${ALB_DNS}

# Check ECS services
aws ecs list-services --cluster boutique-cluster

# View logs
aws logs tail /ecs/boutique --follow

# Check task health
aws ecs describe-services \
  --cluster boutique-cluster \
  --services boutique-frontend
```

---

## Kết luận

### Key Takeaways

**AWS Infrastructure**:
- **VPC**: Network foundation với public/private subnets, NAT, IGW
- **ECS**: Serverless container orchestration với Fargate
- **ALB**: Layer 7 load balancing với health checks
- **Auto Scaling**: Dynamic scaling based on metrics
- **ElastiCache**: Managed Redis cho caching

**Terraform Best Practices**:
- Infrastructure as Code: Version control
- State management: S3 + DynamoDB
- Modular design: Separate files per resource type
- Variables và outputs: Reusable, flexible

**Production Readiness**:
- High availability: Multi-AZ, auto scaling
- Security: Private subnets, security groups, encryption
- Monitoring: Container Insights, CloudWatch
- Cost optimization: Right-sizing, auto scaling

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: aws, ecs, terraform, infrastructure-as-code, devops

**Published**: November 17, 2025
**Level**: Intermediate
