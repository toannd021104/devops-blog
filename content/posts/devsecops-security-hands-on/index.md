---
title: "Part 7: DevSecOps - Security trong CI/CD Pipeline"
date: 2025-11-17T10:00:00+07:00
draft: false
tags: ["security", "devsecops", "docker", "kubernetes", "aws"]
categories: ["DevOps", "Security"]
series: ["DevOps Skills Showcase"]
weight: 7
description: "Part 7 - Phân tích DevSecOps practices: Container security, secret management, vulnerability scanning, network policies"
ShowToc: true
TocOpen: true
---

> **Part 7 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → DevSecOps → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

---

# Giới thiệu

Bài viết này phân tích security practices cho project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform).

Chúng ta sẽ xem xét:
- Container security scanning
- Secret management best practices
- Kubernetes network policies
- AWS security configurations
- Security in CI/CD pipeline

---

## Security Architecture

**<DevSecOps Pipeline - Security ở mọi stage: Build → Test → Deploy>**

---

## Part 1: Container Security

### 1.1. Dockerfile Security Hardening

**Insecure Dockerfile**:

```dockerfile
# Bad practices
FROM ubuntu:latest

RUN apt-get update && apt-get install -y python3

COPY . /app
WORKDIR /app

RUN pip install -r requirements.txt

USER root
CMD ["python3", "app.py"]
```

**Issues**:
- ❌ `latest` tag: Không reproducible
- ❌ Running as `root`
- ❌ No multi-stage build
- ❌ Không clean up cache

**Secure Dockerfile**:

```dockerfile
# Stage 1: Build
FROM python:3.12.8-alpine@sha256:54bec... AS builder

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    linux-headers

WORKDIR /app

# Copy only requirements first (cache optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.12.8-alpine@sha256:54bec...

# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Set environment
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Security: Drop capabilities
RUN chmod -R 755 /app && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')" || exit 1

EXPOSE 8080

ENTRYPOINT ["python3", "app.py"]
```

### 1.2. Security Best Practices

**1. SHA256 Pinning**

```dockerfile
FROM python:3.12.8-alpine@sha256:54bec49592c8455de8d5983d984efff76b6417a6af9b5dcc8d0237bf6ad3bd20
```

**Tại sao?**
- Immutable: Exact image version
- Prevent supply chain attacks
- Reproducible builds

**2. Non-Root User**

```dockerfile
RUN adduser -D -u 1000 appuser
USER appuser
```

**Tại sao?**
- Least privilege principle
- Container escape → limited damage
- Kubernetes PodSecurityPolicy compliance

**3. Minimal Base Images**

```dockerfile
FROM alpine:3.20.3  # 5 MB
# vs
FROM ubuntu:22.04    # 80 MB
```

**Tại sao alpine?**
- Smaller attack surface
- Fewer packages = fewer vulnerabilities
- Faster downloads

**4. No Secrets in Layers**

```dockerfile
# Bad: Secret visible in image history
RUN echo "API_KEY=secret123" > /app/.env

# Good: Inject at runtime
ENV API_KEY=""
```

**How to verify**:
```bash
docker history <image>  # Shows all layers
docker save <image> -o image.tar
tar -xf image.tar  # Inspect layers
```

### 1.3. Container Scanning

**Trivy Scan**:

```bash
# Install Trivy
brew install aquasecurity/trivy/trivy

# Scan image
trivy image --severity HIGH,CRITICAL myapp:latest

# Output example
myapp:latest (alpine 3.20.3)
===========================
Total: 2 (HIGH: 1, CRITICAL: 1)

┌────────────┬──────────────┬──────────┬─────────────────┐
│  Library   │ Vulnerability│ Severity │ Installed Vers  │
├────────────┼──────────────┼──────────┼─────────────────┤
│ openssl    │ CVE-2024-123 │ CRITICAL │ 3.0.8-r0        │
│ curl       │ CVE-2024-456 │ HIGH     │ 8.1.2-r0        │
└────────────┴──────────────┴──────────┴─────────────────┘

# Fix: Update base image
docker build --pull --no-cache -t myapp:latest .
```

**Grype Scan (Alternative)**:

```bash
# Install Grype
brew install anchore/grype/grype

# Scan with detailed output
grype myapp:latest -o json > vulnerabilities.json

# Fail pipeline on HIGH/CRITICAL
grype myapp:latest --fail-on high
```

### 1.4. Image Signing với Cosign

```bash
# Generate key pair
cosign generate-key-pair

# Sign image
cosign sign --key cosign.key $ECR_REGISTRY/frontend:v1.0.0

# Verify signature
cosign verify --key cosign.pub $ECR_REGISTRY/frontend:v1.0.0
```

**Tại sao sign images?**
- Verify image integrity
- Prevent tampering
- Supply chain security

---

## Part 2: Kubernetes Security

### 2.1. Pod Security Standards

**Pod Security Context**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: frontend
spec:
  securityContext:
    # Pod-level security
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: frontend
    image: frontend:latest
    securityContext:
      # Container-level security
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
        add:
          - NET_BIND_SERVICE

    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: cache
      mountPath: /app/cache

  volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
```

**Giải thích**:

**1. runAsNonRoot**
```yaml
runAsNonRoot: true
runAsUser: 1000
```

**Tại sao?**
- Prevent root exploits
- Kubernetes rejects pods running as root
- Defense in depth

**2. Read-Only Root Filesystem**
```yaml
readOnlyRootFilesystem: true
```

**Tại sao?**
- Prevent malware installation
- Immutable infrastructure
- Force explicit volume mounts

**3. Drop All Capabilities**
```yaml
capabilities:
  drop: [ALL]
  add: [NET_BIND_SERVICE]  # Only if needed
```

**Tại sao?**
- Minimize privileges
- Only add required capabilities
- Reduce attack surface

**4. Seccomp Profile**
```yaml
seccompProfile:
  type: RuntimeDefault
```

**Tại sao?**
- Restrict system calls
- Prevent kernel exploits
- Default profile is good for most apps

### 2.2. Network Policies

**Default Deny All**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: boutique
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

**Allow Frontend → Backend**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: boutique
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Egress
  egress:
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53

  # Allow to product catalog
  - to:
    - podSelector:
        matchLabels:
          app: productcatalogservice
    ports:
    - protocol: TCP
      port: 3550

  # Allow to currency service
  - to:
    - podSelector:
        matchLabels:
          app: currencyservice
    ports:
    - protocol: TCP
      port: 7000

  # Allow to cart service
  - to:
    - podSelector:
        matchLabels:
          app: cartservice
    ports:
    - protocol: TCP
      port: 7070
```

**Allow Only ALB → Frontend**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-alb-to-frontend
  namespace: boutique
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    - podSelector:
        matchLabels:
          app: aws-load-balancer-controller
    ports:
    - protocol: TCP
      port: 8080
```

**Tại sao Network Policies?**
- Microsegmentation: Isolate services
- Zero trust: Deny by default, allow explicitly
- Compliance: PCI-DSS, HIPAA requirements
- Reduce blast radius: Compromised pod can't access others

### 2.3. RBAC - Role-Based Access Control

**Service Account**:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: frontend-sa
  namespace: boutique
automountServiceAccountToken: false
```

**Role - Minimal Permissions**:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: frontend-role
  namespace: boutique
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
  resourceNames: ["frontend-config"]  # Specific ConfigMap only

- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["frontend-secret"]
```

**RoleBinding**:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: frontend-rolebinding
  namespace: boutique
subjects:
- kind: ServiceAccount
  name: frontend-sa
  namespace: boutique
roleRef:
  kind: Role
  name: frontend-role
  apiGroup: rbac.authorization.k8s.io
```

**Use in Deployment**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      serviceAccountName: frontend-sa
      automountServiceAccountToken: true  # Only if needed
```

**Tại sao RBAC?**
- Least privilege: Only required permissions
- Audit trail: Who did what
- Namespace isolation

### 2.4. Secrets Management

**External Secrets Operator**:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: boutique
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: redis-credentials
  namespace: boutique
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: redis-secret
    creationPolicy: Owner
  data:
  - secretKey: password
    remoteRef:
      key: boutique/redis/password
  - secretKey: username
    remoteRef:
      key: boutique/redis/username
```

**Tại sao External Secrets?**
- Centralized secret management
- Automatic rotation
- Audit logging
- No secrets in Git

**Sealed Secrets (Alternative)**:

```bash
# Install kubeseal
brew install kubeseal

# Create sealed secret
kubectl create secret generic mysecret \
  --from-literal=password=secret123 \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Safe to commit to Git
git add sealed-secret.yaml
git commit -m "Add sealed secret"

# Deploy
kubectl apply -f sealed-secret.yaml
```

---

## Part 3: AWS Security

### 3.1. IAM Roles và Policies

**ECS Task Role - Least Privilege**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::boutique-assets/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/boutique-cart"
    }
  ]
}
```

**Terraform IAM Role**:

```hcl
# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task_role" {
  name = "boutique-frontend-task-role"

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

  tags = {
    Name = "boutique-frontend-task-role"
  }
}

# Inline policy - Specific permissions
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "boutique-frontend-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.assets.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.redis_password.arn
        ]
      }
    ]
  })
}
```

**Tại sao least privilege?**
- Limit damage if compromised
- Compliance requirements
- Easier to audit

### 3.2. VPC Security Groups

**ALB Security Group**:

```hcl
resource "aws_security_group" "alb" {
  name        = "boutique-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  # Allow HTTPS only
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Redirect HTTP to HTTPS
  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow outbound to ECS tasks only
  egress {
    description     = "To ECS tasks"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = {
    Name = "boutique-alb-sg"
  }
}
```

**ECS Tasks Security Group**:

```hcl
resource "aws_security_group" "ecs_tasks" {
  name        = "boutique-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  # Only from ALB
  ingress {
    description     = "From ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow outbound HTTPS (for API calls, downloads)
  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow to Redis
  egress {
    description     = "To Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  tags = {
    Name = "boutique-ecs-tasks-sg"
  }
}
```

**Redis Security Group**:

```hcl
resource "aws_security_group" "redis" {
  name        = "boutique-redis-sg"
  description = "Security group for Redis"
  vpc_id      = aws_vpc.main.id

  # Only from ECS tasks
  ingress {
    description     = "From ECS tasks only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # No outbound needed
  egress {
    description = "No outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = []
  }

  tags = {
    Name = "boutique-redis-sg"
  }
}
```

**Security Group Rules Pattern**:

**<Security Groups Architecture - ALB → ECS Tasks → Redis/RDS>**

### 3.3. Encryption

**EBS Volume Encryption**:

```hcl
resource "aws_ebs_encryption_by_default" "enabled" {
  enabled = true
}

resource "aws_kms_key" "ebs" {
  description             = "KMS key for EBS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "boutique-ebs-key"
  }
}

resource "aws_kms_alias" "ebs" {
  name          = "alias/boutique-ebs"
  target_key_id = aws_kms_key.ebs.key_id
}
```

**S3 Bucket Encryption**:

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "boutique-assets"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

**RDS Encryption**:

```hcl
resource "aws_db_instance" "main" {
  identifier     = "boutique-db"
  engine         = "postgres"
  engine_version = "15.4"

  # Encryption at rest
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  # Encryption in transit
  ca_cert_identifier = "rds-ca-rsa2048-g1"

  # Enable backups
  backup_retention_period = 7
  backup_window           = "03:00-04:00"

  # Enable deletion protection
  deletion_protection = true

  tags = {
    Name = "boutique-db"
  }
}
```

---

## Part 4: Security in CI/CD

### 4.1. GitLab CI/CD Security

**Secret Scanning**:

```yaml
secret-scan:
  stage: security
  image: trufflesecurity/trufflehog:latest
  script:
    - trufflehog filesystem . --json > secrets-report.json
  artifacts:
    reports:
      secret_detection: secrets-report.json
  allow_failure: false
  only:
    - merge_requests
```

**Dependency Scanning**:

```yaml
dependency-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy fs --security-checks vuln,config . --format json -o dependency-report.json
  artifacts:
    reports:
      dependency_scanning: dependency-report.json
  only:
    - main
    - merge_requests
```

**SAST - Static Application Security Testing**:

```yaml
sast:
  stage: security
  image: returntocorp/semgrep
  script:
    - semgrep --config=auto --json -o sast-report.json src/
  artifacts:
    reports:
      sast: sast-report.json
  allow_failure: true
```

**Container Scanning**:

```yaml
container-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --exit-code 1 $IMAGE_NAME
  allow_failure: false  # Block deployment on HIGH/CRITICAL
  only:
    - main
```

### 4.2. Pre-commit Hooks

**File**: `.pre-commit-config.yaml`

```yaml
repos:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.5.0
  hooks:
  - id: trailing-whitespace
  - id: end-of-file-fixer
  - id: check-yaml
  - id: check-added-large-files
    args: ['--maxkb=500']
  - id: detect-private-key
  - id: detect-aws-credentials

- repo: https://github.com/Yelp/detect-secrets
  rev: v1.4.0
  hooks:
  - id: detect-secrets
    args: ['--baseline', '.secrets.baseline']

- repo: https://github.com/hadolint/hadolint
  rev: v2.12.0
  hooks:
  - id: hadolint-docker
    name: Lint Dockerfiles

- repo: https://github.com/antonbabenko/pre-commit-terraform
  rev: v1.83.5
  hooks:
  - id: terraform_fmt
  - id: terraform_validate
  - id: terraform_tfsec
```

**Install**:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### 4.3. Security Policies

**Branch Protection**:

GitLab Settings → Repository → Protected Branches:
- ✅ Require approval from code owners
- ✅ Require passing pipeline
- ✅ Require resolved discussions
- ✅ No force push
- ✅ No deletion

**Merge Request Approvals**:

```yaml
# .gitlab/CODEOWNERS
*                    @team-leads
src/frontend/*       @frontend-team
src/currencyservice/* @backend-team
terraform/*          @devops-team
.gitlab-ci.yml       @devops-team @security-team
Dockerfile           @security-team
```

---

## Part 5: Compliance và Auditing

### 5.1. AWS CloudTrail

```hcl
resource "aws_cloudtrail" "main" {
  name                          = "boutique-cloudtrail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.assets.arn}/"]
    }
  }

  tags = {
    Name = "boutique-cloudtrail"
  }
}
```

### 5.2. AWS Config

```hcl
resource "aws_config_configuration_recorder" "main" {
  name     = "boutique-config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_configuration_recorder_status" "main" {
  name       = aws_config_configuration_recorder.main.name
  is_enabled = true
}
```

### 5.3. Security Hub

```hcl
resource "aws_securityhub_account" "main" {}

resource "aws_securityhub_standards_subscription" "cis" {
  standards_arn = "arn:aws:securityhub:us-east-1::standards/cis-aws-foundations-benchmark/v/1.4.0"
}

resource "aws_securityhub_standards_subscription" "pci_dss" {
  standards_arn = "arn:aws:securityhub:us-east-1::standards/pci-dss/v/3.2.1"
}
```

---

## Part 6: Security Monitoring

### 6.1. GuardDuty

```hcl
resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
  }

  tags = {
    Name = "boutique-guardduty"
  }
}
```

### 6.2. Falco - Runtime Security

**Kubernetes DaemonSet**:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: falco
  namespace: security
spec:
  selector:
    matchLabels:
      app: falco
  template:
    metadata:
      labels:
        app: falco
    spec:
      serviceAccountName: falco
      hostNetwork: true
      hostPID: true
      containers:
      - name: falco
        image: falcosecurity/falco:latest
        securityContext:
          privileged: true
        volumeMounts:
        - name: dev
          mountPath: /host/dev
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: boot
          mountPath: /host/boot
          readOnly: true
        - name: lib-modules
          mountPath: /host/lib/modules
          readOnly: true
        - name: etc
          mountPath: /host/etc
          readOnly: true
        - name: falco-config
          mountPath: /etc/falco
      volumes:
      - name: dev
        hostPath:
          path: /dev
      - name: proc
        hostPath:
          path: /proc
      - name: boot
        hostPath:
          path: /boot
      - name: lib-modules
        hostPath:
          path: /lib/modules
      - name: etc
        hostPath:
          path: /etc
      - name: falco-config
        configMap:
          name: falco-config
```

**Falco Rules**:

```yaml
- rule: Shell Spawned in Container
  desc: Detect shell spawned in container
  condition: >
    spawned_process and
    container and
    proc.name in (bash, sh, zsh)
  output: >
    Shell spawned in container
    (user=%user.name container=%container.name
    shell=%proc.name parent=%proc.pname)
  priority: WARNING

- rule: Write Below Etc
  desc: Detect write below /etc
  condition: >
    write and
    container and
    fd.name startswith /etc
  output: >
    File write below /etc
    (user=%user.name file=%fd.name
    container=%container.name)
  priority: ERROR
```

---

## Kết luận

### Key Takeaways

**Container Security**:
- SHA256 pinning, non-root users
- Multi-stage builds, minimal base images
- Vulnerability scanning với Trivy/Grype
- Image signing với Cosign

**Kubernetes Security**:
- Pod Security Standards
- Network Policies: Default deny
- RBAC: Least privilege
- External Secrets Operator

**AWS Security**:
- IAM roles với least privilege
- Security Groups: Layered defense
- Encryption at rest và in transit
- CloudTrail, Config, Security Hub

**DevSecOps Pipeline**:
- Secret scanning: TruffleHog
- SAST: Semgrep
- Dependency scanning: Trivy
- Container scanning: Aqua/Trivy

**Compliance**:
- AWS Config rules
- Security Hub standards (CIS, PCI-DSS)
- GuardDuty threat detection
- Falco runtime security

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: security, devsecops, docker, kubernetes, aws, compliance

**Published**: November 17, 2025
**Level**: Advanced
