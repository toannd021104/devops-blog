---
title: "Deploy Microservices #4: Deploy lên Kubernetes với Helm Charts"
date: 2024-11-14T12:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Deploy microservices lên EKS cluster với Kubernetes manifests và Helm charts. Deployments, Services, Ingress, ConfigMaps, Secrets và auto-scaling."
categories: ["Microservices", "Kubernetes", "DevOps"]
tags: ["kubernetes", "eks", "helm", "deployment", "ingress", "k8s"]
series: ["Deploy Microservices - Full DevOps"]
showToc: true
TocOpen: true
---

## Giới thiệu

Infrastructure đã sẵn sàng, images đã push lên ECR. Giờ deploy lên Kubernetes!

Trong bài này:
- ✅ Connect kubectl với EKS
- ✅ Deploy services với Deployments
- ✅ Setup Services và Ingress
- ✅ ConfigMaps và Secrets
- ✅ Auto-scaling với HPA

## Connect to EKS Cluster

```bash
# Update kubeconfig
aws eks update-kubeconfig \
  --region ap-southeast-1 \
  --name microservices-dev

# Verify
kubectl get nodes

# Output:
# NAME                         STATUS   ROLES    AGE   VERSION
# ip-10-0-1-123.ec2.internal   Ready    <none>   5m    v1.28.0
# ip-10-0-2-456.ec2.internal   Ready    <none>   5m    v1.28.0
```

## Kubernetes Manifests

### 1. Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: microservices
  labels:
    name: microservices
```

### 2. Product Service Deployment

```yaml
# product-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: microservices
  labels:
    app: product-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
        version: v1
    spec:
      containers:
      - name: product-service
        image: <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/microservices/product-service:latest
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        env:
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database_host
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database_password
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: redis_host
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: product-service
  namespace: microservices
  labels:
    app: product-service
spec:
  type: ClusterIP
  selector:
    app: product-service
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
```

### 3. ConfigMap và Secrets

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: microservices
data:
  database_host: "microservices.xxxx.ap-southeast-1.rds.amazonaws.com"
  database_port: "5432"
  database_name: "microservices"
  redis_host: "microservices.xxxx.cache.amazonaws.com"
  redis_port: "6379"
  log_level: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: microservices
type: Opaque
stringData:
  database_password: "YourStrongPassword123!"
  redis_password: ""
  jwt_secret: "your-jwt-secret-key"
```

**Important:** Encrypt secrets với SOPS hoặc dùng AWS Secrets Manager!

### 4. Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: microservices-ingress
  namespace: microservices
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: api-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /products
        pathType: Prefix
        backend:
          service:
            name: product-service
            port:
              number: 80
      - path: /cart
        pathType: Prefix
        backend:
          service:
            name: cart-service
            port:
              number: 80
      - path: /checkout
        pathType: Prefix
        backend:
          service:
            name: checkout-service
            port:
              number: 80
```

## Install NGINX Ingress Controller

```bash
# Add Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace kube-system \
  --set controller.service.type=LoadBalancer \
  --set controller.metrics.enabled=true

# Get LoadBalancer URL
kubectl get svc nginx-ingress-ingress-nginx-controller \
  -n kube-system
```

## Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: product-service-hpa
  namespace: microservices
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

## Deploy Everything

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Deploy configs
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml

# Deploy services
kubectl apply -f product-service/
kubectl apply -f cart-service/
kubectl apply -f checkout-service/
kubectl apply -f payment-service/
kubectl apply -f frontend/

# Setup ingress
kubectl apply -f ingress.yaml

# Setup autoscaling
kubectl apply -f hpa.yaml

# Verify
kubectl get pods -n microservices
kubectl get svc -n microservices
kubectl get ingress -n microservices
kubectl get hpa -n microservices
```

## Helm Chart (Better Approach)

Cấu trúc Helm chart:

```
microservices-chart/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── product-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── cart-service/
│   ├── ingress.yaml
│   └── _helpers.tpl
└── values/
    ├── dev.yaml
    ├── staging.yaml
    └── prod.yaml
```

Deploy với Helm:

```bash
# Install
helm install microservices ./microservices-chart \
  --namespace microservices \
  --create-namespace \
  -f values/dev.yaml

# Upgrade
helm upgrade microservices ./microservices-chart \
  --namespace microservices \
  -f values/dev.yaml

# Rollback
helm rollback microservices 1
```

## Monitoring Deployment

```bash
# Watch pods
kubectl get pods -n microservices -w

# Check pod logs
kubectl logs -f deployment/product-service -n microservices

# Describe pod
kubectl describe pod <pod-name> -n microservices

# Port forward for testing
kubectl port-forward svc/product-service 8080:80 -n microservices

# Test
curl http://localhost:8080/products
```

## Troubleshooting

### Pod not starting:

```bash
# Check events
kubectl get events -n microservices --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n microservices --previous

# Exec into pod
kubectl exec -it <pod-name> -n microservices -- /bin/sh
```

### Service not accessible:

```bash
# Check service endpoints
kubectl get endpoints -n microservices

# Test service from within cluster
kubectl run curl --image=curlimages/curl -it --rm -- /bin/sh
curl http://product-service.microservices.svc.cluster.local
```

## Next: CI/CD Pipeline

Trong bài tiếp theo, chúng ta sẽ tự động hóa toàn bộ quá trình này với GitHub Actions!
