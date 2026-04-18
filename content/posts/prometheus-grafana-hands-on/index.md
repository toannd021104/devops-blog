---
title: "Part 8: Prometheus + Grafana - Monitoring Microservices"
date: 2025-11-17T11:00:00+07:00
draft: false
tags: ["prometheus", "grafana", "monitoring", "kubernetes", "observability"]
categories: ["DevOps", "Monitoring"]
series: ["DevOps Skills Showcase"]
weight: 8
description: "Part 8 - Setup Prometheus + Grafana: Metrics collection, alerting, dashboards cho microservices trên Kubernetes"
ShowToc: true
TocOpen: true
---

> **Part 8 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → [Part 2: Deep Dive](/posts/microservices-boutique-02-deep-dive) → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → Prometheus + Grafana (Final)

---

# Giới thiệu

Bài viết này hướng dẫn setup monitoring cho project [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform).

Chúng ta sẽ xem xét:
- Prometheus setup trên Kubernetes
- Service discovery và metrics collection
- Grafana dashboards
- Alertmanager configuration
- Best practices cho production monitoring

---

## Monitoring Architecture

**<Prometheus Architecture - Services → Prometheus → Grafana → Alerts>**

---

## Part 1: Prometheus Setup

### 1.1. Prometheus Deployment

**File**: `k8s/monitoring/prometheus-deployment.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
      external_labels:
        cluster: 'boutique-prod'
        environment: 'production'

    # Alertmanager configuration
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093

    # Load rules
    rule_files:
      - '/etc/prometheus/rules/*.yml'

    # Scrape configurations
    scrape_configs:
    # Prometheus self-monitoring
    - job_name: 'prometheus'
      static_configs:
      - targets: ['localhost:9090']

    # Kubernetes API server
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

    # Kubernetes nodes
    - job_name: 'kubernetes-nodes'
      kubernetes_sd_configs:
      - role: node
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

    # Kubernetes pods
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      # Only scrape pods with prometheus.io/scrape: "true" annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      # Get scrape path from annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      # Get port from annotation
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      # Add namespace label
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      # Add pod name label
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name
      # Add app label
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: replace
        target_label: app

    # Service endpoints
    - job_name: 'kubernetes-service-endpoints'
      kubernetes_sd_configs:
      - role: endpoints
      relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
      - action: labelmap
        regex: __meta_kubernetes_service_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        action: replace
        target_label: kubernetes_name

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:v2.48.0
        args:
          - '--config.file=/etc/prometheus/prometheus.yml'
          - '--storage.tsdb.path=/prometheus'
          - '--storage.tsdb.retention.time=30d'
          - '--web.enable-lifecycle'
          - '--web.enable-admin-api'
        ports:
        - containerPort: 9090
          name: web
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        - name: prometheus-storage
          mountPath: /prometheus
        - name: prometheus-rules
          mountPath: /etc/prometheus/rules
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 1000m
            memory: 4Gi
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
      - name: prometheus-storage
        persistentVolumeClaim:
          claimName: prometheus-pvc
      - name: prometheus-rules
        configMap:
          name: prometheus-rules

---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  type: ClusterIP
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
    name: web
```

### 1.2. Prometheus Configuration

**Giải thích scrape_configs**:

**1. Kubernetes Service Discovery**

```yaml
kubernetes_sd_configs:
- role: pod
```

**Roles**:
- `node`: Discover Kubernetes nodes
- `pod`: Discover all pods
- `service`: Discover services
- `endpoints`: Discover service endpoints

**Tại sao service discovery?**
- Auto-discover targets
- No manual configuration
- Scales với cluster

**2. Relabel Configs**

```yaml
relabel_configs:
- source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
  action: keep
  regex: true
```

**Actions**:
- `keep`: Keep targets matching regex
- `drop`: Drop targets matching regex
- `replace`: Replace label value
- `labelmap`: Map metadata labels

**Tại sao relabeling?**
- Filter targets
- Transform labels
- Add metadata

**3. Annotations**

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"
```

**Example Pod**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: frontend
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  containers:
  - name: frontend
    image: frontend:latest
    ports:
    - containerPort: 8080
```

### 1.3. RBAC for Prometheus

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources:
  - configmaps
  verbs: ["get"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
```

**Tại sao RBAC?**
- Prometheus cần read Kubernetes API
- Service discovery
- Metadata collection

### 1.4. Persistent Storage

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-pvc
  namespace: monitoring
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: gp3
```

**Tại sao persistent storage?**
- Retain metrics across restarts
- 30 days retention
- Query historical data

---

## Part 2: Application Metrics

### 2.1. Go Service - Frontend

**Instrumentation**:

```go
package main

import (
    "net/http"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    // Counter: HTTP requests total
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    // Histogram: Request duration
    httpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "endpoint"},
    )

    // Gauge: Active connections
    activeConnections = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "active_connections",
            Help: "Number of active connections",
        },
    )

    // Summary: Response size
    responseSize = promauto.NewSummaryVec(
        prometheus.SummaryOpts{
            Name:       "response_size_bytes",
            Help:       "Response size in bytes",
            Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
        },
        []string{"endpoint"},
    )
)

func main() {
    // Metrics endpoint
    http.Handle("/metrics", promhttp.Handler())

    // Application endpoints
    http.HandleFunc("/", handleHome)

    http.ListenAndServe(":8080", nil)
}

func handleHome(w http.ResponseWriter, r *http.Request) {
    timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues(r.Method, r.URL.Path))
    defer timer.ObserveDuration()

    activeConnections.Inc()
    defer activeConnections.Dec()

    // Business logic
    // ...

    httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
    responseSize.WithLabelValues(r.URL.Path).Observe(float64(len("OK")))

    w.Write([]byte("OK"))
}
```

### 2.2. Node.js Service - Currency

**Instrumentation**:

```javascript
const express = require('express');
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

const app = express();

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path).observe(duration);
    httpRequestsTotal.labels(req.method, req.path, res.statusCode).inc();
    activeConnections.dec();
  });

  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Application endpoints
app.get('/convert', (req, res) => {
  // Business logic
  res.json({ result: 100 });
});

app.listen(8080, () => {
  console.log('Server listening on port 8080');
});
```

### 2.3. Metric Types

**1. Counter**

```
http_requests_total{method="GET",endpoint="/",status="200"} 1234
```

**Tại sao?**
- Only increases
- Total count (requests, errors, etc.)
- Rate calculation: `rate(http_requests_total[5m])`

**2. Gauge**

```
active_connections 42
memory_usage_bytes 1073741824
```

**Tại sao?**
- Can go up and down
- Current state (connections, memory, etc.)
- Latest value

**3. Histogram**

```
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="0.5"} 250
http_request_duration_seconds_bucket{le="1.0"} 300
http_request_duration_seconds_sum 450
http_request_duration_seconds_count 300
```

**Tại sao?**
- Distribution of values
- Percentiles: `histogram_quantile(0.95, ...)`
- SLO tracking

**4. Summary**

```
response_size_bytes{quantile="0.5"} 1024
response_size_bytes{quantile="0.9"} 2048
response_size_bytes{quantile="0.99"} 4096
response_size_bytes_sum 100000
response_size_bytes_count 1000
```

**Tại sao?**
- Pre-calculated percentiles
- Client-side aggregation
- Lower server load

---

## Part 3: Alerting Rules

### 3.1. Prometheus Rules

**File**: `k8s/monitoring/prometheus-rules.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
  namespace: monitoring
data:
  alerts.yml: |
    groups:
    # High-level SLO alerts
    - name: slo_alerts
      interval: 1m
      rules:
      # Error rate > 1%
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          > 0.01
        for: 5m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
          runbook_url: "https://wiki.example.com/runbooks/high-error-rate"

      # Latency P95 > 500ms
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, app)
          ) > 0.5
        for: 10m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High latency on {{ $labels.app }}"
          description: "P95 latency is {{ $value }}s (threshold: 0.5s)"

    # Infrastructure alerts
    - name: infrastructure_alerts
      interval: 1m
      rules:
      # Node down
      - alert: NodeDown
        expr: up{job="kubernetes-nodes"} == 0
        for: 5m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Node {{ $labels.instance }} is down"
          description: "Node has been down for more than 5 minutes"

      # High CPU usage
      - alert: HighCPUUsage
        expr: |
          100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 15m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value }}% (threshold: 80%)"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
          / node_memory_MemTotal_bytes * 100 > 90
        for: 10m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value }}% (threshold: 90%)"

      # Disk space low
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes{mountpoint="/"}
          / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 10
        for: 5m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Available disk space is {{ $value }}% (threshold: 10%)"

    # Application alerts
    - name: application_alerts
      interval: 1m
      rules:
      # Pod restarts
      - alert: PodRestarting
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: warning
          team: dev
        annotations:
          summary: "Pod {{ $labels.namespace }}/{{ $labels.pod }} is restarting"
          description: "Pod has restarted {{ $value }} times in the last 15 minutes"

      # Container OOM
      - alert: ContainerOOM
        expr: |
          (kube_pod_container_status_terminated_reason{reason="OOMKilled"} == 1)
        labels:
          severity: critical
          team: dev
        annotations:
          summary: "Container OOMKilled in {{ $labels.namespace }}/{{ $labels.pod }}"
          description: "Container {{ $labels.container }} was OOMKilled"

      # Service down
      - alert: ServiceDown
        expr: up{job="kubernetes-service-endpoints"} == 0
        for: 2m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "Service {{ $labels.kubernetes_name }} is down"
          description: "Service has been down for more than 2 minutes"

    # Business metrics
    - name: business_alerts
      interval: 5m
      rules:
      # Low order rate
      - alert: LowOrderRate
        expr: |
          sum(rate(checkout_orders_total[1h])) < 10
        for: 30m
        labels:
          severity: warning
          team: business
        annotations:
          summary: "Low order rate detected"
          description: "Order rate is {{ $value }}/hour (expected: >10/hour)"

      # High cart abandonment
      - alert: HighCartAbandonment
        expr: |
          sum(rate(cart_abandoned_total[1h]))
          /
          sum(rate(cart_created_total[1h]))
          > 0.5
        for: 1h
        labels:
          severity: warning
          team: product
        annotations:
          summary: "High cart abandonment rate"
          description: "Cart abandonment is {{ $value | humanizePercentage }} (threshold: 50%)"
```

### 3.2. Recording Rules

```yaml
groups:
- name: recording_rules
  interval: 30s
  rules:
  # Pre-calculate request rate per service
  - record: job:http_requests:rate5m
    expr: |
      sum(rate(http_requests_total[5m])) by (job, app)

  # Pre-calculate error rate per service
  - record: job:http_errors:rate5m
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) by (job, app)

  # Pre-calculate P95 latency
  - record: job:http_request_duration:p95
    expr: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job, app)
      )

  # Availability SLI
  - record: sli:availability:ratio
    expr: |
      1 - (
        sum(rate(http_requests_total{status=~"5.."}[5m]))
        /
        sum(rate(http_requests_total[5m]))
      )
```

**Tại sao recording rules?**
- Pre-calculate complex queries
- Faster dashboard loading
- Reduce query load on Prometheus

---

## Part 4: Alertmanager

### 4.1. Alertmanager Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
      slack_api_url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ'

    # Templates
    templates:
    - '/etc/alertmanager/templates/*.tmpl'

    # Routing tree
    route:
      receiver: 'default'
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h

      routes:
      # Critical alerts -> PagerDuty
      - match:
          severity: critical
        receiver: pagerduty
        continue: true

      # Warning alerts -> Slack
      - match:
          severity: warning
        receiver: slack

      # Team-specific routing
      - match:
          team: sre
        receiver: sre-slack
      - match:
          team: backend
        receiver: backend-slack

    # Receivers
    receivers:
    - name: 'default'
      slack_configs:
      - channel: '#alerts'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'

    - name: 'pagerduty'
      pagerduty_configs:
      - service_key: 'PAGERDUTY_SERVICE_KEY'
        description: '{{ .CommonAnnotations.summary }}'

    - name: 'slack'
      slack_configs:
      - channel: '#alerts-warning'
        title: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Description:* {{ .Annotations.description }}
          *Details:*
            {{ range .Labels.SortedPairs }} • *{{ .Name }}:* `{{ .Value }}`
            {{ end }}
          {{ end }}

    - name: 'sre-slack'
      slack_configs:
      - channel: '#team-sre'

    - name: 'backend-slack'
      slack_configs:
      - channel: '#team-backend'

    # Inhibition rules
    inhibit_rules:
    # Inhibit warning if critical is firing
    - source_match:
        severity: 'critical'
      target_match:
        severity: 'warning'
      equal: ['alertname', 'instance']

    # Inhibit node alerts if node is down
    - source_match:
        alertname: 'NodeDown'
      target_match_re:
        alertname: '(HighCPUUsage|HighMemoryUsage|DiskSpaceLow)'
      equal: ['instance']

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  replicas: 2  # HA setup
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:v0.26.0
        args:
          - '--config.file=/etc/alertmanager/alertmanager.yml'
          - '--storage.path=/alertmanager'
          - '--cluster.peer=alertmanager-0.alertmanager:9094'
          - '--cluster.peer=alertmanager-1.alertmanager:9094'
        ports:
        - containerPort: 9093
          name: web
        - containerPort: 9094
          name: cluster
        volumeMounts:
        - name: config
          mountPath: /etc/alertmanager
        - name: storage
          mountPath: /alertmanager
      volumes:
      - name: config
        configMap:
          name: alertmanager-config
      - name: storage
        emptyDir: {}
```

### 4.2. Alert Routing

**<Alertmanager Routing Tree Diagram>**

**Routing Logic**:
1. Group alerts by `alertname`, `cluster`, `service`
2. Wait 10s before sending (batching)
3. Route based on severity:
   - Critical → PagerDuty
   - Warning → Slack
4. Route based on team:
   - SRE → #team-sre
   - Backend → #team-backend

---

## Part 5: Grafana Dashboards

### 5.1. Grafana Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:10.2.0
        ports:
        - containerPort: 3000
          name: web
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-credentials
              key: admin-password
        - name: GF_INSTALL_PLUGINS
          value: "grafana-piechart-panel,grafana-worldmap-panel"
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        - name: grafana-datasources
          mountPath: /etc/grafana/provisioning/datasources
        - name: grafana-dashboards
          mountPath: /etc/grafana/provisioning/dashboards
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 200m
            memory: 512Mi
      volumes:
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-pvc
      - name: grafana-datasources
        configMap:
          name: grafana-datasources
      - name: grafana-dashboards
        configMap:
          name: grafana-dashboards

---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
spec:
  type: LoadBalancer
  selector:
    app: grafana
  ports:
  - port: 80
    targetPort: 3000
```

### 5.2. Datasource Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      access: proxy
      url: http://prometheus:9090
      isDefault: true
      editable: false
      jsonData:
        timeInterval: "15s"
        queryTimeout: "60s"
```

### 5.3. Dashboard JSON

**Example Dashboard - Service Overview**:

```json
{
  "dashboard": {
    "title": "Boutique - Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (app)",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (app)",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, app))",
            "legendFormat": "{{ app }}"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(active_connections) by (app)"
          }
        ]
      }
    ]
  }
}
```

### 5.4. Key Dashboards

**1. Service Dashboard** (Golden Signals)
- Request Rate (Traffic)
- Error Rate (Errors)
- Latency (P50, P95, P99)
- Saturation (CPU, Memory)

**2. Infrastructure Dashboard**
- Node CPU usage
- Node memory usage
- Disk I/O
- Network traffic

**3. Kubernetes Dashboard**
- Pod status
- Container restarts
- Resource usage
- PVC usage

**4. Business Dashboard**
- Orders per minute
- Revenue
- Cart abandonment
- Top products

---

## Part 6: Best Practices

### 6.1. Metric Naming

**Good**:
```
http_requests_total
http_request_duration_seconds
database_connections_active
```

**Bad**:
```
requests  # Too generic
latency_ms  # Wrong unit (use seconds)
dbConns  # Not snake_case
```

**Convention**:
- `<namespace>_<metric>_<unit>_<suffix>`
- Units: `seconds`, `bytes`, `total`
- Suffix: `total` for counters

### 6.2. Label Best Practices

**Good**:
```
http_requests_total{method="GET", endpoint="/api/users", status="200"}
```

**Bad**:
```
http_requests_total{user_id="12345"}  # High cardinality!
```

**Rules**:
- Low cardinality (< 1000 values)
- No user IDs, session IDs
- Keep labels consistent

### 6.3. Query Optimization

**Slow**:
```promql
sum(rate(http_requests_total[5m]))
```

**Fast** (use recording rule):
```promql
job:http_requests:rate5m
```

### 6.4. Retention Strategy

```yaml
# Prometheus
--storage.tsdb.retention.time=30d
--storage.tsdb.retention.size=50GB

# Long-term storage
remote_write:
- url: "http://thanos-receive:19291/api/v1/receive"
```

**Strategy**:
- Prometheus: 30 days (high resolution)
- Thanos/Cortex: 1 year (downsampled)
- S3: Forever (archived)

---

## Kết luận

### Key Takeaways

**Prometheus**:
- Service discovery: Auto-discover targets
- Scrape configs: Flexible filtering
- Recording rules: Pre-calculate metrics
- Alert rules: SLO-based alerting

**Alerting**:
- Alertmanager: Route alerts to teams
- Severity levels: Critical, warning, info
- Inhibition: Reduce alert noise
- Runbooks: Link to documentation

**Grafana**:
- Datasources: Prometheus, Loki, etc.
- Dashboards: Service, infrastructure, business
- Variables: Dynamic dashboards
- Alerts: Grafana-managed alerts

**Best Practices**:
- Metric naming convention
- Low-cardinality labels
- Recording rules for complex queries
- Long-term storage strategy

**Observability Pillars**:
- Metrics: Prometheus
- Logs: Loki (future post)
- Traces: Jaeger/Tempo (future post)

**Project Demo**: [boutique-aws-terraform](https://github.com/toannd021104/boutique-aws-terraform)

---

**Tags**: prometheus, grafana, monitoring, observability, kubernetes

**Published**: November 17, 2025
**Level**: Intermediate
