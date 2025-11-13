---
title: "Kubernetes Series #1: Giới Thiệu Về Kubernetes"
date: 2024-01-15T09:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Tìm hiểu về Kubernetes - nền tảng điều phối container phổ biến nhất hiện nay. Bài viết đầu tiên trong series Kubernetes từ cơ bản đến nâng cao."
categories: ["Kubernetes"]
tags: ["kubernetes", "k8s", "container-orchestration", "devops"]
series: ["Kubernetes từ Cơ Bản đến Nâng Cao"]
cover:
  image: ""
  alt: "Kubernetes Architecture"
  caption: "Kiến trúc Kubernetes"
showToc: true
TocOpen: true
---

## Giới thiệu

Kubernetes (K8s) là một nền tảng mã nguồn mở để tự động hóa việc triển khai, mở rộng và quản lý các ứng dụng container hóa. Được phát triển bởi Google và hiện được quản lý bởi Cloud Native Computing Foundation (CNCF).

## Tại sao cần Kubernetes?

### 1. Quản lý Container ở quy mô lớn

Khi bạn có hàng trăm, hàng nghìn container, việc quản lý thủ công trở nên không khả thi:
- **Triển khai tự động**: Deploy ứng dụng lên nhiều server
- **Scaling**: Tự động tăng/giảm số lượng container
- **Load balancing**: Phân phối traffic đều giữa các container
- **Self-healing**: Tự động restart container bị lỗi

### 2. Tính di động (Portability)

Kubernetes chạy được trên nhiều môi trường:
```bash
# Local development
minikube start

# Cloud providers
- Google Kubernetes Engine (GKE)
- Amazon Elastic Kubernetes Service (EKS)
- Azure Kubernetes Service (AKS)

# On-premise
- Bare metal
- VMware
- OpenStack
```

## Các khái niệm cơ bản

### 1. Pod

Pod là đơn vị nhỏ nhất trong Kubernetes, chứa một hoặc nhiều container:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
  - name: nginx
    image: nginx:latest
    ports:
    - containerPort: 80
```

### 2. Node

Node là máy chủ (vật lý hoặc ảo) nơi các Pod chạy. Có 2 loại:
- **Master Node**: Quản lý cluster
- **Worker Node**: Chạy các ứng dụng

### 3. Cluster

Cluster là tập hợp các Node được quản lý bởi Kubernetes.

## Kiến trúc Kubernetes

### Control Plane (Master Node)

Các thành phần chính:

1. **API Server**: Cổng giao tiếp chính
2. **etcd**: Database lưu trữ trạng thái cluster
3. **Scheduler**: Phân bổ Pod vào Node
4. **Controller Manager**: Quản lý các controller

### Worker Node

Các thành phần:

1. **Kubelet**: Agent chạy trên mỗi node
2. **Container Runtime**: Docker, containerd, CRI-O...
3. **Kube-proxy**: Quản lý networking

## Ví dụ thực tế

### Deploy một ứng dụng web đơn giản

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: nginx:alpine
        ports:
        - containerPort: 80
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
spec:
  selector:
    app: webapp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

Apply configuration:

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Kiểm tra
kubectl get pods
kubectl get services
```

## Lợi ích của Kubernetes

### 1. High Availability
- Tự động restart container lỗi
- Replicate ứng dụng trên nhiều node
- Health checks tự động

### 2. Scalability
```bash
# Scale manual
kubectl scale deployment webapp --replicas=5

# Auto-scaling
kubectl autoscale deployment webapp --min=2 --max=10 --cpu-percent=80
```

### 3. Rolling Updates
```bash
# Update image mới
kubectl set image deployment/webapp webapp=nginx:1.19

# Rollback nếu có vấn đề
kubectl rollout undo deployment/webapp
```

## Khi nào nên dùng Kubernetes?

### ✅ Nên dùng khi:
- Microservices architecture
- Ứng dụng cần scale linh hoạt
- Multi-cloud deployment
- Team lớn, nhiều services

### ❌ Chưa cần thiết khi:
- Ứng dụng monolithic đơn giản
- Traffic thấp, không cần scale
- Team nhỏ, ít resources
- Chỉ cần Docker Compose

## Kết luận

Kubernetes là công cụ mạnh mẽ cho container orchestration, nhưng cũng có độ phức tạp nhất định. Trong series này, chúng ta sẽ đi sâu vào từng khái niệm và thực hành hands-on.

**Bài tiếp theo**: [Kubernetes Series #2: Cài đặt và Setup Kubernetes Cluster](#)

## Tài liệu tham khảo

- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
- [Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way)
- [CNCF Landscape](https://landscape.cncf.io/)
