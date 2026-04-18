---
title: "Part 2: Online Boutique - Phân tích chi tiết từng Microservice (Deep Dive)"
date: 2025-11-16T05:00:00+07:00
draft: false
tags: ["microservices", "docker", "google-cloud", "grpc", "architecture", "source-code-analysis"]
categories: ["DevOps", "Microservices"]
series: ["DevOps Skills Showcase"]
weight: 2
description: "Deep dive vào source code và kiến trúc của 11 microservices trong Online Boutique - phân tích chi tiết implementation, tech stack, và design patterns"
ShowToc: true
TocOpen: true
---

> **Part 2 of 8**: [Part 1: Introduction](/posts/microservices-boutique-01-introduction) → Deep Dive → [Part 3: Docker](/posts/docker-fundamentals-hands-on) → [Part 4: Kubernetes](/posts/kubernetes-fundamentals-hands-on) → [Part 5: AWS + Terraform](/posts/aws-ecs-terraform-hands-on) → [Part 6: GitLab CI/CD](/posts/gitlab-cicd-hands-on) → [Part 7: DevSecOps](/posts/devsecops-security-hands-on) → [Part 8: Prometheus + Grafana](/posts/prometheus-grafana-hands-on)

# Giới thiệu

Trong [Part 1](/posts/microservices-boutique-01-introduction), chúng ta đã tìm hiểu tổng quan về kiến trúc và luồng hoạt động của Online Boutique. Bài viết này sẽ **đi sâu vào từng microservice**, phân tích source code, tech stack, và những design decisions quan trọng.

Mỗi service sẽ được phân tích theo các góc độ:
- **Technology Stack**: Ngôn ngữ, framework, libraries chính
- **Architecture & Design**: Cấu trúc code, design patterns
- **Key Features**: Chức năng chính và cách implement
- **Performance Considerations**: Optimization và best practices
- **Production Readiness**: Logging, monitoring, error handling

---

## 1. Frontend Service (Go)

### 1.1. Technology Stack

```go
// src/frontend/main.go
package main

import (
    "github.com/gorilla/mux"           // HTTP router
    "github.com/sirupsen/logrus"       // Structured logging
    "go.opentelemetry.io/otel"         // Distributed tracing
    "google.golang.org/grpc"           // gRPC client
)
```

**Core Technologies:**
- **Language**: Go 1.21+
- **HTTP Framework**: Gorilla Mux (routing)
- **Template Engine**: Go's `html/template`
- **gRPC Client**: Google gRPC
- **Logging**: Logrus (JSON format)
- **Tracing**: OpenTelemetry
- **Profiling**: Google Cloud Profiler

### 1.2. Architecture & Design

**Server Structure:**

```go
type frontendServer struct {
    productCatalogSvcAddr string
    productCatalogSvcConn *grpc.ClientConn

    currencySvcAddr string
    currencySvcConn *grpc.ClientConn

    cartSvcAddr string
    cartSvcConn *grpc.ClientConn

    recommendationSvcAddr string
    recommendationSvcConn *grpc.ClientConn

    checkoutSvcAddr string
    checkoutSvcConn *grpc.ClientConn

    shippingSvcAddr string
    shippingSvcConn *grpc.ClientConn

    adSvcAddr string
    adSvcConn *grpc.ClientConn

    shoppingAssistantSvcAddr string
}
```

**Design Patterns:**
- **API Gateway Pattern**: Frontend là single entry point
- **Service Aggregation**: Tổng hợp data từ nhiều services
- **Session Management**: Cookie-based sessions
- **Connection Pooling**: Reuse gRPC connections

### 1.3. Key Features

**1.3.1. Session Management**

```go
const (
    cookieMaxAge    = 60 * 60 * 48  // 48 hours
    cookiePrefix    = "shop_"
    cookieSessionID = cookiePrefix + "session-id"
    cookieCurrency  = cookiePrefix + "currency"
)
```

- Session ID lưu trong cookie
- Max age: 48 giờ
- Prefix để tránh conflict với cookies khác

**1.3.2. Currency Support**

```go
var whitelistedCurrencies = map[string]bool{
    "USD": true,
    "EUR": true,
    "CAD": true,
    "JPY": true,
    "GBP": true,
    "TRY": true,
}
```

- Whitelist 6 đơn vị tiền tệ
- User chọn currency → lưu vào cookie
- Mọi giá cả được convert qua `currencyservice`

**1.3.3. HTTP Routes**

```go
// Key routes
r.HandleFunc("/", homeHandler)
r.HandleFunc("/product/{id}", productHandler)
r.HandleFunc("/cart", cartHandler)
r.HandleFunc("/cart/checkout", checkoutHandler)
r.HandleFunc("/setCurrency", setCurrencyHandler)
```

### 1.4. Performance Considerations

**gRPC Connection Management:**
- Persistent connections đến tất cả backend services
- Connection pooling để giảm latency
- Graceful shutdown với `defer conn.Close()`

**Template Caching:**
- Templates được parse một lần lúc startup
- Reuse template instances cho mỗi request

**OpenTelemetry Integration:**
- Distributed tracing cho mọi request
- Trace propagation tới tất cả backend calls

### 1.5. Production Features

**Structured Logging:**

```go
log := logrus.New()
log.Formatter = &logrus.JSONFormatter{
    FieldMap: logrus.FieldMap{
        logrus.FieldKeyTime:  "timestamp",
        logrus.FieldKeyLevel: "severity",
        logrus.FieldKeyMsg:   "message",
    },
    TimestampFormat: time.RFC3339Nano,
}
```

**Health Checks:**
- HTTP endpoint `/healthz` cho liveness probe
- Kiểm tra connection tới critical services

**Error Handling:**
- Graceful degradation (ví dụ: ad service fail → vẫn hiển thị trang)
- User-friendly error messages
- Error logging với context

---

## 2. Product Catalog Service (Go)

### 2.1. Technology Stack

```go
// src/productcatalogservice/server.go
package main

import (
    pb "github.com/.../genproto"       // Protocol Buffers
    "google.golang.org/grpc"           // gRPC server
    "github.com/sirupsen/logrus"       // Logging
)
```

**Core Technologies:**
- **Language**: Go 1.21+
- **RPC**: gRPC server
- **Data Format**: Protocol Buffers
- **Storage**: In-memory (JSON file)
- **Logging**: Logrus

### 2.2. Architecture & Design

**gRPC Service Definition:**

```protobuf
service ProductCatalogService {
    rpc ListProducts(Empty) returns (ListProductsResponse) {}
    rpc GetProduct(GetProductRequest) returns (Product) {}
    rpc SearchProducts(SearchProductsRequest) returns (SearchProductsResponse) {}
}
```

**Key Components:**
- `server.go`: gRPC server implementation
- `product_catalog.go`: Business logic
- `catalog_loader.go`: Load products từ JSON
- `products.json`: Product database

### 2.3. Key Features

**2.3.1. Product Catalog Loading**

```go
// Catalog được load từ JSON file vào memory
type Product struct {
    Id          string
    Name        string
    Description string
    Picture     string
    PriceUsd    *Money
    Categories  []string
}
```

**Sample products.json:**

```json
{
  "products": [
    {
      "id": "OLJCESPC7Z",
      "name": "Vintage Typewriter",
      "description": "This typewriter...",
      "picture": "/static/img/products/typewriter.jpg",
      "priceUsd": {
        "currencyCode": "USD",
        "units": 67,
        "nanos": 990000000
      },
      "categories": ["vintage"]
    }
  ]
}
```

**2.3.2. Product Search**

```go
// Tìm kiếm products theo query string
func (p *productCatalog) SearchProducts(ctx context.Context,
    req *pb.SearchProductsRequest) (*pb.SearchProductsResponse, error) {

    var results []*pb.Product
    for _, p := range parsedCatalog.Products {
        if strings.Contains(strings.ToLower(p.Name),
            strings.ToLower(req.Query)) ||
           strings.Contains(strings.ToLower(p.Description),
            strings.ToLower(req.Query)) {
            results = append(results, p)
        }
    }
    return &pb.SearchProductsResponse{Results: results}, nil
}
```

- Simple string matching (case-insensitive)
- Search trong Name và Description
- Không có pagination (demo purposes)

**2.3.3. Concurrent Access**

```go
var (
    catalogMutex *sync.Mutex
)

func init() {
    catalogMutex = &sync.Mutex{}
}

// Thread-safe catalog reload
func reloadCatalog() {
    catalogMutex.Lock()
    defer catalogMutex.Unlock()
    // Reload catalog...
}
```

### 2.4. Performance Considerations

**In-Memory Storage:**
- ✅ Cực kỳ nhanh (no database I/O)
- ✅ Low latency cho ListProducts
- ⚠️ Not scalable cho large catalogs
- ⚠️ Data loss khi restart (cần persistent storage)

**Mutex for Concurrency:**
- Sử dụng `sync.Mutex` cho thread-safe operations
- Read-heavy workload → có thể dùng `sync.RWMutex` để tối ưu

**gRPC Performance:**
- Protocol Buffers serialization (nhanh hơn JSON)
- HTTP/2 multiplexing
- Connection reuse

### 2.5. Production Features

**Hot Reload Capability:**
- Có thể reload catalog mà không cần restart
- Controlled bởi flag `--reload-catalog`

**Health Checks:**
- Implement gRPC health check protocol
- Status: SERVING/NOT_SERVING

---

## 3. Cart Service (C# .NET)

### 3.1. Technology Stack

```csharp
// src/cartservice/src/Program.cs
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using cartservice;
```

**Core Technologies:**
- **Language**: C# 8.0
- **Framework**: ASP.NET Core 8.0
- **gRPC**: Grpc.AspNetCore
- **Cache**: StackExchange.Redis
- **DI**: Built-in ASP.NET Core DI

### 3.2. Architecture & Design

**Service Implementation:**

```csharp
// src/cartservice/src/services/CartService.cs
public class CartService : Hipstershop.CartService.CartServiceBase
{
    private readonly ICartStore _cartStore;

    public CartService(ICartStore cartStore)
    {
        _cartStore = cartStore;
    }

    public override async Task<Empty> AddItem(
        AddItemRequest request, ServerCallContext context)
    {
        await _cartStore.AddItemAsync(
            request.UserId,
            request.Item.ProductId,
            request.Item.Quantity);
        return new Empty();
    }
}
```

**Design Patterns:**
- **Dependency Injection**: ICartStore interface
- **Repository Pattern**: Separate data access logic
- **Strategy Pattern**: Multiple cart store implementations
  - `RedisCartStore` (production)
  - `SpannerCartStore` (Google Cloud Spanner)
  - `AlloyDBCartStore` (AlloyDB)

### 3.3. Key Features

**3.3.1. Redis Integration**

```csharp
// src/cartservice/src/cartstore/RedisCartStore.cs
public class RedisCartStore : ICartStore
{
    private readonly ConnectionMultiplexer _redis;

    public async Task AddItemAsync(string userId,
        string productId, int quantity)
    {
        var db = _redis.GetDatabase();
        var key = $"cart:{userId}";

        var cart = await GetCartAsync(userId);
        var existingItem = cart.Items
            .FirstOrDefault(i => i.ProductId == productId);

        if (existingItem != null)
        {
            existingItem.Quantity += quantity;
        }
        else
        {
            cart.Items.Add(new CartItem
            {
                ProductId = productId,
                Quantity = quantity
            });
        }

        await db.StringSetAsync(key,
            Serialize(cart),
            TimeSpan.FromMinutes(30));
    }
}
```

**Redis Features:**
- **Key Pattern**: `cart:{userId}`
- **TTL**: 30 minutes (session timeout)
- **Serialization**: Protocol Buffers
- **Connection Pooling**: StackExchange.Redis multiplexer

**3.3.2. gRPC Service Methods**

```protobuf
service CartService {
    rpc AddItem(AddItemRequest) returns (Empty);
    rpc GetCart(GetCartRequest) returns (Cart);
    rpc EmptyCart(EmptyCartRequest) returns (Empty);
}
```

**3.3.3. Health Check**

```csharp
public class HealthCheckService : Health.HealthBase
{
    public override Task<HealthCheckResponse> Check(
        HealthCheckRequest request,
        ServerCallContext context)
    {
        // Check Redis connection
        try
        {
            _redis.GetDatabase().Ping();
            return Task.FromResult(new HealthCheckResponse
            {
                Status = HealthCheckResponse.Types.ServingStatus.Serving
            });
        }
        catch
        {
            return Task.FromResult(new HealthCheckResponse
            {
                Status = HealthCheckResponse.Types.ServingStatus.NotServing
            });
        }
    }
}
```

### 3.4. Performance Considerations

**Redis Performance:**
- In-memory storage → sub-millisecond latency
- Connection multiplexing → efficient connection usage
- Pipeline support → batch operations

**Async/Await:**
- Non-blocking I/O operations
- Better resource utilization
- Scalability cho high concurrency

**Protocol Buffers:**
- Compact binary format
- Faster serialization vs JSON
- Type safety

### 3.5. Production Features

**Dependency Injection:**

```csharp
// src/cartservice/src/Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddSingleton<ICartStore>(sp =>
    {
        var redisAddress = Environment.GetEnvironmentVariable("REDIS_ADDR");
        var redis = ConnectionMultiplexer.Connect(redisAddress);
        return new RedisCartStore(redis);
    });

    services.AddGrpc();
}
```

**Error Handling:**
- Try-catch around Redis operations
- Graceful degradation
- Proper gRPC status codes

**Observability:**
- ASP.NET Core logging
- OpenTelemetry integration
- Request/response logging

---

## 4. Currency Service (Node.js)

### 4.1. Technology Stack

```javascript
// src/currencyservice/server.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const pino = require('pino');  // Fast JSON logger
```

**Core Technologies:**
- **Runtime**: Node.js 18+
- **gRPC**: @grpc/grpc-js
- **Logging**: Pino (high-performance logger)
- **Tracing**: OpenTelemetry
- **Profiling**: Google Cloud Profiler

### 4.2. Architecture & Design

**Currency Data:**

```javascript
// Hard-coded exchange rates
const SUPPORTED_CURRENCIES = {
  'EUR': 0.85,
  'USD': 1.0,
  'JPY': 110.0,
  'CAD': 1.25,
  'GBP': 0.73,
  'TRY': 8.5
};
```

**gRPC Service:**

```protobuf
service CurrencyService {
    rpc GetSupportedCurrencies(Empty)
        returns (GetSupportedCurrenciesResponse);

    rpc Convert(CurrencyConversionRequest)
        returns (Money);
}
```

### 4.3. Key Features

**4.3.1. Currency Conversion**

```javascript
function convert(request, callback) {
  try {
    const from = request.from;
    const to_code = request.to_code;

    // Convert to USD first
    const usd_amount = {
      units: from.units / SUPPORTED_CURRENCIES[from.currency_code],
      nanos: from.nanos / SUPPORTED_CURRENCIES[from.currency_code]
    };

    // Then convert to target currency
    const result = {
      currency_code: to_code,
      units: Math.floor(usd_amount.units * SUPPORTED_CURRENCIES[to_code]),
      nanos: Math.floor(usd_amount.nanos * SUPPORTED_CURRENCIES[to_code])
    };

    callback(null, result);
  } catch (err) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: err.message
    });
  }
}
```

**Logic:**
1. Convert từ source currency → USD
2. Convert từ USD → target currency
3. Handle units và nanos separately (để tránh floating point errors)

**4.3.2. Money Type**

```protobuf
message Money {
  string currency_code = 1;  // "USD", "EUR", etc.
  int64 units = 2;           // Whole dollars
  int32 nanos = 3;           // Fractional part (0-999,999,999)
}
```

**Ví dụ:**
- $67.99 = `{units: 67, nanos: 990000000}`
- €100.50 = `{units: 100, nanos: 500000000}`

**Tại sao không dùng float?**
- ❌ Floating point errors: `0.1 + 0.2 !== 0.3`
- ✅ Integer math: Precise calculations
- ✅ Avoid rounding errors trong financial transactions

### 4.4. Performance Considerations

**Node.js Event Loop:**
- Single-threaded → không cần mutex
- Non-blocking I/O
- Efficient cho I/O-bound tasks

**In-Memory Rates:**
- No external API calls
- Sub-millisecond response time
- ⚠️ Static rates (not real-time)

**Pino Logger:**
- Fastest JSON logger cho Node.js
- Async logging → không block event loop

### 4.5. Production Features

**OpenTelemetry:**

```javascript
if (process.env.ENABLE_TRACING == "1") {
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
  const opentelemetry = require('@opentelemetry/sdk-node');

  const traceExporter = new OTLPTraceExporter({
    url: process.env.COLLECTOR_SERVICE_ADDR
  });

  const sdk = new opentelemetry.NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'currencyservice',
    }),
    traceExporter: traceExporter,
  });

  sdk.start();
}
```

**gRPC Health Check:**

```javascript
const grpcHealthCheck = require('grpc-health-check');

const healthImpl = new grpcHealthCheck.Implementation({
  '': proto.hipstershop.HealthCheckResponse.ServingStatus.SERVING,
  'hipstershop.CurrencyService':
    proto.hipstershop.HealthCheckResponse.ServingStatus.SERVING,
});

server.addService(healthService, healthImpl);
```

---

## 5. Payment Service (Node.js)

### 5.1. Technology Stack

Same như Currency Service:
- Node.js 18+
- @grpc/grpc-js
- Pino logger
- OpenTelemetry

### 5.2. Key Features

**5.2.1. Mock Payment Processing**

```javascript
function charge(request, callback) {
  const amount = request.amount;
  const card = request.credit_card;

  logger.info({
    message: 'Transaction processed',
    amount: `${amount.currency_code} ${amount.units}.${amount.nanos}`,
    card_type: card.credit_card_cvv.length === 3 ? 'Visa/MC' : 'Amex',
    card_last_four: card.credit_card_number.slice(-4)
  });

  // Generate transaction ID
  const transactionId = `${uuidv4()}`;

  callback(null, { transaction_id: transactionId });
}
```

**Mock Features:**
- Không charge thật
- Generate UUID làm transaction ID
- Log transaction details
- Instant success response

**5.2.2. Credit Card Validation**

```javascript
function validateCreditCard(card) {
  // Check card number (basic Luhn algorithm)
  if (!card.credit_card_number ||
      card.credit_card_number.length < 15 ||
      card.credit_card_number.length > 19) {
    throw new Error('Invalid card number length');
  }

  // Check CVV
  if (!card.credit_card_cvv ||
      (card.credit_card_cvv.length !== 3 &&
       card.credit_card_cvv.length !== 4)) {
    throw new Error('Invalid CVV');
  }

  // Check expiry
  const now = new Date();
  if (card.credit_card_expiration_year < now.getFullYear()) {
    throw new Error('Card expired');
  }
}
```

### 5.3. Production Considerations

**Security:**
- ⚠️ **DEMO ONLY**: Không dùng cho production
- ❌ Không lưu card info
- ❌ Không có PCI compliance
- ✅ Trong production: Dùng Stripe, PayPal, Square, etc.

**Error Handling:**
- Validation errors → gRPC INVALID_ARGUMENT
- Processing errors → gRPC INTERNAL
- Timeout handling

---

## 6. Email Service (Python)

### 6.1. Technology Stack

```python
# src/emailservice/email_server.py
import grpc
from concurrent import futures
from jinja2 import Environment, FileSystemLoader
import googlecloudprofiler
from opentelemetry import trace
```

**Core Technologies:**
- **Language**: Python 3.11
- **gRPC**: grpcio
- **Template**: Jinja2
- **Tracing**: OpenTelemetry
- **Profiling**: Google Cloud Profiler

### 6.2. Key Features

**6.2.1. Email Template (Jinja2)**

```html
<!-- templates/confirmation.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Order Confirmation</title>
</head>
<body>
    <h1>Order Confirmation</h1>
    <p>Hi {{ email }},</p>
    <p>Your order {{ order.order_id }} has been confirmed.</p>

    <h2>Order Items:</h2>
    <ul>
    {% for item in order.items %}
        <li>{{ item.product_id }} x {{ item.quantity }}</li>
    {% endfor %}
    </ul>

    <p>Total: {{ order.total.currency_code }}
       {{ order.total.units }}.{{ order.total.nanos }}</p>
</body>
</html>
```

**6.2.2. Send Email (Mock)**

```python
class DummyEmailService(BaseEmailService):
    def SendOrderConfirmation(self, request, context):
        logger.info('A request to send order confirmation email to {}'.format(
            request.email))

        try:
            # Render template
            confirmation = template.render(
                email=request.email,
                order=request.order
            )

            logger.info('Order confirmation email rendered')
            logger.debug(confirmation)

        except TemplateError as err:
            logger.error(err.message)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(
                'An error occurred rendering email template.')
            return demo_pb2.Empty()

        return demo_pb2.Empty()
```

**Mock Features:**
- Không send email thật
- Chỉ render template và log
- Trong production: Dùng SendGrid, AWS SES, Mailgun, etc.

### 6.3. Production Considerations

**Template Security:**
- Jinja2 auto-escaping → prevent XSS
- Safe HTML rendering

**Performance:**
- Template caching
- Async rendering có thể improve với `asyncio`

**Error Handling:**
- Template errors → gRPC INTERNAL
- Missing data → gRPC INVALID_ARGUMENT

---

## 7. Shipping Service (Go)

### 7.1. Technology Stack

```go
package main

import (
    "fmt"
    pb "github.com/.../genproto"
    "google.golang.org/grpc"
)
```

**Core Technologies:**
- Language: Go 1.21+
- gRPC server
- Simple business logic

### 7.2. Key Features

**7.2.1. Shipping Quote Calculation**

```go
func (s *server) GetQuote(ctx context.Context,
    req *pb.GetQuoteRequest) (*pb.GetQuoteResponse, error) {

    log.Infof("[GetQuote] received request for address: %v", req.Address)

    quote := createQuoteFromItems(req.Items)

    return &pb.GetQuoteResponse{
        CostUsd: quote,
    }, nil
}

func createQuoteFromItems(items []*pb.CartItem) *pb.Money {
    var totalCost int64 = 0

    // Base shipping cost
    const baseShippingCost int64 = 5_00 // $5.00

    // Cost per item
    for _, item := range items {
        totalCost += int64(item.Quantity) * 50 // $0.50 per item
    }

    totalCost += baseShippingCost

    return &pb.Money{
        CurrencyCode: "USD",
        Units: totalCost / 100,
        Nanos: int32(totalCost % 100) * 10_000_000,
    }
}
```

**Shipping Logic:**
- Base cost: $5.00
- Per item: $0.50
- Formula: `$5.00 + ($0.50 × quantity)`

**7.2.2. Ship Order**

```go
func (s *server) ShipOrder(ctx context.Context,
    req *pb.ShipOrderRequest) (*pb.ShipOrderResponse, error) {

    log.Info("[ShipOrder] received request")

    // Generate tracking ID
    trackingId := fmt.Sprintf("%s-%d",
        generateRandomString(10),
        time.Now().Unix())

    return &pb.ShipOrderResponse{
        TrackingId: trackingId,
    }, nil
}
```

**Mock Features:**
- Generate random tracking ID
- Format: `{random_10_chars}-{timestamp}`
- Instant response (no real shipping)

---

## 8. Checkout Service (Go) - The Orchestrator

### 8.1. Technology Stack

```go
package main

import (
    pb "github.com/.../genproto"
    "google.golang.org/grpc"
    "github.com/sirupsen/logrus"
)
```

### 8.2. Architecture - Orchestration Pattern

Checkout Service là **orchestrator** - điều phối nhiều services:

```
Checkout Service (Orchestrator)
    ├─> Cart Service (Get cart)
    ├─> Product Catalog (Get products)
    ├─> Currency Service (Convert prices)
    ├─> Shipping Service (Get quote & ship)
    ├─> Payment Service (Charge)
    └─> Email Service (Send confirmation)
```

### 8.3. Key Features

**8.3.1. Place Order Flow**

```go
func (cs *checkoutService) PlaceOrder(ctx context.Context,
    req *pb.PlaceOrderRequest) (*pb.PlaceOrderResponse, error) {

    log.Infof("[PlaceOrder] user_id=%q user_currency=%q",
        req.UserId, req.UserCurrency)

    // Step 1: Get user cart
    cartResp, err := pb.NewCartServiceClient(cs.cartSvcConn).GetCart(ctx,
        &pb.GetCartRequest{UserId: req.UserId})
    if err != nil {
        return nil, err
    }

    // Step 2: Get order items with product details
    orderItems, err := cs.prepareOrderItems(ctx,
        cartResp.Items, req.UserCurrency)
    if err != nil {
        return nil, err
    }

    // Step 3: Calculate shipping cost
    shippingUSD, err := cs.quoteShipping(ctx,
        req.Address, cartResp.Items)
    if err != nil {
        return nil, err
    }

    // Step 4: Calculate total cost
    totalPrice := pb.Money{
        CurrencyCode: req.UserCurrency,
        Units: 0,
        Nanos: 0,
    }
    for _, item := range orderItems {
        totalPrice = addMoney(totalPrice, *item.Cost)
    }
    totalPrice = addMoney(totalPrice, *shippingUSD)

    // Step 5: Charge the card
    txID, err := cs.chargeCard(ctx, &totalPrice, req.CreditCard)
    if err != nil {
        return nil, err
    }

    // Step 6: Ship the order
    shippingTrackingID, err := cs.shipOrder(ctx,
        req.Address, cartResp.Items)
    if err != nil {
        return nil, err
    }

    // Step 7: Send confirmation email
    _ = cs.sendOrderConfirmation(ctx, req.Email, order)

    // Step 8: Empty the cart
    if err := cs.emptyUserCart(ctx, req.UserId); err != nil {
        log.Warnf("failed to empty cart: %v", err)
    }

    // Step 9: Generate order result
    orderID := uuid.New().String()
    orderResult := &pb.OrderResult{
        OrderId: orderID,
        ShippingTrackingId: shippingTrackingID,
        ShippingCost: shippingUSD,
        ShippingAddress: req.Address,
        Items: orderItems,
    }

    return &pb.PlaceOrderResponse{Order: orderResult}, nil
}
```

**9 Steps trong PlaceOrder:**
1. ✅ Get cart từ Cart Service
2. ✅ Get product details từ Product Catalog
3. ✅ Calculate shipping cost
4. ✅ Calculate total price
5. ✅ Charge credit card
6. ✅ Ship order
7. ✅ Send email confirmation (non-critical, không fail nếu lỗi)
8. ✅ Empty cart
9. ✅ Return order result

### 8.4. Error Handling Strategy

**Critical vs Non-Critical:**

```go
// Critical - fail nếu lỗi
cartResp, err := cs.getCart(ctx, userID)
if err != nil {
    return nil, status.Errorf(codes.Internal,
        "failed to get cart: %v", err)
}

// Non-critical - log warning, continue
err = cs.sendEmail(ctx, email, order)
if err != nil {
    log.Warnf("failed to send email: %v", err)
    // Continue anyway
}
```

**Critical Services:**
- Cart, Product Catalog, Payment, Shipping

**Non-Critical Services:**
- Email (order vẫn thành công nếu email fail)

### 8.5. Transaction Management

**⚠️ No Distributed Transactions:**
- Không có 2-phase commit
- Không có rollback tự động
- ❌ Nếu payment success nhưng shipping fail → inconsistent state

**Workarounds:**
- Saga pattern (compensating transactions)
- Idempotency keys
- Eventual consistency
- Manual reconciliation

---

## 9. Recommendation Service (Python)

### 9.1. Technology Stack

```python
import grpc
import random
from concurrent import futures
```

**Core Technologies:**
- Python 3.11
- grpcio
- Simple algorithm (random selection)

### 9.2. Key Features

**9.2.1. Product Recommendation**

```python
def ListRecommendations(self, request, context):
    max_responses = 5

    # Get all products
    cat_response = product_catalog_stub.ListProducts(demo_pb2.Empty())
    product_ids = [x.id for x in cat_response.products]

    # Filter out current product
    filtered_products = [pid for pid in product_ids
                        if pid != request.product_ids[0]]

    # Random selection
    num_products = min(max_responses, len(filtered_products))
    recommendations = random.sample(filtered_products, num_products)

    logger.info(f"[Recommend] product_ids={recommendations}")

    return demo_pb2.ListRecommendationsResponse(
        product_ids=recommendations
    )
```

**Algorithm:**
- Get all products từ Product Catalog
- Filter out current product
- Random select 5 products
- ⚠️ Very basic (production sẽ dùng ML models)

**Production Recommendations:**
- Collaborative filtering
- Content-based filtering
- ML models (TensorFlow, PyTorch)
- Personalization based on history

---

## 10. Ad Service (Java + Spring Boot)

### 10.1. Technology Stack

```java
// src/adservice/src/main/java/hipstershop/AdService.java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
```

**Core Technologies:**
- **Language**: Java 17
- **Framework**: Spring Boot 3.0
- **Build**: Gradle
- **gRPC**: grpc-spring-boot-starter

### 10.2. Key Features

**10.2.1. Contextual Ads**

```java
@GrpcService
public class AdServiceImpl extends AdServiceGrpc.AdServiceImplBase {

    private static final List<Ad> ADS = Arrays.asList(
        Ad.newBuilder()
            .setRedirectUrl("/product/2ZYFJ3GM2N")
            .setText("Vintage camera")
            .build(),
        Ad.newBuilder()
            .setRedirectUrl("/product/66VCHSJNUP")
            .setText("Vintage typewriter")
            .build()
        // ... more ads
    );

    @Override
    public void getAds(AdRequest req,
        StreamObserver<AdResponse> responseObserver) {

        List<String> contextKeys = req.getContextKeysList();

        // Filter ads based on context
        List<Ad> filteredAds = ADS.stream()
            .filter(ad -> matchesContext(ad, contextKeys))
            .limit(2)
            .collect(Collectors.toList());

        AdResponse reply = AdResponse.newBuilder()
            .addAllAds(filteredAds)
            .build();

        responseObserver.onNext(reply);
        responseObserver.onCompleted();
    }
}
```

**Ad Serving Logic:**
- Hard-coded list of ads
- Filter based on context keys
- Return max 2 ads
- Simple matching algorithm

**10.2.2. Context-based Targeting**

```java
private boolean matchesContext(Ad ad, List<String> contextKeys) {
    for (String key : contextKeys) {
        if (ad.getText().toLowerCase().contains(key.toLowerCase())) {
            return true;
        }
    }
    return false;
}
```

### 10.3. Production Considerations

**Real Ad Platforms:**
- Google AdSense
- Amazon Advertising
- Real-time bidding (RTB)
- User tracking & targeting
- Click tracking & analytics

---

## 11. Load Generator (Python + Locust)

### 11.1. Technology Stack

```python
# src/loadgenerator/locustfile.py
from locust import HttpUser, TaskSet, between, task
```

**Core Technologies:**
- **Framework**: Locust
- **Language**: Python 3.11
- **Purpose**: Load testing

### 11.2. Key Features

**11.2.1. User Simulation**

```python
class UserBehavior(TaskSet):

    @task(1)
    def index(self):
        self.client.get("/")

    @task(10)
    def browse_product(self):
        products = self.get_products()
        product = random.choice(products)
        self.client.get(f"/product/{product['id']}")

    @task(3)
    def add_to_cart(self):
        products = self.get_products()
        product = random.choice(products)

        self.client.post("/cart", {
            "product_id": product['id'],
            "quantity": random.randint(1, 5)
        })

    @task(1)
    def checkout(self):
        self.client.post("/cart/checkout", {
            "email": "test@example.com",
            "street_address": "123 Main St",
            "zip_code": "12345",
            "city": "Anytown",
            "state": "CA",
            "country": "US",
            "credit_card_number": "4432801561520454",
            "credit_card_expiration_month": "12",
            "credit_card_expiration_year": "2025",
            "credit_card_cvv": "123"
        })

class WebsiteUser(HttpUser):
    tasks = [UserBehavior]
    wait_time = between(1, 5)  # Wait 1-5s between tasks
```

**Task Weights:**
- `index`: 1x (home page)
- `browse_product`: 10x (most common)
- `add_to_cart`: 3x
- `checkout`: 1x (least common)

**11.2.2. Load Testing Scenarios**

```bash
# Light load
locust -f locustfile.py --host=http://localhost:8080 \
  --users=10 --spawn-rate=1

# Medium load
locust -f locustfile.py --host=http://localhost:8080 \
  --users=100 --spawn-rate=10

# Heavy load
locust -f locustfile.py --host=http://localhost:8080 \
  --users=1000 --spawn-rate=100
```

---

## Tổng kết: So sánh các Services

### Technology Stack Summary

| Service | Language | Framework | Key Library | Complexity |
|---------|----------|-----------|-------------|------------|
| Frontend | Go | Gorilla Mux | gRPC Client | ⭐⭐⭐⭐ High |
| Product Catalog | Go | Standard | gRPC Server | ⭐⭐ Low |
| Cart | C# | ASP.NET Core | Redis | ⭐⭐⭐ Medium |
| Currency | Node.js | Native | gRPC | ⭐⭐ Low |
| Payment | Node.js | Native | gRPC | ⭐⭐ Low |
| Email | Python | Jinja2 | gRPC | ⭐⭐ Low |
| Shipping | Go | Standard | gRPC | ⭐ Very Low |
| Checkout | Go | Standard | gRPC Client | ⭐⭐⭐⭐⭐ Very High |
| Recommendation | Python | Native | gRPC | ⭐⭐ Low |
| Ad | Java | Spring Boot | gRPC | ⭐⭐⭐ Medium |
| Load Generator | Python | Locust | HTTP | ⭐⭐ Low |

### Design Patterns Used

**1. API Gateway Pattern**
- Frontend service làm gateway
- Single entry point cho clients

**2. Orchestration Pattern**
- Checkout service orchestrates multiple services
- Centralized workflow logic

**3. Repository Pattern**
- Cart service với ICartStore interface
- Multiple implementations (Redis, Spanner, AlloyDB)

**4. Service Discovery**
- Environment variables cho service addresses
- DNS-based discovery trong Kubernetes

**5. Circuit Breaker (Implicit)**
- Graceful degradation (ad service optional)
- Error handling không crash toàn hệ thống

### Performance Characteristics

**Fastest Services:**
1. **Currency** (in-memory rates, Node.js event loop)
2. **Shipping** (simple calculation, Go performance)
3. **Product Catalog** (in-memory JSON, Go performance)

**Most I/O Intensive:**
1. **Cart** (Redis operations)
2. **Frontend** (multiple gRPC calls)
3. **Checkout** (7+ service calls)

**Most Complex:**
1. **Checkout** (orchestration logic, error handling)
2. **Frontend** (aggregation, templating, session management)
3. **Cart** (DI, multiple storage backends)

### Production Readiness

**Production-Ready Features:**
- ✅ Structured logging (JSON format)
- ✅ OpenTelemetry tracing
- ✅ gRPC health checks
- ✅ Graceful shutdown
- ✅ Error handling
- ✅ Connection pooling

**Missing for Production:**
- ❌ Rate limiting
- ❌ Authentication/Authorization
- ❌ Input sanitization
- ❌ Distributed transactions
- ❌ Caching layers
- ❌ Database persistence (some services)

---

## Bài học & Best Practices

### 1. Language Selection

**Go cho high-performance services:**
- Frontend, Product Catalog, Checkout, Shipping
- ✅ Fast, concurrent, low memory
- ✅ Great cho gRPC servers

**Node.js cho simple business logic:**
- Currency, Payment
- ✅ Quick development
- ✅ Good cho I/O-bound tasks
- ⚠️ Single-threaded

**Python cho scripting & ML:**
- Email, Recommendation, Load Generator
- ✅ Rich ecosystem (Jinja2, Locust)
- ✅ Good cho ML/AI (future)

**C# cho enterprise features:**
- Cart Service
- ✅ Strong typing, DI, async/await
- ✅ Integration với .NET ecosystem

**Java cho legacy/enterprise:**
- Ad Service
- ✅ Spring Boot ecosystem
- ⚠️ Heavier resource usage

### 2. gRPC Best Practices

✅ **Use Protocol Buffers:**
- Type safety
- Compact serialization
- Backward compatibility

✅ **Connection Pooling:**
- Reuse connections
- Lower latency

✅ **Health Checks:**
- Standard gRPC health check protocol
- Kubernetes liveness/readiness probes

✅ **Error Handling:**
- Proper gRPC status codes
- Meaningful error messages

### 3. Observability

✅ **Structured Logging:**
- JSON format cho easy parsing
- Include correlation IDs
- Log levels (debug, info, warn, error)

✅ **Distributed Tracing:**
- OpenTelemetry integration
- Trace propagation across services
- Identify performance bottlenecks

✅ **Metrics:**
- Request count, latency, error rate
- Resource utilization
- Business metrics

### 4. Resilience Patterns

✅ **Graceful Degradation:**
- Ad service optional
- Email non-critical
- Continue on non-critical errors

✅ **Timeouts:**
- gRPC deadlines
- Circuit breakers
- Retry logic

✅ **Error Handling:**
- Try-catch around external calls
- Proper error propagation
- Meaningful error messages

---

## Kết luận

Online Boutique là một **excellent reference architecture** cho microservices, với:

**Điểm mạnh:**
- ✅ Realistic e-commerce workflow
- ✅ Multi-language stack (5 languages)
- ✅ Production-ready features (logging, tracing, health checks)
- ✅ Well-documented code
- ✅ Good separation of concerns

**Hạn chế (by design for demo):**
- ⚠️ Mock implementations (payment, email, shipping)
- ⚠️ No authentication/authorization
- ⚠️ No data persistence cho một số services
- ⚠️ Static data (exchange rates, product catalog)
- ⚠️ No distributed transaction handling

**Key Takeaways:**
1. **Microservices tăng complexity**: 11 services thay vì 1 monolith
2. **Orchestration is hard**: Checkout service phải handle 7+ services
3. **Observability is crucial**: Logging, tracing, metrics are must-have
4. **Error handling is complex**: Partial failures, compensation logic
5. **Technology diversity có trade-offs**: Flexibility vs operational complexity

---

## Next Steps

Trong các bài tiếp theo:

1. **Monitoring & Observability**: Setup Prometheus, Grafana, Jaeger
2. **Kubernetes Deployment**: Production deployment guide
3. **CI/CD Pipeline**: Automated testing và deployment
4. **Security Hardening**: Authentication, authorization, secrets management
5. **Performance Optimization**: Caching, load balancing, auto-scaling

Stay tuned!

---

## Resources

- **Source Code**: [GitHub Repository](https://github.com/GoogleCloudPlatform/microservices-demo)
- **gRPC Documentation**: https://grpc.io/docs/
- **Protocol Buffers**: https://developers.google.com/protocol-buffers
- **OpenTelemetry**: https://opentelemetry.io/
- **Microservices Patterns**: https://microservices.io/patterns/

---

**Tags:** #microservices #source-code #grpc #architecture #deep-dive #golang #nodejs #python #csharp #java

**Published:** November 16, 2025
**Reading time:** ~25 minutes
**Difficulty:** Advanced
