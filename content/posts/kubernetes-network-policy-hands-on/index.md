---
title: "Kubernetes Hands-on Lab - Network Policy: Kiểm soát traffic trong K8s"
date: 2025-11-17T01:00:00+07:00
draft: false
tags: ["kubernetes", "network-policy", "security", "hands-on", "devops"]
categories: ["DevOps", "Kubernetes"]
series: ["Kubernetes Fundamentals"]
description: "Thực hành Network Policy trong Kubernetes: kiểm soát ingress/egress traffic, bảo vệ cluster khỏi truy cập trái phép"
ShowToc: true
TocOpen: true
---

# Giới thiệu

**Kubernetes Network Policy** là cơ chế kiểm soát traffic giữa các pods trong cluster. Mặc định, tất cả pods đều có thể giao tiếp với nhau - điều này tạo ra **rủi ro bảo mật** nghiêm trọng.

Khi một Network Policy được áp dụng cho pod, pod đó sẽ:
- Không còn chấp nhận tất cả traffic
- Chỉ cho phép traffic theo rules được định nghĩa
- Có thể kiểm soát cả **ingress** (traffic vào) và **egress** (traffic ra)

**Lưu ý quan trọng:** Network Policy chỉ hoạt động khi bạn sử dụng **network plugin hỗ trợ**:
- **Calico** - Phổ biến nhất, được dùng trong lab này
- **Romana** - Hỗ trợ network policies
- **Cilium** - Hỗ trợ L7 policies
- **Flannel** - KHÔNG hỗ trợ network policies

---

## 1. Network Policy là gì?

### 1.1. Khái niệm

**Network Policy** là Kubernetes resource cho phép bạn định nghĩa:
- Pods nào được phép giao tiếp với nhau
- Pods nào được phép truy cập ra bên ngoài
- Traffic từ đâu được phép vào pods

### 1.2. Cấu trúc cơ bản

![Network Policy Architecture](network-policy-architecture.png)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: example-policy
  namespace: default
spec:
  podSelector:           # Chọn pods áp dụng policy
    matchLabels:
      app: web
  policyTypes:
  - Ingress              # Kiểm soát traffic vào
  - Egress               # Kiểm soát traffic ra
  ingress:               # Rules cho traffic vào
  - from:
    - podSelector:
        matchLabels:
          role: frontend
  egress:                # Rules cho traffic ra
  - to:
    - ipBlock:
        cidr: 10.0.0.0/8
```

### 1.3. Các loại selectors

![Ingress vs Egress Traffic Flow](ingress-egress-flow.png)

| Selector | Mô tả |
| -------- | ----- |
| **podSelector** | Chọn pods theo labels trong cùng namespace |
| **namespaceSelector** | Chọn tất cả pods trong namespaces được chọn |
| **ipBlock** | Chọn theo dải IP (CIDR notation) |

---

## 2. Lab: Phân tích Network Policy có sẵn

### 2.1. Kiểm tra deny-metadata policy

Trong môi trường AWS EKS, có một network policy quan trọng để chặn truy cập vào **EC2 Instance Metadata**:

```bash
kubectl get networkpolicy deny-metadata -o yaml
```

**Output:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata
  namespace: default
spec:
  podSelector: {}        # Áp dụng cho TẤT CẢ pods trong namespace
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0           # Cho phép tất cả
        except:
        - 169.254.169.254/32      # NGOẠI TRỪ metadata endpoint
```

![deny-metadata Policy Diagram](deny-metadata-diagram.png)

**Phân tích:**
- `podSelector: {}` → Áp dụng cho tất cả pods trong namespace
- `policyTypes: [Egress]` → Chỉ kiểm soát traffic ra, ingress vẫn mặc định allow all
- `egress` → Whitelist: cho phép tất cả IP trừ `169.254.169.254`

### 2.2. Tìm hiểu Egress Policy

```bash
kubectl explain networkpolicy.spec.egress
```

**Output:**

```
FIELDS:
   ports    <[]Object>
      List of destination ports for outgoing traffic.

   to       <[]Object>
      List of destinations for outgoing traffic of pods selected.
      If empty, all destinations are allowed.
```

### 2.3. Tìm hiểu Egress To field

```bash
kubectl explain networkpolicy.spec.egress.to
```

**Output:**

```
FIELDS:
   ipBlock           <Object>
      IPBlock defines policy on a particular IPBlock.

   namespaceSelector <Object>
      Selects Namespaces using cluster-scoped labels.

   podSelector       <Object>
      Selects Pods within this namespace.
```

### 2.4. Tìm hiểu ipBlock

```bash
kubectl explain networkpolicy.spec.egress.to.ipBlock
```

**Output:**

```
FIELDS:
   cidr     <string> -required-
      CIDR is a string representing the IP Block.

   except   <[]string>
      Except is a slice of CIDRs that should not be included.
```

---

## 3. Lab: Test Network Policy

![Lab Test Network Policy](lab-test-network-policy.png)

### 3.1. Test trong default namespace (có policy)

Tạo pod busybox trong default namespace:

```bash
kubectl run busybox --image=busybox --rm -it /bin/sh
```

**Test 1: Kết nối ra internet**

```bash
wget https://google.com
```

**Output:**

```
Connecting to google.com (142.250.185.78:443)
saving to 'index.html'
index.html           100%
'index.html' saved
```

→ Thành công vì `0.0.0.0/0` được allow.

**Test 2: Kết nối đến EC2 Metadata**

```bash
wget 169.254.169.254
```

**Output:**

```
Connecting to 169.254.169.254 (169.254.169.254:80)
^C  # Timeout - không kết nối được
```

→ Bị block bởi network policy!

Exit pod:

```bash
exit
```

### 3.2. Test trong namespace khác (không có policy)

Tạo namespace mới và test:

```bash
# Tạo namespace test
kubectl create namespace test

# Chạy pod trong namespace test
kubectl run busybox --image=busybox --rm -it -n test /bin/sh
```

**Test kết nối đến EC2 Metadata:**

```bash
wget 169.254.169.254
```

**Output:**

```
Connecting to 169.254.169.254 (169.254.169.254:80)
saving to 'index.html'
index.html           100%
```

→ Thành công! Namespace `test` không có network policy nên cho phép tất cả.

### 3.3. Khai thác AWS Credentials (Security Risk!)

![EC2 Metadata Security Risk](ec2-metadata-security-risk.png)

Từ pod trong namespace `test`, kẻ tấn công có thể lấy AWS credentials:

```bash
# Lấy tên IAM role
role=$(wget -qO- 169.254.169.254/latest/meta-data/iam/security-credentials)

# Lấy credentials
wget -qO- 169.254.169.254/latest/meta-data/iam/security-credentials/$role
```

**Output:**

```json
{
  "Code" : "Success",
  "LastUpdated" : "2024-11-17T10:00:00Z",
  "Type" : "AWS-HMAC",
  "AccessKeyId" : "ASIA...",
  "SecretAccessKey" : "...",
  "Token" : "...",
  "Expiration" : "2024-11-17T16:00:00Z"
}
```

**Đây là lý do tại sao network policy quan trọng!** Credentials này có thể được dùng để:
- Truy cập S3 buckets
- Khởi động EC2 instances
- Xóa resources
- Và nhiều hơn nữa tùy thuộc IAM permissions

Exit pod:

```bash
exit
```

---

## 4. Lab: Tạo Network Policy với Pod Selector

### 4.1. Scenario

![App Tiers Network Policy Scenario](app-tiers-scenario.png)

Tạo network policy cho phép:
- Pods có label `app-tier: cache` được kết nối đến
- Pods có label `app-tier: web` trên port 80

### 4.2. Tạo Network Policy

```bash
cat > app-policy.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-tiers
  namespace: test
spec:
  podSelector:
    matchLabels:
      app-tier: web           # Áp dụng cho pods có label app-tier=web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app-tier: cache     # Chỉ cho phép từ pods có label app-tier=cache
    ports:
    - port: 80                # Chỉ port 80
EOF
```

Áp dụng policy:

```bash
kubectl create -f app-policy.yaml
```

**Output:**

```
networkpolicy.networking.k8s.io/app-tiers created
```

### 4.3. Tạo Web Server Pod

```bash
kubectl run web-server -n test -l app-tier=web --image=nginx:1.15.1 --port 80
```

**Output:**

```
pod/web-server created
```

### 4.4. Test từ Cache Tier (Allowed)

```bash
# Lấy IP của web server
web_ip=$(kubectl get pod -n test -o jsonpath='{.items[0].status.podIP}')

# Chạy pod với label app-tier=cache
kubectl run busybox -n test -l app-tier=cache --image=busybox --env="web_ip=$web_ip" --rm -it /bin/sh
```

Trong pod, test kết nối:

```bash
wget $web_ip
```

**Output:**

```
Connecting to 10.244.0.15 (10.244.0.15:80)
saving to 'index.html'
index.html           100%
'index.html' saved
```

→ Thành công! Pod có label `app-tier=cache` được phép kết nối.

![Test Cache Tier Allowed](test-cache-tier-allowed.png)

Exit pod:

```bash
exit
```

### 4.5. Test từ Pod không có label (Denied)

```bash
# Chạy pod KHÔNG có label app-tier
kubectl run busybox -n test --image=busybox --env="web_ip=$web_ip" --rm -it /bin/sh
```

Test kết nối:

```bash
wget $web_ip
```

**Output:**

```
Connecting to 10.244.0.15 (10.244.0.15:80)
^C  # Timeout - không kết nối được
```

→ Bị block! Pod không có label `app-tier=cache` không được phép kết nối.

![Test No Label Denied](test-no-label-denied.png)

Exit pod:

```bash
exit
```

---

## 5. Network Policy Best Practices

![Network Policy Best Practices](network-policy-best-practices.png)

### 5.1. Default Deny All

Luôn bắt đầu với policy deny all:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

Sau đó whitelist các traffic cần thiết.

### 5.2. Deny Metadata Endpoint cho tất cả namespaces

Áp dụng deny-metadata policy cho tất cả namespaces quan trọng:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata
  namespace: <NAMESPACE>
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
```

### 5.3. Sử dụng Labels có ý nghĩa

Đặt labels rõ ràng cho pods:

```yaml
labels:
  app: myapp
  tier: frontend      # frontend, backend, database
  environment: prod   # dev, staging, prod
```

### 5.4. Giới hạn Egress cụ thể

Thay vì allow all, chỉ định cụ thể:

```yaml
egress:
- to:
  - namespaceSelector:
      matchLabels:
        name: kube-system
  ports:
  - port: 53
    protocol: UDP      # DNS only
- to:
  - podSelector:
      matchLabels:
        app: database
  ports:
  - port: 5432         # PostgreSQL only
```

---

## 6. Troubleshooting Network Policies

![Troubleshooting Flow](troubleshooting-flow.png)

### 6.1. Kiểm tra Network Plugin

```bash
kubectl get pods -n kube-system | grep -E "calico|cilium|weave"
```

Nếu không có network plugin hỗ trợ, network policies sẽ không hoạt động!

### 6.2. Kiểm tra Policy đã áp dụng

```bash
# List tất cả network policies
kubectl get networkpolicy -A

# Describe policy cụ thể
kubectl describe networkpolicy <policy-name> -n <namespace>
```

### 6.3. Test connectivity

```bash
# Chạy pod test
kubectl run test-pod --image=busybox --rm -it -- /bin/sh

# Trong pod, test connectivity
nc -zv <target-ip> <port>
wget --timeout=5 <target-ip>:<port>
```

### 6.4. Common Issues

| Issue | Nguyên nhân | Giải pháp |
| ----- | ----------- | --------- |
| Policy không hoạt động | Network plugin không hỗ trợ | Chuyển sang Calico/Cilium |
| Pod bị block unexpected | podSelector sai | Kiểm tra labels của pod |
| Egress bị block | Thiếu DNS egress rule | Thêm allow DNS (port 53) |

---

## 7. Tổng kết

### 7.1. Kiến thức đã học

**Network Policy Basics:**
- Network Policy kiểm soát traffic giữa pods
- Cần network plugin hỗ trợ (Calico, Cilium)
- Mặc định allow all → cần explicit deny

**Policy Types:**
- **Ingress**: Kiểm soát traffic vào pods
- **Egress**: Kiểm soát traffic ra từ pods

**Selectors:**
- `podSelector`: Chọn pods theo labels
- `namespaceSelector`: Chọn namespaces
- `ipBlock`: Chọn theo CIDR

**Security:**
- Block EC2 metadata endpoint (169.254.169.254)
- Prevent credential theft từ metadata
- Use default deny policies

### 7.2. Commands Summary

```bash
# List network policies
kubectl get networkpolicy -A

# Describe policy
kubectl describe networkpolicy <name> -n <namespace>

# Explain fields
kubectl explain networkpolicy.spec.egress
kubectl explain networkpolicy.spec.ingress

# Test connectivity
kubectl run test --image=busybox --rm -it -- wget <ip>:<port>
```

### 7.3. Key Takeaways

- Luôn sử dụng network policies trong production
- Block EC2 metadata endpoint trong tất cả namespaces
- Start with deny-all, then whitelist
- Test policies kỹ trước khi deploy
- Sử dụng labels có ý nghĩa cho pods

---

## Resources

**Official Docs:**
- Kubernetes Network Policies: https://kubernetes.io/docs/concepts/services-networking/network-policies/
- Calico Network Policies: https://docs.projectcalico.org/security/kubernetes-network-policy

**Tools:**
- Network Policy Editor: https://editor.networkpolicy.io/
- Calico: https://www.projectcalico.org/

**Lab Platform:**
- Platform.qa Kubernetes Labs

---
