---
title: "Docker Best Practices: Tối Ưu Dockerfile và Container"
date: 2024-01-20T10:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Tổng hợp các best practices khi làm việc với Docker, từ việc viết Dockerfile tối ưu đến security và performance."
categories: ["Docker"]
tags: ["docker", "dockerfile", "best-practices", "optimization", "security"]
showToc: true
TocOpen: true
---

## Giới thiệu

Docker đã trở thành standard trong việc containerize applications. Tuy nhiên, việc sử dụng Docker hiệu quả đòi hỏi phải hiểu và áp dụng đúng các best practices.

## 1. Dockerfile Best Practices

### 1.1. Sử dụng Base Image phù hợp

❌ **Bad:**
```dockerfile
FROM ubuntu:latest
RUN apt-get update && apt-get install -y python3
```

✅ **Good:**
```dockerfile
# Dùng official image, specific version, alpine variant
FROM python:3.11-alpine

# Hoặc nếu cần full OS
FROM python:3.11-slim
```

**Lý do:**
- `alpine`: Nhỏ gọn (~5MB vs ~100MB)
- `slim`: Đầy đủ hơn alpine nhưng vẫn nhỏ
- Specific version: Tránh breaking changes

### 1.2. Multi-stage Builds

❌ **Bad - Single stage:**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

✅ **Good - Multi-stage:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

**Kết quả:** Image size giảm từ 1.2GB → 150MB

### 1.3. Optimize Layer Caching

❌ **Bad:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install  # Cache bị invalidate mỗi lần code thay đổi
CMD ["npm", "start"]
```

✅ **Good:**
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy dependency files first
COPY package*.json ./
RUN npm ci --only=production

# Copy source code sau
COPY . .

CMD ["npm", "start"]
```

### 1.4. Minimize Layers

❌ **Bad:**
```dockerfile
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git
RUN apt-get clean
```

✅ **Good:**
```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```

### 1.5. Use .dockerignore

**.dockerignore:**
```bash
# Git
.git
.gitignore

# Node
node_modules
npm-debug.log

# Build
dist
build
*.log

# IDE
.vscode
.idea

# OS
.DS_Store
Thumbs.db

# Env files
.env
.env.local

# Documentation
README.md
docs/
```

## 2. Security Best Practices

### 2.1. Don't Run as Root

❌ **Bad:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
CMD ["node", "index.js"]  # Chạy với root user
```

✅ **Good:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY --chown=node:node . .
USER node
CMD ["node", "index.js"]
```

### 2.2. Scan for Vulnerabilities

```bash
# Sử dụng Docker Scout
docker scout cves nginx:latest

# Hoặc Trivy
docker run aquasec/trivy image nginx:latest

# Hoặc Snyk
snyk container test nginx:latest
```

### 2.3. Không hardcode secrets

❌ **Bad:**
```dockerfile
ENV DATABASE_PASSWORD=supersecret123
ENV API_KEY=abc123xyz
```

✅ **Good:**
```dockerfile
# Sử dụng build args cho build-time
ARG BUILD_VERSION
ENV VERSION=${BUILD_VERSION}

# Runtime secrets
# docker run -e DATABASE_PASSWORD=$DB_PASS myapp
```

Hoặc dùng Docker Secrets (Swarm) hoặc Kubernetes Secrets.

### 2.4. Use Specific Image Tags

❌ **Bad:**
```dockerfile
FROM node:latest  # Không predictable
FROM nginx        # Dùng default tag
```

✅ **Good:**
```dockerfile
FROM node:18.17.0-alpine3.18
FROM nginx:1.25.2-alpine
```

## 3. Performance Optimization

### 3.1. Minimize Image Size

**Ví dụ thực tế - Go Application:**

❌ **Bad (1.2GB):**
```dockerfile
FROM golang:1.21
WORKDIR /app
COPY . .
RUN go build -o app
CMD ["./app"]
```

✅ **Good (15MB):**
```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

# Final stage
FROM scratch
COPY --from=builder /app/app /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
ENTRYPOINT ["/app"]
```

### 3.2. Health Checks

```dockerfile
FROM nginx:alpine

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

COPY nginx.conf /etc/nginx/nginx.conf
```

### 3.3. Resource Limits

```bash
# Giới hạn CPU và Memory
docker run -d \
  --name myapp \
  --memory="512m" \
  --memory-swap="512m" \
  --cpus="1.5" \
  myapp:latest
```

## 4. Development Workflow

### 4.1. Docker Compose cho Local Development

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 4.2. Development vs Production Dockerfile

**Dockerfile.dev:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install  # Cài cả devDependencies
COPY . .
CMD ["npm", "run", "dev"]
```

**Dockerfile.prod:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

## 5. Logging và Monitoring

### 5.1. Logging Best Practices

```dockerfile
FROM node:18-alpine

# Log to stdout/stderr (Docker sẽ collect)
CMD ["node", "index.js"]

# Không ghi log vào file trong container
# ❌ CMD ["node", "index.js", ">", "app.log"]
```

**Application code:**
```javascript
// Good - Log to stdout
console.log('Info message');
console.error('Error message');

// Sử dụng structured logging
const logger = require('winston');
logger.info({ message: 'User login', userId: 123 });
```

### 5.2. View Logs

```bash
# Real-time logs
docker logs -f container_name

# Last 100 lines
docker logs --tail 100 container_name

# With timestamps
docker logs -t container_name

# Specific time range
docker logs --since 1h container_name
```

## 6. CI/CD Integration

### GitHub Actions Example

**.github/workflows/docker.yml:**
```yaml
name: Docker Build and Push

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Login to DockerHub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}

    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          myuser/myapp:latest
          myuser/myapp:${{ github.sha }}
        cache-from: type=registry,ref=myuser/myapp:latest
        cache-to: type=inline
```

## 7. Quick Checklist

✅ **Build:**
- [ ] Sử dụng official base images
- [ ] Specific version tags
- [ ] Multi-stage builds
- [ ] Optimize layer caching
- [ ] Minimize image size
- [ ] Add .dockerignore

✅ **Security:**
- [ ] Run as non-root user
- [ ] Scan vulnerabilities
- [ ] No secrets in Dockerfile
- [ ] Regular security updates

✅ **Operations:**
- [ ] Add health checks
- [ ] Implement logging
- [ ] Set resource limits
- [ ] Use labels for metadata

## Kết luận

Áp dụng đúng Docker best practices giúp:
- 🚀 Image nhỏ hơn, build nhanh hơn
- 🔒 Bảo mật tốt hơn
- 📊 Dễ maintain và debug
- 💰 Tiết kiệm chi phí infrastructure

## Resources

- [Docker Official Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
