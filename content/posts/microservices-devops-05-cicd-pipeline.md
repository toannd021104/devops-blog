---
title: "Deploy Microservices #5: CI/CD Pipeline với GitHub Actions"
date: 2024-11-14T13:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Xây dựng CI/CD pipeline hoàn chỉnh với GitHub Actions. Auto test, build, push Docker images, và deploy lên Kubernetes cluster."
categories: ["Microservices", "DevOps", "CI/CD"]
tags: ["github-actions", "cicd", "automation", "kubernetes", "docker", "aws"]
series: ["Deploy Microservices - Full DevOps"]
showToc: true
TocOpen: true
---

## Giới thiệu

Cuối cùng - tự động hóa toàn bộ! Mỗi lần push code:

1. ✅ Run tests tự động
2. ✅ Build Docker image
3. ✅ Security scan
4. ✅ Push lên ECR
5. ✅ Deploy lên Kubernetes
6. ✅ Notify kết quả

## GitHub Actions Workflow

### Full Pipeline

**.github/workflows/deploy.yml:**

```yaml
name: Deploy Microservices

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

env:
  AWS_REGION: ap-southeast-1
  EKS_CLUSTER: microservices-dev
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-southeast-1.amazonaws.com

jobs:
  # Job 1: Test
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [product-service, cart-service, checkout-service]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Go
      if: matrix.service == 'product-service'
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Setup Node.js
      if: matrix.service == 'cart-service'
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: |
        cd ${{ matrix.service }}
        if [ -f "go.mod" ]; then
          go mod download
        elif [ -f "package.json" ]; then
          npm ci
        fi

    - name: Run linter
      run: |
        cd ${{ matrix.service }}
        if [ -f "go.mod" ]; then
          go vet ./...
        elif [ -f "package.json" ]; then
          npm run lint
        fi

    - name: Run tests
      run: |
        cd ${{ matrix.service }}
        if [ -f "go.mod" ]; then
          go test -v -race -coverprofile=coverage.txt ./...
        elif [ -f "package.json" ]; then
          npm test -- --coverage
        fi

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./${{ matrix.service }}/coverage.txt

  # Job 2: Build and Push
  build:
    name: Build and Push Images
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    strategy:
      matrix:
        service: [product-service, cart-service, checkout-service, payment-service, frontend]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Build Docker image
      uses: docker/build-push-action@v5
      with:
        context: ./${{ matrix.service }}
        push: false
        load: true
        tags: |
          ${{ env.ECR_REGISTRY }}/microservices/${{ matrix.service }}:${{ github.sha }}
          ${{ env.ECR_REGISTRY }}/microservices/${{ matrix.service }}:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Run Trivy security scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.ECR_REGISTRY }}/microservices/${{ matrix.service }}:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'

    - name: Upload Trivy results to GitHub Security
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Push to ECR
      run: |
        docker push ${{ env.ECR_REGISTRY }}/microservices/${{ matrix.service }}:${{ github.sha }}
        docker push ${{ env.ECR_REGISTRY }}/microservices/${{ matrix.service }}:latest

  # Job 3: Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging-api.yourdomain.com

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig \
          --region ${{ env.AWS_REGION }} \
          --name ${{ env.EKS_CLUSTER }}

    - name: Install kubectl
      uses: azure/setup-kubectl@v3

    - name: Deploy to Kubernetes
      run: |
        # Update image tags in manifests
        cd k8s
        for service in product-service cart-service checkout-service payment-service frontend; do
          kubectl set image deployment/${service} \
            ${service}=${{ env.ECR_REGISTRY }}/microservices/${service}:${{ github.sha }} \
            -n microservices-staging
        done

    - name: Verify deployment
      run: |
        kubectl rollout status deployment/product-service -n microservices-staging --timeout=5m
        kubectl rollout status deployment/cart-service -n microservices-staging --timeout=5m

    - name: Run smoke tests
      run: |
        kubectl run curl --image=curlimages/curl -i --rm --restart=Never -- \
          curl -f http://product-service.microservices-staging.svc.cluster.local/healthz

  # Job 4: Deploy to Production
  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.yourdomain.com
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig \
          --region ${{ env.AWS_REGION }} \
          --name microservices-prod

    - name: Deploy with Helm
      run: |
        helm upgrade --install microservices ./helm-chart \
          --namespace microservices \
          --set image.tag=${{ github.sha }} \
          --set environment=production \
          --wait \
          --timeout 10m

    - name: Verify deployment
      run: |
        kubectl get pods -n microservices
        kubectl get svc -n microservices

  # Job 5: Notify
  notify:
    name: Notify Deployment Status
    needs: [deploy-staging, deploy-production]
    runs-on: ubuntu-latest
    if: always()

    steps:
    - name: Slack Notification
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: |
          Deployment Status: ${{ job.status }}
          Commit: ${{ github.sha }}
          Author: ${{ github.actor }}
          Message: ${{ github.event.head_commit.message }}
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Setup GitHub Secrets

```bash
# Required secrets in GitHub repo settings:
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_ACCOUNT_ID=123456789012
SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
```

## Rollback Strategy

### Manual Rollback

```bash
# List revisions
kubectl rollout history deployment/product-service -n microservices

# Rollback to previous version
kubectl rollout undo deployment/product-service -n microservices

# Rollback to specific revision
kubectl rollout undo deployment/product-service --to-revision=3 -n microservices
```

### Automated Rollback Workflow

**.github/workflows/rollback.yml:**

```yaml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to rollback'
        required: true
        type: choice
        options:
        - product-service
        - cart-service
        - all
      revision:
        description: 'Revision number (empty for previous)'
        required: false
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
    - name: Configure AWS
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-southeast-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name microservices-prod --region ap-southeast-1

    - name: Rollback
      run: |
        if [ "${{ github.event.inputs.service }}" == "all" ]; then
          for svc in product-service cart-service checkout-service; do
            kubectl rollout undo deployment/${svc} -n microservices
          done
        else
          if [ -n "${{ github.event.inputs.revision }}" ]; then
            kubectl rollout undo deployment/${{ github.event.inputs.service }} \
              --to-revision=${{ github.event.inputs.revision }} -n microservices
          else
            kubectl rollout undo deployment/${{ github.event.inputs.service }} -n microservices
          fi
        fi
```

## Blue-Green Deployment

```yaml
# blue-green-deploy.yml
- name: Switch Traffic to Green
  run: |
    # Deploy green version
    kubectl apply -f k8s/green/

    # Wait for ready
    kubectl wait --for=condition=available --timeout=5m \
      deployment/product-service-green -n microservices

    # Switch service selector
    kubectl patch service product-service -n microservices \
      -p '{"spec":{"selector":{"version":"green"}}}'

    # Verify
    sleep 30

    # If success, delete blue
    kubectl delete deployment product-service-blue -n microservices
```

## Monitoring Pipeline

### GitHub Actions Dashboard

```yaml
# Status badge in README.md
![Deploy Status](https://github.com/username/repo/workflows/Deploy%20Microservices/badge.svg)
```

### Metrics

```yaml
- name: Deployment Metrics
  run: |
    echo "::notice::Deployment completed in ${{ job.duration }} seconds"
    echo "::notice::Image size: $(docker image inspect $IMAGE | jq '.[0].Size')"
```

## Best Practices

### 1. Environment Protection Rules

GitHub Settings → Environments → Production:
- ✅ Required reviewers (2 approvals)
- ✅ Wait timer (5 minutes)
- ✅ Deployment branches (main only)

### 2. Secrets Management

```yaml
# Use AWS Secrets Manager
- name: Get secrets
  run: |
    SECRET=$(aws secretsmanager get-secret-value \
      --secret-id microservices/prod/db-password \
      --query SecretString --output text)
    echo "::add-mask::$SECRET"
    echo "DB_PASSWORD=$SECRET" >> $GITHUB_ENV
```

### 3. Resource Limits

```yaml
# Prevent runaway workflows
timeout-minutes: 30

# Concurrency control
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true
```

## Summary

Series hoàn thành! Chúng ta đã đi qua:

1. ✅ **Bài 1**: Kiến trúc microservices
2. ✅ **Bài 2**: Infrastructure với Terraform
3. ✅ **Bài 3**: Dockerize applications
4. ✅ **Bài 4**: Deploy lên Kubernetes
5. ✅ **Bài 5**: CI/CD automation ✨

**Kết quả:**
- Production-ready microservices platform
- Fully automated CI/CD
- Infrastructure as Code
- Monitoring và observability
- Security best practices

**Next steps:**
- Add monitoring (Prometheus/Grafana)
- Implement service mesh (Istio)
- Setup log aggregation (ELK)
- Add chaos engineering tests

---

*Cảm ơn đã follow series! Happy deploying! 🚀*
