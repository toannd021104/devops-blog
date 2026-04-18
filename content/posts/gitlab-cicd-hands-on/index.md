---
title: "Part 6: GitLab CI/CD - Automate Build, Test, Deploy"
date: 2025-11-17T09:00:00+07:00
draft: false
tags: ["gitlab", "cicd", "devops", "automation", "docker"]
categories: ["DevOps", "CI/CD"]
series: ["DevOps Skills Showcase"]
weight: 6
description: "Part 6 - Phân tích GitLab CI/CD pipeline: Build Docker images, run tests, security scanning, deploy to AWS ECS"
ShowToc: true
TocOpen: true
---

> **Part 6 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → GitLab CI/CD → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

---

# Giới thiệu

Bài viết này phân tích GitLab CI/CD pipeline cho project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform).

Chúng ta sẽ xem xét:
- GitLab CI/CD pipeline structure
- Multi-stage pipeline: Build, Test, Security, Deploy
- Docker image build và push to registry
- Multi-environment deployment (dev, staging, prod)
- Best practices cho production

---

## Pipeline Architecture

```
GitLab CI/CD Pipeline
═══════════════════════════════════════════════════════════

Stage 1: BUILD                  Stage 2: TEST
┌──────────────────┐           ┌──────────────────┐
│ build:frontend   │           │ test:frontend    │
│ build:currency   │    ──▶    │ test:currency    │
│ build:cart       │           │ test:cart        │
│ (parallel)       │           │ (parallel)       │
└──────────────────┘           └──────────────────┘
         │                              │
         ▼                              ▼
Stage 3: SECURITY              Stage 4: DEPLOY
┌──────────────────┐           ┌──────────────────┐
│ trivy-scan       │           │ deploy:dev       │
│ sast             │    ──▶    │ deploy:staging   │
│ dependency-check │           │ deploy:prod      │
│ (parallel)       │           │ (manual)         │
└──────────────────┘           └──────────────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │  health-check    │
                               │  (post-deploy)   │
                               └──────────────────┘

Environments:
• dev       → auto-deploy from 'develop' branch
• staging   → manual deploy from 'main' branch
• prod      → manual deploy after staging success
```

---

## Part 1: Pipeline Overview

### 1.1. Complete .gitlab-ci.yml

**File**: `.gitlab-ci.yml`

```yaml
# GitLab CI/CD Pipeline for Microservices

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  AWS_DEFAULT_REGION: us-east-1
  ECR_REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  ECS_CLUSTER: boutique-cluster

# Define stages
stages:
  - build
  - test
  - security
  - deploy

# Default configuration
default:
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - apk add --no-cache curl jq python3 py3-pip
    - pip3 install awscli
    - docker --version

# Templates
.docker_build_template: &docker_build_template
  stage: build
  script:
    - echo "Building $SERVICE_NAME"
    - cd src/$SERVICE_NAME
    - docker build --pull --cache-from $ECR_REGISTRY/$SERVICE_NAME:latest -t $SERVICE_NAME:$CI_COMMIT_SHORT_SHA .
    - docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA
    - docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:latest
  only:
    - main
    - develop
    - merge_requests

.docker_push_template: &docker_push_template
  script:
    - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    - docker push $ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA
    - docker push $ECR_REGISTRY/$SERVICE_NAME:latest

#############################################
# Build Stage - Build Docker Images
#############################################

build:frontend:
  <<: *docker_build_template
  variables:
    SERVICE_NAME: frontend
  artifacts:
    paths:
      - src/frontend/
    expire_in: 1 hour

build:productcatalog:
  <<: *docker_build_template
  variables:
    SERVICE_NAME: productcatalogservice
  artifacts:
    paths:
      - src/productcatalogservice/
    expire_in: 1 hour

build:currency:
  <<: *docker_build_template
  variables:
    SERVICE_NAME: currencyservice
  artifacts:
    paths:
      - src/currencyservice/
    expire_in: 1 hour

build:cart:
  <<: *docker_build_template
  variables:
    SERVICE_NAME: cartservice
  artifacts:
    paths:
      - src/cartservice/
    expire_in: 1 hour

#############################################
# Test Stage - Run Tests
#############################################

test:frontend:
  stage: test
  image: golang:1.23-alpine
  script:
    - cd src/frontend
    - go test -v -race -coverprofile=coverage.out ./...
    - go tool cover -func=coverage.out
  coverage: '/total:\s+\(statements\)\s+(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: src/frontend/coverage.out
  only:
    - main
    - develop
    - merge_requests

test:currency:
  stage: test
  image: node:20-alpine
  script:
    - cd src/currencyservice
    - npm ci
    - npm run test -- --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      junit: src/currencyservice/test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: src/currencyservice/coverage/cobertura-coverage.xml
  only:
    - main
    - develop
    - merge_requests

test:cart:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - cd src/cartservice/src
    - dotnet test --collect:"XPlat Code Coverage" --logger "junit;LogFilePath=test-results.xml"
  artifacts:
    reports:
      junit: src/cartservice/src/test-results.xml
  only:
    - main
    - develop
    - merge_requests

#############################################
# Security Stage - Security Scanning
#############################################

security:trivy-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy --version
    - trivy image --severity HIGH,CRITICAL --exit-code 0 --no-progress $SERVICE_NAME:$CI_COMMIT_SHORT_SHA
  variables:
    SERVICE_NAME: frontend
  allow_failure: true
  only:
    - main
    - develop

security:sast:
  stage: security
  image: returntocorp/semgrep
  script:
    - semgrep --config=auto --json -o sast-report.json src/
  artifacts:
    reports:
      sast: sast-report.json
    expire_in: 1 week
  allow_failure: true
  only:
    - main
    - develop

security:dependency-check:
  stage: security
  image: node:20-alpine
  script:
    - npm install -g npm-audit-html
    - cd src/currencyservice
    - npm audit --json | npm-audit-html --output=audit-report.html
  artifacts:
    paths:
      - src/currencyservice/audit-report.html
    expire_in: 1 week
  allow_failure: true
  only:
    - main
    - develop

#############################################
# Deploy Stage - Deploy to Environments
#############################################

.deploy_template: &deploy_template
  stage: deploy
  image: amazon/aws-cli:latest
  before_script:
    - yum install -y jq
  script:
    - echo "Deploying $SERVICE_NAME to $ENVIRONMENT"
    - |
      # Get current task definition
      TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition $SERVICE_NAME --region $AWS_DEFAULT_REGION)

      # Update image in task definition
      NEW_TASK_DEF=$(echo $TASK_DEFINITION | jq --arg IMAGE "$ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA" '.taskDefinition | .containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

      # Register new task definition
      NEW_REVISION=$(aws ecs register-task-definition --region $AWS_DEFAULT_REGION --cli-input-json "$NEW_TASK_DEF" | jq -r '.taskDefinition.revision')

      # Update service
      aws ecs update-service --cluster $ECS_CLUSTER --service $SERVICE_NAME --task-definition $SERVICE_NAME:$NEW_REVISION --region $AWS_DEFAULT_REGION

      # Wait for deployment to complete
      aws ecs wait services-stable --cluster $ECS_CLUSTER --services $SERVICE_NAME --region $AWS_DEFAULT_REGION

      echo "Deployment completed successfully"

# Development Environment
deploy:dev:frontend:
  <<: *deploy_template
  variables:
    SERVICE_NAME: frontend
    ENVIRONMENT: development
    ECS_CLUSTER: boutique-dev-cluster
  environment:
    name: development
    url: http://dev.boutique.example.com
  only:
    - develop

# Staging Environment
deploy:staging:frontend:
  <<: *deploy_template
  variables:
    SERVICE_NAME: frontend
    ENVIRONMENT: staging
    ECS_CLUSTER: boutique-staging-cluster
  environment:
    name: staging
    url: http://staging.boutique.example.com
  only:
    - main
  when: manual

# Production Environment
deploy:prod:frontend:
  <<: *deploy_template
  variables:
    SERVICE_NAME: frontend
    ENVIRONMENT: production
    ECS_CLUSTER: boutique-cluster
  environment:
    name: production
    url: https://boutique.example.com
  only:
    - main
  when: manual
  needs:
    - deploy:staging:frontend

#############################################
# Post-Deploy - Health Check
#############################################

health-check:prod:
  stage: .post
  image: curlimages/curl:latest
  script:
    - echo "Running health checks..."
    - |
      for i in {1..10}; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://boutique.example.com/healthz)
        if [ $STATUS -eq 200 ]; then
          echo "Health check passed!"
          exit 0
        fi
        echo "Health check failed (attempt $i/10), retrying..."
        sleep 10
      done
      echo "Health check failed after 10 attempts"
      exit 1
  only:
    - main
  when: on_success
  needs:
    - deploy:prod:frontend
```

### 1.2. Pipeline Structure

**<GitLab Pipeline Stages Diagram>**

---

## Part 2: Variables và Configuration

### 2.1. Global Variables

```yaml
variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  AWS_DEFAULT_REGION: us-east-1
  ECR_REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  ECS_CLUSTER: boutique-cluster
```

**Giải thích**:
- `DOCKER_DRIVER`: Docker storage driver
- `DOCKER_TLS_CERTDIR`: TLS certificates cho Docker daemon
- `AWS_DEFAULT_REGION`: AWS region
- `ECR_REGISTRY`: ECR repository URL
- `ECS_CLUSTER`: ECS cluster name

**Tại sao dùng variables?**
- Reusable: Dùng lại trong nhiều jobs
- Maintainable: Thay đổi 1 chỗ, apply toàn bộ
- Environment-specific: Override per environment

### 2.2. Stages Definition

```yaml
stages:
  - build
  - test
  - security
  - deploy
```

**Giải thích**:
- Stages chạy **sequential** (tuần tự)
- Jobs trong cùng stage chạy **parallel** (song song)
- Stage fail → pipeline stop

**Tại sao 4 stages?**
- **Build**: Create artifacts (Docker images)
- **Test**: Verify functionality
- **Security**: Security scanning
- **Deploy**: Deploy to environments

### 2.3. Default Configuration

```yaml
default:
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - apk add --no-cache curl jq python3 py3-pip
    - pip3 install awscli
```

**Giải thích**:
- `docker:24-dind`: Docker-in-Docker image
- `before_script`: Chạy trước mỗi job
- Install dependencies: curl, jq, awscli

**Tại sao Docker-in-Docker?**
- Build Docker images trong GitLab Runner
- Isolated environment per job
- Clean slate mỗi lần chạy

---

## Part 3: Build Stage - Docker Images

### 3.1. Docker Build Template

```yaml
.docker_build_template: &docker_build_template
  stage: build
  script:
    - cd src/$SERVICE_NAME
    - docker build --pull --cache-from $ECR_REGISTRY/$SERVICE_NAME:latest -t $SERVICE_NAME:$CI_COMMIT_SHORT_SHA .
    - docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA
    - docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:latest
```

**Giải thích**:
- Template (YAML anchor) để reuse
- Build với `--cache-from` để tăng tốc
- Tag với commit SHA và `latest`

**Tại sao dùng template?**
- DRY principle: Don't Repeat Yourself
- Maintain 1 chỗ, apply cho tất cả services
- Consistent build process

### 3.2. Build Jobs

```yaml
build:frontend:
  <<: *docker_build_template
  variables:
    SERVICE_NAME: frontend
  artifacts:
    paths:
      - src/frontend/
    expire_in: 1 hour
```

**Giải thích**:
- Inherit từ template
- Override `SERVICE_NAME` variable
- Save artifacts cho downstream jobs

**Tại sao save artifacts?**
- Test stage cần source code
- Deploy stage cần build context
- Share data giữa jobs

### 3.3. Docker Build Optimization

**1. Cache-from**

```yaml
docker build --cache-from $ECR_REGISTRY/$SERVICE_NAME:latest
```

**Tại sao?**
- Reuse layers từ previous build
- Giảm build time từ 5 phút → 30 giây
- Save bandwidth

**2. Pull Latest**

```yaml
docker build --pull
```

**Tại sao?**
- Always pull latest base image
- Security updates
- Bug fixes

**3. Image Tagging Strategy**

```yaml
- docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA
- docker tag $SERVICE_NAME:$CI_COMMIT_SHORT_SHA $ECR_REGISTRY/$SERVICE_NAME:latest
```

**Tags**:
- Commit SHA: Immutable, traceable
- `latest`: Always points to newest build

**Tại sao 2 tags?**
- SHA: Rollback to specific version
- latest: Development/testing

---

## Part 4: Test Stage - Quality Assurance

### 4.1. Go Tests - Frontend

```yaml
test:frontend:
  stage: test
  image: golang:1.23-alpine
  script:
    - cd src/frontend
    - go test -v -race -coverprofile=coverage.out ./...
    - go tool cover -func=coverage.out
  coverage: '/total:\s+\(statements\)\s+(\d+\.\d+)%/'
```

**Giải thích**:
- `go test -v`: Verbose output
- `-race`: Detect race conditions
- `-coverprofile`: Generate coverage report

**Tại sao race detection?**
- Concurrent code có thể có data races
- Production bugs khó debug
- Catch early trong CI

**Coverage Regex**:
```yaml
coverage: '/total:\s+\(statements\)\s+(\d+\.\d+)%/'
```

**Tại sao?**
- GitLab extract coverage percentage
- Show trong merge request
- Enforce coverage threshold

### 4.2. Node.js Tests - Currency Service

```yaml
test:currency:
  stage: test
  image: node:20-alpine
  script:
    - cd src/currencyservice
    - npm ci
    - npm run test -- --coverage
```

**Giải thích**:
- `npm ci`: Clean install from package-lock.json
- `--coverage`: Generate coverage report

**Tại sao npm ci thay vì npm install?**
- Faster: Skip dependency resolution
- Deterministic: Same versions mọi lần
- CI/CD best practice

### 4.3. .NET Tests - Cart Service

```yaml
test:cart:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - cd src/cartservice/src
    - dotnet test --collect:"XPlat Code Coverage"
```

**Giải thích**:
- `dotnet test`: Run xUnit tests
- `--collect`: Collect code coverage

### 4.4. Test Reports

```yaml
artifacts:
  reports:
    junit: test-results.xml
    coverage_report:
      coverage_format: cobertura
      path: coverage.xml
```

**Tại sao?**
- GitLab hiển thị test results trong UI
- Merge request shows pass/fail
- Coverage tracking over time

---

## Part 5: Security Stage - Vulnerability Scanning

### 5.1. Trivy Container Scanning

```yaml
security:trivy-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --exit-code 0 $SERVICE_NAME:$CI_COMMIT_SHORT_SHA
  allow_failure: true
```

**Giải thích**:
- Trivy: Container vulnerability scanner
- Scan cho HIGH và CRITICAL vulnerabilities
- `--exit-code 0`: Don't fail pipeline

**Tại sao allow_failure?**
- Warning only, không block deployment
- Team review vulnerabilities
- Fix in next iteration

**Trivy checks**:
- OS packages vulnerabilities
- Language-specific packages (npm, pip, etc.)
- Known CVEs

### 5.2. SAST - Static Application Security Testing

```yaml
security:sast:
  stage: security
  image: returntocorp/semgrep
  script:
    - semgrep --config=auto --json -o sast-report.json src/
```

**Giải thích**:
- Semgrep: Static analysis tool
- `--config=auto`: Auto-detect languages
- Generate JSON report

**Semgrep detects**:
- SQL injection
- XSS vulnerabilities
- Hard-coded secrets
- Insecure crypto

### 5.3. Dependency Check

```yaml
security:dependency-check:
  stage: security
  script:
    - npm audit --json | npm-audit-html --output=audit-report.html
```

**Giải thích**:
- `npm audit`: Check npm packages
- Generate HTML report

**Tại sao?**
- Third-party packages có vulnerabilities
- Outdated dependencies
- Compliance requirements

---

## Part 6: Deploy Stage - Multi-Environment

### 6.1. Deploy Template

```yaml
.deploy_template: &deploy_template
  stage: deploy
  script:
    # Get current task definition
    - TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition $SERVICE_NAME)

    # Update image
    - NEW_TASK_DEF=$(echo $TASK_DEFINITION | jq --arg IMAGE "$ECR_REGISTRY/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA" '.taskDefinition | .containerDefinitions[0].image = $IMAGE')

    # Register new task definition
    - NEW_REVISION=$(aws ecs register-task-definition --cli-input-json "$NEW_TASK_DEF" | jq -r '.taskDefinition.revision')

    # Update service
    - aws ecs update-service --cluster $ECS_CLUSTER --service $SERVICE_NAME --task-definition $SERVICE_NAME:$NEW_REVISION

    # Wait for deployment
    - aws ecs wait services-stable --cluster $ECS_CLUSTER --services $SERVICE_NAME
```

**Giải thích**:
1. Get current ECS task definition
2. Update container image to new version
3. Register new task definition revision
4. Update ECS service với new revision
5. Wait for deployment to complete

**Tại sao update thay vì recreate?**
- Rolling update: Zero downtime
- Gradual rollout
- Easy rollback

### 6.2. Development Environment

```yaml
deploy:dev:frontend:
  variables:
    ENVIRONMENT: development
    ECS_CLUSTER: boutique-dev-cluster
  environment:
    name: development
    url: http://dev.boutique.example.com
  only:
    - develop
```

**Giải thích**:
- Auto-deploy từ `develop` branch
- Deploy tới dev cluster
- Environment tracking trong GitLab

**Tại sao auto-deploy dev?**
- Fast feedback loop
- Test features immediately
- No manual intervention

### 6.3. Staging Environment

```yaml
deploy:staging:frontend:
  variables:
    ENVIRONMENT: staging
  environment:
    name: staging
  only:
    - main
  when: manual
```

**Giải thích**:
- Deploy từ `main` branch
- **Manual** deployment
- Staging environment

**Tại sao manual?**
- QA testing trước prod
- Controlled deployment
- Prevent accidental deploys

### 6.4. Production Environment

```yaml
deploy:prod:frontend:
  variables:
    ENVIRONMENT: production
  environment:
    name: production
    url: https://boutique.example.com
  only:
    - main
  when: manual
  needs:
    - deploy:staging:frontend
```

**Giải thích**:
- Manual deployment
- Requires staging deploy success
- Production environment

**Tại sao needs staging?**
- Enforce deployment order
- Test in staging first
- Risk mitigation

### 6.5. Environment Strategy

**<Multi-Environment Deployment Flow Diagram>**

**Deployment Flow**:
1. **Development**: Auto-deploy từ `develop` branch
2. **Staging**: Manual deploy từ `main` branch
3. **Production**: Manual deploy sau staging success

---

## Part 7: Post-Deploy - Health Checks

### 7.1. Health Check Job

```yaml
health-check:prod:
  stage: .post
  image: curlimages/curl:latest
  script:
    - |
      for i in {1..10}; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://boutique.example.com/healthz)
        if [ $STATUS -eq 200 ]; then
          echo "Health check passed!"
          exit 0
        fi
        sleep 10
      done
      exit 1
  when: on_success
  needs:
    - deploy:prod:frontend
```

**Giải thích**:
- `.post` stage: Chạy sau tất cả stages
- Retry 10 lần với 10s interval
- Check `/healthz` endpoint

**Tại sao health check?**
- Verify deployment success
- Catch deployment issues
- Auto-rollback nếu fail

**Retry logic**:
- Service cần thời gian để start
- ECS rolling deployment
- Grace period cho warm-up

---

## Part 8: Advanced Features

### 8.1. Dynamic Child Pipelines

**File**: `.gitlab-ci.yml`

```yaml
generate-pipeline:
  stage: .pre
  script:
    - |
      # Detect changed services
      CHANGED_SERVICES=$(git diff --name-only $CI_COMMIT_BEFORE_SHA $CI_COMMIT_SHA | grep "^src/" | cut -d'/' -f2 | sort -u)

      # Generate dynamic pipeline
      cat > generated-pipeline.yml <<EOF
      stages:
        - build
        - test
      EOF

      for service in $CHANGED_SERVICES; do
        cat >> generated-pipeline.yml <<EOF

      build:$service:
        stage: build
        script:
          - cd src/$service
          - docker build -t $service:latest .
      EOF
      done
  artifacts:
    paths:
      - generated-pipeline.yml

trigger-child-pipeline:
  stage: .pre
  trigger:
    include:
      - artifact: generated-pipeline.yml
        job: generate-pipeline
    strategy: depend
```

**Tại sao dynamic pipeline?**
- Chỉ build changed services
- Save CI/CD time
- Save resources

### 8.2. Parallel Matrix Builds

```yaml
test:matrix:
  stage: test
  parallel:
    matrix:
      - SERVICE: [frontend, currency, cart]
        GO_VERSION: ["1.22", "1.23"]
  script:
    - echo "Testing $SERVICE with Go $GO_VERSION"
```

**Tại sao matrix?**
- Test multiple versions
- Cross-platform testing
- Comprehensive coverage

### 8.3. Cache Configuration

```yaml
build:frontend:
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - src/frontend/.cache/
      - src/frontend/node_modules/
    policy: pull-push
```

**Tại sao cache?**
- Speed up builds
- Reuse dependencies
- Save bandwidth

**Cache vs Artifacts**:
- **Cache**: Temporary, optional (dependencies)
- **Artifacts**: Persistent, required (build outputs)

### 8.4. Protected Variables

**GitLab Settings → CI/CD → Variables**:

```
AWS_ACCESS_KEY_ID (protected, masked)
AWS_SECRET_ACCESS_KEY (protected, masked)
ECR_REGISTRY (protected)
DEPLOY_TOKEN (protected, masked)
```

**Tại sao?**
- Security: Credentials không expose trong logs
- Protected: Chỉ chạy trên protected branches
- Masked: Hidden trong job logs

---

## Part 9: Best Practices

### 9.1. Pipeline Optimization

**1. Parallel Jobs**
```yaml
# Bad: Sequential
build-all:
  script:
    - build service1
    - build service2
    - build service3

# Good: Parallel
build:service1:
  script: build service1

build:service2:
  script: build service2
```

**2. Caching**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/
```

**3. Artifacts Management**
```yaml
artifacts:
  expire_in: 1 week  # Auto cleanup
  paths:
    - dist/
```

### 9.2. Security Best Practices

**1. Secret Management**
- Use GitLab CI/CD variables (masked, protected)
- Never hardcode credentials
- Rotate secrets regularly

**2. Image Scanning**
- Scan containers trước deploy
- Fail pipeline on CRITICAL vulnerabilities
- Keep base images updated

**3. Least Privilege**
- IAM roles với minimum permissions
- Separate credentials per environment
- Audit logs enabled

### 9.3. Deployment Best Practices

**1. Blue-Green Deployment**
```yaml
deploy:blue:
  script:
    - deploy to blue environment
    - run smoke tests
    - switch traffic to blue

deploy:green:
  when: manual
  script:
    - rollback to green
```

**2. Canary Deployment**
```yaml
deploy:canary:
  script:
    - deploy 10% traffic to new version
    - monitor metrics for 10 minutes
    - deploy 100% if metrics good
```

**3. Rollback Strategy**
```yaml
rollback:prod:
  stage: deploy
  when: manual
  script:
    - aws ecs update-service --task-definition previous-revision
```

---

## Part 10: Monitoring và Debugging

### 10.1. Pipeline Analytics

**GitLab provides**:
- Pipeline duration trends
- Job failure rates
- Most time-consuming jobs
- Success rate per branch

### 10.2. Debug Failed Jobs

```yaml
debug:job:
  script:
    - set -x  # Enable verbose mode
    - env | sort  # Print all environment variables
    - ls -la  # List files
    - docker images  # List Docker images
```

### 10.3. Artifacts Download

```bash
# Download artifacts from job
gitlab-ci-artifacts download --job-name build:frontend

# Extract and inspect
unzip artifacts.zip
ls -la
```

---

## Kết luận

### Key Takeaways

**GitLab CI/CD Pipeline**:
- **Stages**: Build → Test → Security → Deploy
- **Parallel Jobs**: Build all services simultaneously
- **Templates**: DRY principle với YAML anchors
- **Multi-Environment**: Dev → Staging → Production

**Best Practices**:
- Automated testing: Unit tests, integration tests
- Security scanning: Container vulnerabilities, SAST
- Multi-environment strategy: Gradual rollout
- Health checks: Verify deployment success
- Caching: Speed up pipeline execution

**Production Readiness**:
- Zero-downtime deployments: Rolling updates
- Rollback capability: Quick revert to previous version
- Monitoring: Pipeline metrics và alerts
- Security: Secrets management, vulnerability scanning

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: gitlab, cicd, devops, automation, docker, ecs

**Published**: November 17, 2025
**Level**: Intermediate
