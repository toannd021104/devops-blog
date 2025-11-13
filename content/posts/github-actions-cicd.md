---
title: "GitHub Actions: Xây Dựng CI/CD Pipeline Từ A-Z"
date: 2024-01-18T14:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Hướng dẫn chi tiết cách xây dựng CI/CD pipeline với GitHub Actions, từ cơ bản đến nâng cao."
categories: ["CI/CD"]
tags: ["github-actions", "ci-cd", "automation", "devops", "deployment"]
showToc: true
TocOpen: true
---

## Giới thiệu

GitHub Actions là nền tảng CI/CD được tích hợp sẵn trong GitHub, cho phép tự động hóa build, test và deployment workflows.

## Tại sao chọn GitHub Actions?

### Ưu điểm
- ✅ **Free**: 2000 phút/tháng cho private repos, unlimited cho public
- ✅ **Tích hợp sẵn**: Không cần setup server riêng
- ✅ **Marketplace**: Hàng nghìn actions có sẵn
- ✅ **Multi-platform**: Linux, Windows, macOS
- ✅ **Matrix builds**: Test nhiều versions cùng lúc

### So sánh với các nền tảng khác

| Feature | GitHub Actions | GitLab CI | Jenkins |
|---------|---------------|-----------|---------|
| Setup | Dễ | Dễ | Khó |
| Cost | Free tier tốt | Free tier tốt | Self-hosted |
| Integration | GitHub only | GitLab only | Mọi SCM |
| Performance | Tốt | Tốt | Tùy setup |

## Cấu trúc cơ bản

### Workflow File

Tạo file `.github/workflows/ci.yml`:

```yaml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Run tests
      run: npm test
```

### Các thành phần chính

1. **Workflow**: File YAML định nghĩa automation
2. **Event**: Trigger workflow (push, PR, schedule...)
3. **Job**: Tập hợp các steps
4. **Step**: Task đơn lẻ (run command, use action)

## Ví dụ thực tế

### 1. Node.js Application CI/CD

**.github/workflows/nodejs.yml:**

```yaml
name: Node.js CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18.x'

jobs:
  # Job 1: Test
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run tests
      run: npm test

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json

  # Job 2: Build
  build:
    needs: test
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build
      run: npm run build

    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: dist
        path: dist/

  # Job 3: Deploy
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Download artifacts
      uses: actions/download-artifact@v3
      with:
        name: dist
        path: dist/

    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Your deployment commands here
```

### 2. Docker Build và Push

**.github/workflows/docker.yml:**

```yaml
name: Docker Build and Push

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha

    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max

    - name: Image digest
      run: echo ${{ steps.docker_build.outputs.digest }}
```

### 3. Deploy lên AWS

**.github/workflows/deploy-aws.yml:**

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-southeast-1

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1

    - name: Build and push to ECR
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: myapp
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

    - name: Deploy to ECS
      run: |
        aws ecs update-service \
          --cluster my-cluster \
          --service my-service \
          --force-new-deployment
```

## Advanced Concepts

### 1. Reusable Workflows

**.github/workflows/reusable-test.yml:**

```yaml
name: Reusable Test Workflow

on:
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
    secrets:
      npm-token:
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: ${{ inputs.node-version }}
    - run: npm ci
      env:
        NPM_TOKEN: ${{ secrets.npm-token }}
    - run: npm test
```

**Sử dụng:**

```yaml
jobs:
  test-node-16:
    uses: ./.github/workflows/reusable-test.yml
    with:
      node-version: '16.x'
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

### 2. Matrix Strategy

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [16, 18, 20]
        exclude:
          - os: macos-latest
            node: 16

    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node }}
    - run: npm test
```

### 3. Conditional Execution

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
    - name: Deploy only on main
      run: ./deploy.sh

  notify:
    if: failure()
    steps:
    - name: Send notification on failure
      run: curl -X POST ${{ secrets.SLACK_WEBHOOK }}
```

### 4. Caching Dependencies

```yaml
steps:
- uses: actions/checkout@v3

- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Install dependencies
  run: npm ci
```

### 5. Secrets Management

```yaml
steps:
- name: Use secrets
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
  run: |
    echo "Connecting to database..."
    # Commands using secrets
```

**Thêm secrets:**
- Repository → Settings → Secrets and variables → Actions
- New repository secret

## Scheduled Workflows

```yaml
name: Nightly Build

on:
  schedule:
    # Chạy lúc 2 giờ sáng UTC mỗi ngày
    - cron: '0 2 * * *'
  workflow_dispatch: # Cho phép trigger thủ công

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - run: npm run build
```

## Monitoring và Debugging

### 1. Enable Debug Logging

Thêm secrets:
- `ACTIONS_STEP_DEBUG`: true
- `ACTIONS_RUNNER_DEBUG`: true

### 2. Job Summaries

```yaml
steps:
- name: Generate summary
  run: |
    echo "### Test Results :rocket:" >> $GITHUB_STEP_SUMMARY
    echo "- Tests passed: 150" >> $GITHUB_STEP_SUMMARY
    echo "- Coverage: 85%" >> $GITHUB_STEP_SUMMARY
```

### 3. Notifications

**Slack notification:**

```yaml
- name: Slack notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Best Practices

### 1. Optimize Workflow Speed
```yaml
# ✅ Cache dependencies
- uses: actions/cache@v3

# ✅ Run jobs in parallel
jobs:
  test:
  lint:
  build:
# Chạy đồng thời nếu không depend on nhau

# ✅ Use artifacts cho large files
- uses: actions/upload-artifact@v3
```

### 2. Security
```yaml
# ✅ Limit permissions
permissions:
  contents: read
  packages: write

# ✅ Pin action versions
- uses: actions/checkout@v3.5.0  # Specific version
- uses: actions/checkout@v3      # Major version (auto-update)

# ✅ Use secrets, không hardcode
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### 3. Error Handling
```yaml
steps:
- name: Run tests
  id: test
  continue-on-error: true
  run: npm test

- name: Handle failure
  if: steps.test.outcome == 'failure'
  run: echo "Tests failed but continuing..."
```

## Kết luận

GitHub Actions là công cụ mạnh mẽ cho CI/CD với:
- Setup đơn giản
- Tích hợp tốt với GitHub
- Flexible và extensible
- Free tier hấp dẫn

**Tips:**
- Bắt đầu đơn giản, scale dần
- Sử dụng reusable workflows
- Monitor và optimize workflow time
- Bảo mật secrets đúng cách

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Awesome Actions](https://github.com/sdras/awesome-actions)
- [GitHub Marketplace](https://github.com/marketplace?type=actions)
