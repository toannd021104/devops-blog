---
id: "2"
slug: "squid-outbound-proxy-eks-local-zone"
title: "Tự làm NAT Gateway trên AWS Local Zone bằng Squid + EIP"
excerpt: "AWS Local Zone không có NAT Gateway. Đây là hành trình tìm giải pháp thay thế bằng Squid forward proxy + Elastic IP trên EKS — kèm lệnh thực tế và các lỗi gặp phải."
category: "AWS"
date: "May 1, 2026"
readTime: "10 min read"
image: "kubernetes.jpg"
featured: true
summary:
  - "AWS Local Zone thiếu nhiều dịch vụ quan trọng — NAT Gateway, NLB đều không có"
  - "Squid DaemonSet với hostNetwork=true và EIP là cách tự làm egress NAT hiệu quả"
  - "Các lỗi thực tế gặp phải khi deploy EKS trên Local Zone Perth — kèm cách fix"
takeaways:
  - "EIP phải allocate đúng network-border-group của Local Zone — EIP Region không gắn được"
  - "Local Zone Perth không support NLB — phải dùng ClusterIP thay vì LoadBalancer"
  - "Lambda + EventBridge giúp auto-assign EIP khi node scale mà không cần can thiệp thủ công"
  - "map_public_ip_on_launch phải bật trên subnet — dù EIP được gắn thủ công sau"
---

Khi deploy EKS lên **AWS Local Zone** để giảm latency khi kết nối với các partner on-prem — thay vì đi vòng qua Singapore (~30-50ms), traffic chạy nội địa chỉ còn ~1-5ms.

Yêu cầu nghe đơn giản: pods gọi ra API của partner với fixed source IP để whitelist.

Bài này ghi lại quá trình tìm giải pháp thay thế: từ lúc hiểu ra vấn đề, đến thiết kế kiến trúc, đến từng lỗi thực tế gặp phải khi deploy trên Local Zone Perth (ap-southeast-2-per-1a).

---

## Xác nhận Local Zone có gì

Đầu tiên opt-in Local Zone và kiểm tra service nào available:

```bash
aws ec2 modify-availability-zone-group \
  --group-name ap-southeast-2-per-1 \
  --opt-in-status opted-in \
  --region ap-southeast-2

aws ec2 describe-availability-zones \
  --region ap-southeast-2 \
  --all-availability-zones \
  --filter "Name=zone-name,Values=ap-southeast-2-per-1a" \
  --query 'AvailabilityZones[*].OptInStatus'
```

```json
["opted-in"]
```

NAT Gateway không có trong danh sách. NLB cũng không. Những thứ này chỉ có ở Region chính.

---

## Phân tích vấn đề

Bài toán gồm hai phần:

1. **Network reachability** — pods trong private subnet không có đường ra internet
2. **Fixed source IP** — traffic ra ngoài phải mang IP cố định để partner whitelist

NAT Gateway giải quyết cả hai. Khi không có nó, cần tự xây.

**Ý tưởng:** Chạy pod với `hostNetwork: true` trên worker node có EIP gắn vào ENI → traffic ra ngoài mang EIP của node. Về mặt network đây chính xác là những gì NAT Gateway làm. Thêm Squid vào để có URL whitelist và access control.

```
App Pod
  │  HTTP_PROXY=http://squid-proxy.squid.svc:3128
  ↓
Squid Pod (hostNetwork=true, node có EIP)
  │  kiểm tra ACL whitelist
  ↓
Traffic ra ngoài src IP = EIP của node
  ↓
Partner (thấy fixed IP, đã whitelist)
```

---

## Kiến trúc

![Squid Outbound Proxy Architecture](squid-eks-architecture.png)

```
VPC 10.0.0.0/16
│
├── ap-southeast-2a/b (Sydney)
│   └── EKS Control Plane — bắt buộc ở Region, ít nhất 2 AZ
│
└── ap-southeast-2-per-1a (Perth — Local Zone)
    └── Public  10.0.40.0/24  ← Proxy + App Worker Nodes
          Squid DaemonSet, hostNetwork=true
          EIP gắn vào ENI từng node
          → IGW → Internet
```

---

## Deploy

### 1. EKS Cluster

```hcl
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "eks-outbound-proxy"
  cluster_version = "1.31"

  subnet_ids = [
    aws_subnet.cp_az1.id,   # ap-southeast-2a
    aws_subnet.cp_az2.id,   # ap-southeast-2b
  ]

  eks_managed_node_groups = {
    proxy_nodes = {
      subnet_ids     = [aws_subnet.proxy.id]
      instance_types = ["t3.medium"]

      labels = { "node-role" = "proxy-node" }
      taints = [{ key = "proxy-only", value = "true", effect = "NO_SCHEDULE" }]
      tags   = { "proxy-node" = "true" }
    }
  }
}
```

```bash
terraform apply -auto-approve
```

```
Apply complete! Resources: 47 added, 0 changed, 0 destroyed.

Outputs:
cluster_name = "eks-outbound-proxy"
proxy_eips   = ["96.0.6.15", "96.0.4.253"]
```

### 2. EIP cho Local Zone

EIP mặc định allocate ở Region Sydney — **không gắn được** vào instance ở Local Zone (khác network border group). Phải allocate riêng:

```bash
aws ec2 allocate-address \
  --domain vpc \
  --network-border-group ap-southeast-2-per-1 \
  --region ap-southeast-2
```

```json
{
    "NetworkBorderGroup": "ap-southeast-2-per-1",
    "PublicIp": "96.0.6.15"
}
```

### 3. Lambda auto-assign EIP khi node scale

```python
def handler(event, context):
    state       = event['detail']['state']
    instance_id = event['detail']['instance-id']

    if state == 'running':
        tags = get_instance_tags(instance_id)
        if tags.get('proxy-node') != 'true':
            return
        eni_id   = get_primary_eni(instance_id)
        alloc_id = find_free_eip()
        ec2.associate_address(AllocationId=alloc_id, NetworkInterfaceId=eni_id)

    elif state == 'terminated':
        ec2.disassociate_address(...)
```

EventBridge trigger khi EC2 state thay đổi. Partner chỉ cần whitelist danh sách EIP một lần — kể cả khi cluster scale.

### 4. Squid qua Helm

```bash
helm install squid-proxy \
  ./helm/squid-proxy \
  -n squid \
  --create-namespace
```

```
STATUS: deployed  REVISION: 1
```

```bash
kubectl get pods -n squid -o wide
```

```
NAME                READY   STATUS    NODE
squid-proxy-spcm4   1/1     Running   ip-10-0-40-168...
squid-proxy-k9x2p   1/1     Running   ip-10-0-40-193...
```

Thêm domain mới chỉ cần một lệnh:

```bash
helm upgrade squid-proxy ./helm/squid-proxy \
  --set "squid.allowedDomains[3]=.newpartner.vn" \
  -n squid
```

---

## Verify

```bash
kubectl run curl-test --image=curlimages/curl --restart=Never -- sleep 3600

kubectl exec -it curl-test -- \
  curl -x http://squid-proxy.squid.svc.cluster.local:3128 http://ifconfig.me
```

```
96.0.6.15
```

✅ Source IP chính xác là EIP của proxy node.

```bash
kubectl exec -it curl-test -- \
  curl -x http://squid-proxy.squid.svc.cluster.local:3128 http://google.com
```

```
Access Denied — ERR_ACCESS_DENIED
```

✅ Domain không trong whitelist bị block.

---

## Lỗi thực tế gặp phải

### Lỗi 1: EIP không gắn được vào Local Zone

```
OperationNotPermitted: Cannot associate addresses across network border groups
```

EIP allocate ở `ap-southeast-2` không gắn được vào instance ở `ap-southeast-2-per-1a`.

**Fix:** Allocate EIP với đúng `--network-border-group ap-southeast-2-per-1`.

---

### Lỗi 2: NLB không support

```
ValidationError: You cannot have any Local Zone subnets
for load balancers of type 'network'
```

**Fix:** Đổi service type sang `ClusterIP`. App pods dùng DNS nội bộ K8s:
`http://squid-proxy.squid.svc.cluster.local:3128`

---

### Lỗi 3: Node không join được cluster

```
NodeCreationFailure: Instances failed to join the kubernetes cluster
```

App nodes đặt trong private subnet không có route ra internet lúc bootstrap.

**Fix:** Đặt app nodes trong public subnet. Traffic pod vẫn đi qua Squid nhờ `HTTP_PROXY` — vị trí node không ảnh hưởng đến routing của pod.

---

### Lỗi 4: map_public_ip_on_launch

```
Ec2SubnetInvalidConfiguration: does not automatically assign public IP addresses
```

**Fix:** Bật `map_public_ip_on_launch = true` trên subnet — EIP gắn đè lên sau bởi Lambda.

---

### Lỗi 5: Helm provider không authenticate

```
Kubernetes cluster unreachable: the server has asked for the client to provide credentials
```

**Fix:** Thêm `--profile` và `--region` vào `aws eks get-token` trong Terraform provider config.

---

## Rút ra

Local Zone có nhiều quirk mà documentation không nói rõ:

**EIP border group:** Thứ dễ bỏ qua nhất. EIP và instance phải cùng network border group mới gắn được — EIP của Region không dùng được cho Local Zone.

**Service limitations:** Check availability trước khi design. NAT Gateway, NLB đều không có — phải tìm cách khác.

**Troubleshooting:** Mỗi lỗi đều có lý do rõ ràng — đọc kỹ error message thường là đủ để biết hướng fix.

---

*Source code: [github.com/toannd021104/traefik-outbound-proxy](https://github.com/toannd021104/traefik-outbound-proxy)*
