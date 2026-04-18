---
title: "Part 4: Kubernetes Best Practices - Deploy Microservices lên K8s"
date: 2025-11-16T07:00:00+07:00
draft: false
tags: ["kubernetes", "k8s", "devops", "microservices", "orchestration"]
categories: ["DevOps", "Kubernetes"]
series: ["DevOps Skills Showcase"]
weight: 4
description: "Part 4 - Phân tích Kubernetes manifests: Deployment, Service, ConfigMap - Deploy microservices production-ready"
ShowToc: true
TocOpen: true
---

> **Part 4 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → Kubernetes → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

---

# Giới thiệu

Bài viết này hướng dẫn deploy microservices từ project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform) lên Kubernetes.

Chúng ta sẽ xem xét:
- Deployment manifest - Deploy và scale services
- Service manifest - Networking và service discovery
- ConfigMap - Configuration management
- Best practices cho production

---

## Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                            │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Deployment: frontend (replicas: 3)             │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐              │ │
│  │  │  Pod 1    │  │  Pod 2    │  │  Pod 3    │              │ │
│  │  │ :8080     │  │ :8080     │  │ :8080     │              │ │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘              │ │
│  └────────┼──────────────┼──────────────┼─────────────────────┘ │
│           └──────────────┴──────────────┘                        │
│                          │                                        │
│                   ┌──────┴──────┐                                │
│                   │   Service   │                                │
│                   │ LoadBalancer│                                │
│                   │    :80      │                                │
│                   └──────┬──────┘                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Backend Services (ClusterIP)                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ Product      │  │ Currency     │  │ Cart         │    │ │
│  │  │ Catalog:3550 │  │ Service:7000 │  │ Service:7070 │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ConfigMaps ──→ Pods    Secrets ──→ Pods                         │
└────────────────────────┬───────────────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │  Load Balancer  │ (AWS ALB/GCP LB)
                │ 34.123.45.67    │
                └────────┬────────┘
                         │
                    ┌────┴────┐
                    │  Users  │
                    └─────────┘
```

---

## Part 1: Deployment Manifest - Frontend Service

### 1.1. Deployment YAML

Deploy Frontend Service (Go) lên Kubernetes:

**File**: `k8s/frontend-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: boutique
  labels:
    app: frontend
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        version: v1
    spec:
      containers:
      - name: frontend
        image: gcr.io/my-project/frontend:v1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        env:
        - name: PORT
          value: "8080"
        - name: PRODUCT_CATALOG_SERVICE_ADDR
          value: "productcatalogservice:3550"
        - name: CURRENCY_SERVICE_ADDR
          value: "currencyservice:7000"
        - name: CART_SERVICE_ADDR
          value: "cartservice:7070"
        - name: CHECKOUT_SERVICE_ADDR
          value: "checkoutservice:5050"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### 1.2. Phân tích Deployment

**1. Metadata Section**

```yaml
metadata:
  name: frontend
  namespace: boutique
  labels:
    app: frontend
    version: v1
```

**Giải thích**:
- `name`: Tên Deployment
- `namespace`: Namespace để organize resources
- `labels`: Tags để query và select resources

**Tại sao dùng namespace?**
- Tách biệt môi trường (dev, staging, prod)
- Access control per namespace
- Resource quota management

**2. Replicas**

```yaml
spec:
  replicas: 3
```

**Giải thích**:
- Chạy 3 pods cho high availability
- K8s tự động maintain 3 pods running
- Nếu 1 pod die → K8s tự động recreate

**Tại sao 3 replicas?**
- High availability: Service vẫn chạy khi 1-2 pods fail
- Load balancing: Traffic chia đều cho 3 pods
- Rolling updates: Update từng pod, không downtime

**3. Selector**

```yaml
selector:
  matchLabels:
    app: frontend
```

**Giải thích**:
- Deployment manage các pods có label `app: frontend`
- Dùng để link Deployment với Pods

**4. Pod Template**

```yaml
template:
  metadata:
    labels:
      app: frontend
      version: v1
  spec:
    containers:
    - name: frontend
      image: gcr.io/my-project/frontend:v1.0.0
```

**Giải thích**:
- Template để tạo pods
- Mỗi pod chạy 1 container `frontend`
- Image từ container registry (GCR, ECR, Docker Hub)

**Best practice**:
- Dùng specific version tag (v1.0.0), không dùng `latest`
- SHA256 digest cho reproducible deployments

**5. Container Configuration**

```yaml
containers:
- name: frontend
  image: gcr.io/my-project/frontend:v1.0.0
  ports:
  - containerPort: 8080
    name: http
```

**Giải thích**:
- Container expose port 8080
- `name: http` để reference trong Service

**6. Environment Variables**

```yaml
env:
- name: PRODUCT_CATALOG_SERVICE_ADDR
  value: "productcatalogservice:3550"
- name: CURRENCY_SERVICE_ADDR
  value: "currencyservice:7000"
```

**Giải thích**:
- Pass config qua env vars
- Service names resolve qua K8s DNS
- `productcatalogservice` → ClusterIP của Product Catalog Service

**Tại sao không hardcode IPs?**
- IPs thay đổi khi pods restart
- K8s DNS tự động resolve service names
- Flexible, không cần update config

**7. Resource Limits**

```yaml
resources:
  requests:
    cpu: 100m      # Minimum: 0.1 CPU core
    memory: 128Mi  # Minimum: 128 MB RAM
  limits:
    cpu: 200m      # Maximum: 0.2 CPU core
    memory: 256Mi  # Maximum: 256 MB RAM
```

**Giải thích**:
- `requests`: Resources cần để schedule pod
- `limits`: Maximum resources pod có thể dùng

**Tại sao cần limits?**
- Prevent resource starvation: 1 pod không ăn hết resources
- Better scheduling: K8s biết cần bao nhiêu resources
- Cost optimization: Không waste resources

**8. Liveness Probe**

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
```

**Giải thích**:
- Check xem container còn alive không
- Nếu fail 3 lần liên tiếp → K8s restart container

**Parameters**:
- `initialDelaySeconds: 10`: Đợi 10s trước khi check (warm-up time)
- `periodSeconds: 10`: Check mỗi 10 giây
- `failureThreshold: 3`: 3 lần fail → restart

**Tại sao cần liveness probe?**
- Detect deadlock: App running nhưng not responding
- Auto-recovery: K8s tự động restart unhealthy containers
- No manual intervention

**9. Readiness Probe**

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

**Giải thích**:
- Check xem pod ready nhận traffic chưa
- Nếu not ready → K8s không route traffic tới pod này

**Khác với Liveness Probe**:
- Liveness: Check alive → restart nếu dead
- Readiness: Check ready → không route traffic nếu not ready

**Use case**:
- Startup time: App cần 30s để load data → not ready
- Dependencies: DB down → app not ready, nhưng không cần restart

### 1.3. Deployment Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Deployment                              │
│                   (frontend, replicas: 3)                   │
└────────────────────────┬───────────────────────────────────┘
                         │ manages
                         ▼
┌────────────────────────────────────────────────────────────┐
│                    ReplicaSet                               │
│              (frontend-xyz, desired: 3)                     │
└──────┬─────────────────┬─────────────────┬─────────────────┘
       │ creates         │ creates         │ creates
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Pod 1       │  │  Pod 2       │  │  Pod 3       │
│ frontend-abc │  │ frontend-def │  │ frontend-ghi │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │ ┌───────────────┴─────────────────┘
       │ │
       ▼ ▼
┌──────────────────────────────────────────┐
│         Health Monitoring                 │
│                                           │
│  Liveness Probe: GET /healthz every 10s  │
│    ├─ Success → Continue                 │
│    └─ Fail 3x → Restart Container        │
│                                           │
│  Readiness Probe: GET /ready every 5s    │
│    ├─ Success → Route traffic            │
│    └─ Fail → Remove from Service         │
└──────────────────────────────────────────┘
```

---

## Part 2: Service Manifest - Networking

### 2.1. Service YAML

Expose Frontend Deployment:

**File**: `k8s/frontend-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: boutique
  labels:
    app: frontend
spec:
  type: LoadBalancer
  selector:
    app: frontend
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

### 2.2. Phân tích Service

**1. Service Types**

```yaml
spec:
  type: LoadBalancer
```

**3 loại Service**:

**ClusterIP** (Default):
```yaml
type: ClusterIP
```
- Internal IP, chỉ access được trong cluster
- Dùng cho internal services (database, backend APIs)

**NodePort**:
```yaml
type: NodePort
```
- Expose trên port của mọi nodes
- Access qua `<NodeIP>:<NodePort>`
- Dùng cho testing, dev environment

**LoadBalancer**:
```yaml
type: LoadBalancer
```
- Tạo external load balancer (AWS ELB, GCP LB)
- Public IP, access từ internet
- Dùng cho frontend, public APIs

**2. Selector**

```yaml
selector:
  app: frontend
```

**Giải thích**:
- Service route traffic đến pods có label `app: frontend`
- Load balance across tất cả matching pods

**3. Port Mapping**

```yaml
ports:
- name: http
  port: 80           # Service port (external)
  targetPort: 8080   # Container port (internal)
```

**Giải thích**:
- User access Service qua port 80
- Service forward đến container port 8080
- Load balanced across 3 frontend pods

**Flow**:
```
User → LoadBalancer:80 → Service:80 → Pod:8080
```

**4. Session Affinity**

```yaml
sessionAffinity: ClientIP
sessionAffinityConfig:
  clientIP:
    timeoutSeconds: 10800  # 3 hours
```

**Giải thích**:
- Requests từ cùng client IP → route đến cùng pod
- Maintain session state
- Timeout: 3 giờ

**Tại sao cần?**
- Stateful apps: Session data stored in pod memory
- Better caching: Cùng user → cùng pod → cache hit
- Consistent experience

### 2.3. Traffic Flow

```
User (Browser)
    │
    │ HTTP GET /
    ▼
┌────────────────────┐
│ Cloud Load Balancer│  (AWS ELB/GCP LB)
│  34.123.45.67:80   │
└─────────┬──────────┘
          │
          │ Forward
          ▼
┌────────────────────┐
│   Service:frontend │  (LoadBalancer type)
│      :80           │
└─────────┬──────────┘
          │
          │ Load Balance (Round-robin)
          │
    ┌─────┼─────┐
    │     │     │
    ▼     ▼     ▼
┌────┐ ┌────┐ ┌────┐
│Pod1│ │Pod2│ │Pod3│
│8080│ │8080│ │8080│
└────┘ └────┘ └────┘

Session Affinity (ClientIP):
User 1 → Always → Pod 1
User 2 → Always → Pod 2
(Same client IP = Same pod for 3 hours)
```

---

## Part 3: Internal Service - Backend APIs

### 3.1. ClusterIP Service

**File**: `k8s/productcatalog-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: productcatalogservice
  namespace: boutique
  labels:
    app: productcatalogservice
spec:
  type: ClusterIP
  selector:
    app: productcatalogservice
  ports:
  - name: grpc
    port: 3550
    targetPort: 3550
    protocol: TCP
```

### 3.2. Phân tích Internal Service

**ClusterIP Service**:
- Không expose ra external
- Chỉ access được trong cluster
- Frontend gọi qua K8s DNS: `productcatalogservice:3550`

**Service Discovery**:
```yaml
# Frontend pod
env:
- name: PRODUCT_CATALOG_SERVICE_ADDR
  value: "productcatalogservice:3550"
```

**DNS Resolution**:
- `productcatalogservice` → ClusterIP (ví dụ: 10.0.0.5)
- K8s DNS tự động update khi pods change

### 3.3. Service Discovery via DNS

```
Frontend Pod (10.0.1.5)
    │
    │ Need to call productcatalogservice:3550
    ▼
┌──────────────────┐
│    CoreDNS       │  (Kubernetes DNS Server)
│  (DNS Resolver)  │
└────────┬─────────┘
         │
         │ Resolve: productcatalogservice.boutique.svc.cluster.local
         │ Return: ClusterIP 10.0.0.5
         ▼
┌──────────────────────┐
│ Service: productcatalog│  (ClusterIP: 10.0.0.5)
│        :3550          │
└──────────┬───────────┘
           │
           │ Load Balance
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│Product  │ │Product  │
│Pod1:3550│ │Pod2:3550│
└─────────┘ └─────────┘
```

**DNS Format**:
```
<service-name>.<namespace>.svc.cluster.local
productcatalogservice.boutique.svc.cluster.local → 10.0.0.5
```

**Short forms**:
- Cùng namespace: `productcatalogservice` hoặc `productcatalogservice.boutique`
- Khác namespace: `productcatalogservice.boutique.svc.cluster.local`

---

## Part 4: ConfigMap - Configuration Management

### 4.1. ConfigMap YAML

**File**: `k8s/app-config.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: boutique
data:
  # Simple key-value
  LOG_LEVEL: "info"
  ENABLE_PROFILER: "false"

  # Multi-line config
  app.properties: |
    # Application configuration
    server.port=8080
    server.timeout=30s

    # Database settings
    db.pool.size=20
    db.timeout=5s
```

### 4.2. Sử dụng ConfigMap

**Option 1: Environment Variables**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
      - name: frontend
        envFrom:
        - configMapRef:
            name: app-config
```

**Option 2: Specific Keys**

```yaml
env:
- name: LOG_LEVEL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: LOG_LEVEL
```

**Option 3: Volume Mount**

```yaml
volumes:
- name: config
  configMap:
    name: app-config

containers:
- name: frontend
  volumeMounts:
  - name: config
    mountPath: /etc/config
    readOnly: true
```

### 4.3. Tại sao dùng ConfigMap?

**Separation of Concerns**:
- Config tách khỏi container image
- Same image, different configs (dev, staging, prod)

**Easy Updates**:
- Update config không cần rebuild image
- Rolling update: Change config → restart pods

**Security**:
- Sensitive data dùng Secrets (không dùng ConfigMap)

### 4.4. ConfigMap Injection

```
┌──────────────────────────────────┐
│  Configuration Sources           │
│                                  │
│  ┌────────────┐  ┌────────────┐ │
│  │ ConfigMap  │  │  Secret    │ │
│  │ app-config │  │ db-secret  │ │
│  └──────┬─────┘  └──────┬─────┘ │
└─────────┼────────────────┼───────┘
          │                │
          │                │
    ┌─────┴────────────────┴─────┐
    │                            │
    ▼                            ▼
┌───────────────────────────────────┐
│         Pod: frontend             │
│                                   │
│  ┌─────────────────────────────┐ │
│  │ Environment Variables       │ │
│  │  LOG_LEVEL=info             │ │──┐
│  │  PORT=8080                  │ │  │
│  │  DB_PASSWORD=***            │ │  │
│  └─────────────────────────────┘ │  │
│                                   │  │
│  ┌─────────────────────────────┐ │  │
│  │ Volume Mount                │ │  │
│  │ /etc/config/app.properties  │ │  │
│  └─────────────────────────────┘ │  │
│                                   │  │
│            │                      │  │
│            └──────────────────────┼──┘
│                    ▼              │
│            ┌──────────────┐       │
│            │ Application  │       │
│            │   Process    │       │
│            └──────────────┘       │
└───────────────────────────────────┘
```

**3 cách inject ConfigMap vào Pod**:

1. **Environment Variables** (envFrom):
   - Load tất cả keys từ ConfigMap
   - Available qua `process.env` trong code

2. **Specific Keys** (valueFrom):
   - Chỉ load specific keys
   - Control chính xác config nào được inject

3. **Volume Mount** (volumeMount):
   - Mount ConfigMap thành files
   - App đọc config từ `/etc/config/app.properties`
   - Hot reload: Update ConfigMap → file tự động update (after ~60s)

---

## Part 5: Secrets Management

### 5.1. Secret YAML

**File**: `k8s/redis-secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
  namespace: boutique
type: Opaque
data:
  # Base64 encoded
  password: cGFzc3dvcmQxMjM=  # "password123"
  username: cmVkaXM=            # "redis"
```

### 5.2. Tạo Secret từ Command Line

```bash
# Tạo secret từ literal values
kubectl create secret generic redis-secret \
  --from-literal=username=redis \
  --from-literal=password=password123 \
  -n boutique

# Tạo secret từ file
kubectl create secret generic db-secret \
  --from-file=./credentials.txt \
  -n boutique
```

### 5.3. Sử dụng Secret

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cartservice
spec:
  template:
    spec:
      containers:
      - name: cartservice
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
```

### 5.4. Best Practices

**Không hardcode secrets**:
```yaml
# Bad
env:
- name: DB_PASSWORD
  value: "password123"

# Good
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: password
```

**Encrypt at rest**:
- Enable encryption trong K8s cluster
- Use external secret managers (AWS Secrets Manager, Vault)

---

## Part 6: Complete Example - Currency Service

### 6.1. Deployment + Service + ConfigMap

**Deployment**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: currencyservice
  namespace: boutique
spec:
  replicas: 2
  selector:
    matchLabels:
      app: currencyservice
  template:
    metadata:
      labels:
        app: currencyservice
    spec:
      containers:
      - name: currencyservice
        image: gcr.io/my-project/currencyservice:v1.0.0
        ports:
        - containerPort: 7000
        envFrom:
        - configMapRef:
            name: currency-config
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 7000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 7000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: currencyservice
  namespace: boutique
spec:
  type: ClusterIP
  selector:
    app: currencyservice
  ports:
  - port: 7000
    targetPort: 7000
    name: grpc
```

**ConfigMap**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: currency-config
  namespace: boutique
data:
  PORT: "7000"
  DISABLE_PROFILER: "true"
  LOG_LEVEL: "info"
```

### 6.2. Deploy Commands

```bash
# Tạo namespace
kubectl create namespace boutique

# Apply manifests
kubectl apply -f currency-config.yaml
kubectl apply -f currency-deployment.yaml
kubectl apply -f currency-service.yaml

# Check deployment
kubectl get deployments -n boutique
kubectl get pods -n boutique
kubectl get services -n boutique

# View logs
kubectl logs -f deployment/currencyservice -n boutique

# Describe pod
kubectl describe pod <pod-name> -n boutique
```

---

## Part 7: Best Practices Summary

### Deployment Best Practices

- **Replicas**: Minimum 2 cho HA, 3+ cho production
- **Resource Limits**: Luôn set requests và limits
- **Health Checks**: Implement cả liveness và readiness probes
- **Image Tags**: Specific versions, không dùng `latest`
- **Labels**: Consistent labeling strategy

### Service Best Practices

- **Type Selection**:
  - ClusterIP cho internal services
  - LoadBalancer cho public services
- **Port Naming**: Name ports rõ ràng (http, grpc, metrics)
- **Session Affinity**: Chỉ dùng khi cần stateful sessions

### ConfigMap/Secrets Best Practices

- **Separation**: Config vs Secrets
- **Immutability**: Treat configs as immutable
- **Versioning**: Version ConfigMaps (app-config-v1, app-config-v2)
- **Encryption**: Enable encryption for Secrets

### Security Best Practices

- **RBAC**: Role-Based Access Control
- **Network Policies**: Restrict pod-to-pod traffic
- **Pod Security Policies**: Enforce security standards
- **Secrets Encryption**: Enable at rest encryption

---

## Part 8: Troubleshooting

### Common Issues

**1. Pods CrashLoopBackOff**

```bash
# Check pod status
kubectl get pods -n boutique

# View logs
kubectl logs <pod-name> -n boutique

# Describe pod (shows events)
kubectl describe pod <pod-name> -n boutique
```

**Causes**:
- Application error
- Missing dependencies
- Resource limits too low
- Health check failing

**2. Service Not Accessible**

```bash
# Check service endpoints
kubectl get endpoints <service-name> -n boutique

# Check if pods are ready
kubectl get pods -l app=frontend -n boutique
```

**Causes**:
- Selector mismatch
- Pods not ready
- Network policy blocking

**3. DNS Resolution Failed**

```bash
# Test DNS from pod
kubectl exec -it <pod-name> -n boutique -- nslookup currencyservice
```

**Causes**:
- Service name typo
- Wrong namespace
- CoreDNS issues

---

## Kết luận

### Key Takeaways

**Kubernetes Objects**:
- **Deployment**: Manage pods, scaling, rolling updates
- **Service**: Networking, load balancing, service discovery
- **ConfigMap**: Configuration management
- **Secret**: Sensitive data management

**Production Readiness**:
- High availability với multiple replicas
- Resource limits cho stability
- Health checks cho auto-recovery
- Proper configuration management

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: kubernetes, k8s, microservices, orchestration, devops

**Published**: November 16, 2025
**Level**: Intermediate
