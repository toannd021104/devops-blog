---
title: "Kubernetes Series #2: Cài Đặt và Setup Kubernetes Cluster"
date: 2024-01-22T09:00:00+07:00
draft: false
author: "DevOps Engineer"
description: "Hướng dẫn chi tiết cách cài đặt Kubernetes với Minikube cho môi trường local và kubeadm cho production cluster."
categories: ["Kubernetes"]
tags: ["kubernetes", "k8s", "minikube", "kubeadm", "setup"]
series: ["Kubernetes từ Cơ Bản đến Nâng Cao"]
showToc: true
TocOpen: true
---

## Giới thiệu

Trong bài này, chúng ta sẽ học cách cài đặt Kubernetes theo 2 cách:
1. **Minikube** - Cho môi trường development/learning
2. **kubeadm** - Cho production cluster

## Phần 1: Cài đặt Minikube

### Yêu cầu hệ thống

- 2 CPU cores trở lên
- 2GB RAM trở lên
- 20GB disk space
- Docker hoặc VirtualBox

### Bước 1: Cài đặt kubectl

**Linux:**
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Kiểm tra
kubectl version --client
```

**macOS:**
```bash
brew install kubectl
```

### Bước 2: Cài đặt Minikube

**Linux:**
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

**macOS:**
```bash
brew install minikube
```

### Bước 3: Start Minikube

```bash
# Start với Docker driver
minikube start --driver=docker

# Hoặc với VirtualBox
minikube start --driver=virtualbox

# Với resource tùy chỉnh
minikube start --cpus=4 --memory=8192 --disk-size=40g
```

### Bước 4: Verify

```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes

# Output:
# NAME       STATUS   ROLES           AGE   VERSION
# minikube   Ready    control-plane   1m    v1.28.0
```

### Minikube Commands hữu ích

```bash
# Stop cluster
minikube stop

# Delete cluster
minikube delete

# SSH vào node
minikube ssh

# Dashboard
minikube dashboard

# Enable addons
minikube addons list
minikube addons enable ingress
minikube addons enable metrics-server
```

## Phần 2: Cài đặt Production Cluster với kubeadm

### Chuẩn bị

Cần ít nhất 3 máy:
- 1 Master node: 2 CPU, 4GB RAM
- 2 Worker nodes: 2 CPU, 2GB RAM

### Bước 1: Cài đặt Container Runtime (trên tất cả nodes)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install containerd
sudo apt install -y containerd

# Configure containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Restart containerd
sudo systemctl restart containerd
sudo systemctl enable containerd
```

### Bước 2: Disable swap (trên tất cả nodes)

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### Bước 3: Install kubeadm, kubelet, kubectl

```bash
# Add Kubernetes repository
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Install
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

### Bước 4: Initialize Master Node

**Chỉ chạy trên Master node:**

```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# Sau khi init xong, chạy:
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Lưu lại command join từ output:
```bash
kubeadm join 192.168.1.100:6443 --token xxxxx \
    --discovery-token-ca-cert-hash sha256:xxxxx
```

### Bước 5: Install Pod Network (Flannel)

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### Bước 6: Join Worker Nodes

**Chạy trên mỗi Worker node:**

```bash
sudo kubeadm join 192.168.1.100:6443 --token xxxxx \
    --discovery-token-ca-cert-hash sha256:xxxxx
```

### Bước 7: Verify Cluster

**Trên Master node:**

```bash
kubectl get nodes

# Output:
# NAME      STATUS   ROLES           AGE   VERSION
# master    Ready    control-plane   5m    v1.28.0
# worker1   Ready    <none>          2m    v1.28.0
# worker2   Ready    <none>          2m    v1.28.0
```

## Testing Cluster

### Deploy một ứng dụng test

```bash
# Create deployment
kubectl create deployment nginx --image=nginx

# Expose service
kubectl expose deployment nginx --port=80 --type=NodePort

# Check
kubectl get pods
kubectl get services

# Test
curl http://<node-ip>:<node-port>
```

### Namespace

```bash
# Create namespace
kubectl create namespace dev
kubectl create namespace prod

# Deploy vào namespace
kubectl create deployment nginx --image=nginx -n dev

# List
kubectl get all -n dev
```

## Troubleshooting

### Các lỗi thường gặp

**1. Pod không start:**
```bash
# Check logs
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**2. Node NotReady:**
```bash
# Check kubelet
sudo systemctl status kubelet
sudo journalctl -xeu kubelet
```

**3. Network issues:**
```bash
# Check CNI
kubectl get pods -n kube-system
kubectl logs <pod-name> -n kube-system
```

## Best Practices

### 1. Resource Management
```yaml
resources:
  requests:
    memory: "64Mi"
    cpu: "250m"
  limits:
    memory: "128Mi"
    cpu: "500m"
```

### 2. Health Checks
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

### 3. Labels và Selectors
```yaml
metadata:
  labels:
    app: nginx
    environment: production
    version: v1.0
```

## Kết luận

Chúng ta đã học cách setup Kubernetes cluster theo 2 cách:
- **Minikube**: Nhanh, đơn giản cho learning
- **kubeadm**: Production-ready cluster

**Bài tiếp theo**: Kubernetes Series #3: Làm việc với Pods và Deployments

## Tài liệu tham khảo

- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [kubeadm Documentation](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/)
- [Container Runtimes](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
