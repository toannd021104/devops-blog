---
title: "Part 3: Docker Best Practices - Phân tích Dockerfile và Docker Compose"
date: 2025-11-16T06:30:00+07:00
draft: false
tags: ["docker", "containers", "devops", "dockerfile", "docker-compose"]
categories: ["DevOps", "Docker"]
series: ["DevOps Skills Showcase"]
weight: 3
description: "Part 3 - Phân tích 2 Dockerfile và 1 Docker Compose từ project microservices thực tế - optimization techniques và best practices"
ShowToc: true
TocOpen: true
---

> **Part 3 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → Docker → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

---

# Giới thiệu

Bài viết này phân tích Docker implementation từ project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform) - một ứng dụng microservices với 11 services.

Chúng ta sẽ xem xét:
- 2 Dockerfile examples với các kỹ thuật tối ưu khác nhau
- 1 Docker Compose file orchestrate nhiều services

---

## Part 1: Dockerfile Example 1 - Go Service với Scratch Image

### 1.1. Source Code

Đây là Dockerfile của Frontend Service (Go):

**File**: `src/frontend/Dockerfile`

```dockerfile
# Stage 1: Build environment
FROM --platform=$BUILDPLATFORM golang:1.23.4-alpine@sha256:c23339... AS builder
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
ARG SKAFFOLD_GO_GCFLAGS
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} CGO_ENABLED=0 \
    go build -gcflags="${SKAFFOLD_GO_GCFLAGS}" -o /go/bin/frontend .

# Stage 2: Minimal runtime
FROM scratch
WORKDIR /src
COPY --from=builder /go/bin/frontend /src/server
COPY ./templates ./templates
COPY ./static ./static

ENV GOTRACEBACK=single
EXPOSE 8080
ENTRYPOINT ["/src/server"]
```

### 1.2. Phân tích các Kỹ thuật Tối ưu

**1. Multi-Stage Build**

```dockerfile
FROM golang:1.23.4-alpine AS builder  # Stage 1: Build
# ... build code ...

FROM scratch                           # Stage 2: Runtime
# ... copy binary only
```

**Tại sao?**
- Stage 1 (builder): Có đầy đủ Go compiler và tools (~300MB)
- Stage 2 (runtime): Chỉ chứa binary đã compile (~10MB)
- Kết quả: Giảm 97% dung lượng image

**2. SHA256 Pinning**

```dockerfile
FROM golang:1.23.4-alpine@sha256:c23339...
```

**Tại sao?**
- Đảm bảo sử dụng chính xác image version đó
- Tránh bị thay đổi khi tag bị overwrite
- Reproducible builds (build lại sẽ giống 100%)

**3. Cross-Platform Build**

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.23.4-alpine
ARG TARGETOS
ARG TARGETARCH
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build
```

**Tại sao?**
- Build trên máy Mac M1/M2 (ARM)
- Nhưng image chạy được trên server Linux (AMD64)
- Docker tự động handle cross-compilation

**4. Static Binary với CGO_ENABLED=0**

```dockerfile
CGO_ENABLED=0 go build
```

**Tại sao?**
- Tạo binary hoàn toàn độc lập, không cần C libraries
- Có thể chạy trên `scratch` image (image trống, không có gì)
- Security tốt hơn: không có OS utilities, không có shell

**5. Scratch Base Image**

```dockerfile
FROM scratch
```

**Tại sao?**
- Scratch = image trống hoàn toàn
- Chỉ chứa binary và static files cần thiết
- Không có shell, không có package manager
- Attack surface nhỏ nhất có thể

**6. Layer Caching Optimization**

```dockerfile
COPY go.mod go.sum ./    # Copy dependency files trước
RUN go mod download      # Download dependencies

COPY . .                 # Copy source code sau
RUN go build
```

**Tại sao?**
- Dependencies ít thay đổi → layer này được cache
- Source code thay đổi thường xuyên → chỉ rebuild từ bước COPY . .
- Build nhanh hơn nhiều lần

### 1.3. Kết quả

- Image size: ~10MB (từ 300MB)
- Giảm: 97%
- Build time: ~2 phút (với cache: ~10 giây)
- Security: Minimal attack surface

---

## Part 2: Dockerfile Example 2 - Node.js Service với Alpine

### 2.1. Source Code

Đây là Dockerfile của Currency Service (Node.js):

**File**: `src/currencyservice/Dockerfile`

```dockerfile
# Stage 1: Build dependencies
FROM --platform=$BUILDPLATFORM node:20.18.1-alpine@sha256:24fb6... AS builder

# Install native build tools
RUN apk add --update --no-cache \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Stage 2: Runtime environment
FROM alpine:3.20.3@sha256:1e42bbe...

# Install only Node.js runtime
RUN apk add --no-cache nodejs wget

WORKDIR /usr/src/app

# Copy installed dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY . .

EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD wget -q --spider http://localhost:7000 || exit 1

ENTRYPOINT [ "node", "server.js" ]
```

### 2.2. Phân tích các Kỹ thuật Tối ưu

**1. Multi-Stage với Native Dependencies**

```dockerfile
# Stage 1: Builder có python3, make, g++
FROM node:20.18.1-alpine AS builder
RUN apk add python3 make g++
RUN npm install

# Stage 2: Runtime chỉ có node
FROM alpine:3.20.3
RUN apk add nodejs
COPY --from=builder /app/node_modules ./node_modules
```

**Tại sao?**
- Một số npm packages (bcrypt, node-gyp) cần compile từ C/C++
- Cần python3, make, g++ để build
- Nhưng runtime không cần build tools này
- Copy node_modules đã compiled từ builder

**2. Alpine Base Image**

```dockerfile
FROM alpine:3.20.3
```

**Tại sao?**
- Alpine Linux rất nhỏ: ~5MB
- Debian base: ~80MB
- Giảm 94% dung lượng base image

**3. APK Package Manager với --no-cache**

```dockerfile
RUN apk add --update --no-cache nodejs wget
```

**Tại sao?**
- `--no-cache`: Không lưu package cache
- Giảm ~5-10MB per layer
- Clean install, image nhỏ hơn

**4. Layer Optimization**

```dockerfile
# Bad: Mỗi RUN tạo 1 layer
RUN apk update
RUN apk add nodejs
RUN apk add wget

# Good: Combine thành 1 layer
RUN apk add --no-cache nodejs wget
```

**Tại sao?**
- Mỗi RUN command = 1 layer trong image
- Ít layers hơn = image nhỏ hơn
- Sử dụng `&&` để chain commands

**5. Built-in Health Check**

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD wget -q --spider http://localhost:7000 || exit 1
```

**Các tham số**:
- `interval`: Check mỗi 30 giây
- `timeout`: Timeout sau 10 giây
- `retries`: Thử 3 lần trước khi đánh dấu unhealthy
- `start-period`: Đợi 20 giây cho service khởi động

**Tại sao?**
- Docker tự động monitor service health
- Orchestrator (Kubernetes, Swarm) có thể restart unhealthy containers
- Production monitoring

**6. Package.json Caching**

```dockerfile
COPY package*.json ./     # Copy package.json trước
RUN npm install           # Install dependencies

COPY . .                  # Copy source code sau
```

**Tại sao?**
- package.json ít thay đổi
- npm install mất nhiều thời gian
- Source code thay đổi không trigger npm install lại

### 2.3. Kết quả

- Image size: ~50MB (từ 350MB)
- Giảm: 86%
- Build time: ~2 phút (với cache: ~15 giây)
- Health check: Tự động monitoring

---

## Part 3: Docker Compose - Orchestrate Nhiều Services

### 3.1. Docker Compose File

Đây là file docker-compose.yml orchestrate 11 microservices:

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Frontend Service (Go)
  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: frontend
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - PRODUCT_CATALOG_SERVICE_ADDR=productcatalogservice:3550
      - CURRENCY_SERVICE_ADDR=currencyservice:7000
      - CART_SERVICE_ADDR=cartservice:7070
      - CHECKOUT_SERVICE_ADDR=checkoutservice:5050
    depends_on:
      - productcatalogservice
      - currencyservice
      - cartservice

  # Product Catalog Service (Go)
  productcatalogservice:
    build:
      context: ./src/productcatalogservice
      dockerfile: Dockerfile
    container_name: productcatalogservice
    ports:
      - "3550:3550"
    environment:
      - PORT=3550

  # Currency Service (Node.js)
  currencyservice:
    build:
      context: ./src/currencyservice
      dockerfile: Dockerfile
    container_name: currencyservice
    ports:
      - "7000:7000"
    environment:
      - PORT=7000
      - DISABLE_PROFILER=1
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "7000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  # Cart Service (C#)
  cartservice:
    build:
      context: ./src/cartservice/src
      dockerfile: Dockerfile
    container_name: cartservice
    ports:
      - "7070:7070"
    environment:
      - ASPNETCORE_HTTP_PORTS=7070
      - REDIS_ADDR=redis-cart:6379
    depends_on:
      - redis-cart

  # Redis Cache
  redis-cart:
    image: redis:alpine
    container_name: redis-cart
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Checkout Service (Go)
  checkoutservice:
    build:
      context: ./src/checkoutservice
      dockerfile: Dockerfile
    container_name: checkoutservice
    ports:
      - "5050:5050"
    environment:
      - PORT=5050
      - PRODUCT_CATALOG_SERVICE_ADDR=productcatalogservice:3550
      - CART_SERVICE_ADDR=cartservice:7070
      - CURRENCY_SERVICE_ADDR=currencyservice:7000
    depends_on:
      - productcatalogservice
      - cartservice
      - currencyservice

  # ... 6 services khác (payment, email, shipping, etc.)

# Custom network
networks:
  default:
    name: boutique-network
```

### 3.2. Phân tích Docker Compose

**1. Service Definition**

```yaml
frontend:
  build:
    context: ./src/frontend
    dockerfile: Dockerfile
  container_name: frontend
```

**Giải thích**:
- `build.context`: Thư mục chứa source code
- `build.dockerfile`: Tên Dockerfile (mặc định là "Dockerfile")
- `container_name`: Tên container (dễ nhận diện)

**2. Port Mapping**

```yaml
ports:
  - "8080:8080"  # host:container
  - "3550:3550"
```

**Giải thích**:
- Format: `"host_port:container_port"`
- `8080:8080`: Port 8080 trên host map vào port 8080 trong container
- Truy cập: `http://localhost:8080` → frontend container

**3. Environment Variables**

```yaml
environment:
  - PORT=8080
  - CART_SERVICE_ADDR=cartservice:7070
  - REDIS_ADDR=redis-cart:6379
```

**Giải thích**:
- Pass config vào container qua env vars
- `cartservice:7070`: Sử dụng service name làm hostname (Docker DNS)
- Code trong container có thể access qua `process.env.CART_SERVICE_ADDR`

**4. Service Discovery via Docker DNS**

```yaml
frontend:
  environment:
    - CART_SERVICE_ADDR=cartservice:7070

cartservice:
  container_name: cartservice
```

**Giải thích**:
- Docker tự động tạo DNS records cho mỗi service
- `cartservice` là hostname, resolve thành IP của cart container
- Services trong cùng network có thể gọi nhau bằng tên

**Ví dụ trong code**:
```javascript
// Frontend code
const cartClient = new CartServiceClient(
  process.env.CART_SERVICE_ADDR  // = "cartservice:7070"
);
```

**5. Service Dependencies**

```yaml
frontend:
  depends_on:
    - productcatalogservice
    - currencyservice
    - cartservice
```

**Giải thích**:
- Docker Compose start các dependencies trước
- Start order: productcatalogservice → currencyservice → cartservice → frontend
- **Lưu ý**: `depends_on` chỉ đảm bảo start order, KHÔNG đợi service ready

**6. Health Checks**

```yaml
currencyservice:
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "7000"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
```

**Giải thích**:
- `test`: Command để check health (nc = netcat, check port mở)
- `interval`: Check mỗi 30 giây
- `timeout`: Timeout 10 giây
- `retries`: Thử 3 lần trước khi mark unhealthy
- `start_period`: Grace period 20s cho service warm-up

**Dependency với health check**:
```yaml
depends_on:
  currencyservice:
    condition: service_healthy  # Đợi healthy mới start
```

**7. Using Pre-built Images**

```yaml
redis-cart:
  image: redis:alpine  # Dùng image có sẵn từ Docker Hub
```

**Giải thích**:
- Không cần build, pull từ registry
- `redis:alpine` = Redis với Alpine base (nhỏ hơn)

**8. Custom Network**

```yaml
networks:
  default:
    name: boutique-network
```

**Giải thích**:
- Tất cả services trong cùng network `boutique-network`
- Services có thể communicate với nhau
- Isolated từ containers khác

### 3.3. Commands Thực Hành

**Start tất cả services**:
```bash
docker-compose up -d
```

**Xem status**:
```bash
docker-compose ps
```

**Xem logs**:
```bash
docker-compose logs -f frontend
```

**Stop services**:
```bash
docker-compose down
```

**Rebuild services**:
```bash
docker-compose build
docker-compose up -d --build
```

**Scale services**:
```bash
docker-compose up -d --scale currencyservice=3
```

---

## Part 4: Tổng kết

### So sánh 2 Dockerfile

| Aspect | Go (Scratch) | Node.js (Alpine) |
|--------|--------------|------------------|
| Base Image | scratch | alpine:3.20 |
| Image Size | 10MB | 50MB |
| Security | Cao nhất | Cao |
| Debug | Khó (no shell) | Dễ (có shell) |
| Use Case | Static binary | Runtime + deps |

### Key Takeaways

**Dockerfile Best Practices**:
- Sử dụng multi-stage builds
- SHA256 pinning cho reproducible builds
- Optimize layer caching (COPY dependencies trước source)
- Clean up trong cùng RUN command
- Built-in health checks

**Docker Compose Best Practices**:
- Service discovery via DNS
- Health checks với proper parameters
- Dependencies với conditions
- Environment variables cho configuration
- Custom networks cho isolation

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: docker, dockerfile, docker-compose, microservices, optimization

**Published**: November 16, 2025
**Level**: Intermediate
