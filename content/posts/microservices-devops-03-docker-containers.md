---
title: "Deploy Microservices #3: Dockerize Applications và Push lên ECR"
date: 2024-11-14T11:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Containerize microservices với Docker best practices. Multi-stage builds, optimization, health checks và push lên Amazon ECR."
categories: ["Microservices", "Docker", "AWS"]
tags: ["docker", "containers", "ecr", "dockerfile", "optimization"]
series: ["Deploy Microservices - Full DevOps"]
showToc: true
TocOpen: true
---

## Giới thiệu

Sau khi có infrastructure, giờ chúng ta sẽ containerize các microservices. Trong bài này:

- ✅ Viết production-ready Dockerfiles
- ✅ Multi-stage builds để giảm image size
- ✅ Health checks và optimization
- ✅ Push images lên Amazon ECR
- ✅ Security scanning với Trivy

## Multi-stage Dockerfile Examples

### 1. Go Service (Product Catalog)

```dockerfile
# Stage 1: Build
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o product-service ./cmd/product

# Stage 2: Runtime
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/product-service .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/healthz || exit 1

EXPOSE 8080

CMD ["./product-service"]
```

**Result:** Size giảm từ ~800MB → ~15MB!

### 2. Node.js Service (Frontend)

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Copy dependencies and build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node healthcheck.js || exit 1

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### 3. Python Service (Payment Service)

```dockerfile
# Stage 1: Build
FROM python:3.11-slim AS builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application
COPY . .

# Make sure scripts are executable
ENV PATH=/root/.local/bin:$PATH

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD python healthcheck.py || exit 1

EXPOSE 5000

CMD ["python", "app.py"]
```

## Docker Compose for Local Testing

```yaml
version: '3.8'

services:
  product-service:
    build:
      context: ./product-service
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/products
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  cart-service:
    build: ./cart-service
    ports:
      - "8081:8080"
    environment:
      - REDIS_URL=redis://redis:6379

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - PRODUCT_SERVICE_URL=http://product-service:8080
      - CART_SERVICE_URL=http://cart-service:8080

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=microservices
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Test local:

```bash
docker-compose up --build
```

## Push to Amazon ECR

### 1. Create ECR Repositories

```bash
# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com

# Create repositories
for service in product-service cart-service checkout-service payment-service frontend; do
  aws ecr create-repository \
    --repository-name microservices/$service \
    --region ap-southeast-1
done
```

### 2. Build and Push Script

```bash
#!/bin/bash
# build-and-push.sh

AWS_REGION="ap-southeast-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Services to build
SERVICES=("product-service" "cart-service" "frontend")

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

for SERVICE in "${SERVICES[@]}"; do
  echo "Building $SERVICE..."

  # Build image
  docker build -t microservices/$SERVICE:latest ./$SERVICE

  # Tag for ECR
  docker tag microservices/$SERVICE:latest \
    $ECR_REGISTRY/microservices/$SERVICE:latest

  # Push to ECR
  docker push $ECR_REGISTRY/microservices/$SERVICE:latest

  echo "✅ $SERVICE pushed to ECR"
done
```

```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

## Optimization Tips

### 1. Layer Caching

```dockerfile
# ❌ Bad - cache invalidated on every code change
COPY . .
RUN npm install

# ✅ Good - cache dependencies separately
COPY package*.json ./
RUN npm install
COPY . .
```

### 2. .dockerignore

```
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.DS_Store
*.md
dist
build
coverage
.vscode
```

### 3. Reduce Image Size

```dockerfile
# Use alpine variants
FROM node:18-alpine  # Instead of node:18

# Remove unnecessary files
RUN rm -rf /var/cache/apk/*

# Multi-stage builds
FROM builder AS final
COPY --from=builder /app/dist ./dist
```

## Security Scanning

### Install Trivy

```bash
# Linux
wget https://github.com/aquasecurity/trivy/releases/download/v0.48.0/trivy_0.48.0_Linux-64bit.tar.gz
tar zxvf trivy_0.48.0_Linux-64bit.tar.gz
sudo mv trivy /usr/local/bin/
```

### Scan Images

```bash
# Scan local image
trivy image microservices/product-service:latest

# Scan ECR image
trivy image \
  $ECR_REGISTRY/microservices/product-service:latest

# Exit on high/critical vulnerabilities
trivy image --exit-code 1 --severity HIGH,CRITICAL \
  microservices/product-service:latest
```

## Next: Deploy to Kubernetes

Trong bài tiếp theo, chúng ta sẽ deploy các images này lên EKS cluster!

---

**Files trong bài:**
- Dockerfiles cho mỗi service
- docker-compose.yml cho local testing
- build-and-push.sh script
- .dockerignore
