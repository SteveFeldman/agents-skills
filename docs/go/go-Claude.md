# Go Development Guide for Claude Code

## Table of Contents
1. [Architecture & Design](#architecture--design)
2. [Code Style & Standards](#code-style--standards)
3. [Performance & Scalability](#performance--scalability)
4. [Security](#security)
5. [Testing](#testing)
6. [Patterns & Best Practices](#patterns--best-practices)
7. [Production Readiness](#production-readiness)
8. [Common Anti-Patterns](#common-anti-patterns)

---

## Architecture & Design

### Microservice Architecture Patterns

**Go-Kit Framework (Recommended)**
The highest-performing services consistently use Go-Kit with proper three-layer architecture:

```go
// Service Layer - Business logic
type Service interface {
    ProcessOrder(ctx context.Context, req ProcessOrderRequest) (ProcessOrderResponse, error)
    GetOrder(ctx context.Context, id string) (*Order, error)
}

// Endpoint Layer - Request/response transformation
func MakeProcessOrderEndpoint(s Service) endpoint.Endpoint {
    return func(ctx context.Context, request interface{}) (interface{}, error) {
        req := request.(ProcessOrderRequest)
        resp, err := s.ProcessOrder(ctx, req)
        return resp, err
    }
}

// Transport Layer - HTTP handling
func MakeHTTPHandler(endpoints Endpoints) http.Handler {
    r := mux.NewRouter()
    r.Methods("POST").Path("/orders").Handler(httptransport.NewServer(
        endpoints.ProcessOrder,
        decodeProcessOrderRequest,
        encodeResponse,
    ))
    return r
}
```

**Clean Architecture Implementation**
Services following hexagonal architecture show superior maintainability:

```go
// Domain models in center
type Order struct {
    Code    string    `json:"code"`
    Status  string    `json:"status"`
    Entries []Entry   `json:"entries"`
}

func (o *Order) ValidateForProcessing() error {
    // Business logic in domain
    if o.Status != "pending" {
        return errors.New("order must be pending to process")
    }
    return nil
}

// Service layer orchestrates
type OrderService struct {
    orderRepo   OrderRepository    // Interface
    paymentSvc  PaymentService     // Interface
    eventPub    EventPublisher     // Interface
}

func (s *OrderService) ProcessOrder(ctx context.Context, req ProcessOrderRequest) error {
    order, err := s.orderRepo.GetByID(ctx, req.OrderID)
    if err != nil {
        return fmt.Errorf("order retrieval failed: %w", err)
    }
    
    if err := order.ValidateForProcessing(); err != nil {
        return fmt.Errorf("order validation failed: %w", err)
    }
    
    // Continue processing...
    return nil
}
```

### Package Organization

**Domain-Driven Design (Recommended)**
```
service/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── domain/
│   │   ├── order.go
│   │   └── customer.go
│   ├── service/
│   │   ├── order_service.go
│   │   └── interfaces.go
│   ├── repository/
│   │   └── order_repository.go
│   └── transport/
│       └── http/
│           └── handlers.go
└── pkg/
    └── shared/
        └── errors.go
```

**Interface Placement**
Define interfaces where they're used (consumer-defined):

```go
// Define interfaces in the package that uses them
package orderservice

// OrderRepository interface defined by the service that uses it
type OrderRepository interface {
    GetByID(ctx context.Context, id string) (*Order, error)
    Save(ctx context.Context, order *Order) error
}

type OrderService struct {
    repo OrderRepository  // Depends on interface, not implementation
}
```

---

## Code Style & Standards

### Formatting and Structure

**Always use `gofmt` and `goimports`**:
```bash
# Format all Go files
gofmt -w .

# Format and organize imports
goimports -w .

# Simplify code
gofmt -s -w .
```

**Import Organization**:
```go
package orderservice

import (
    // Standard library imports first
    "context"
    "encoding/json"
    "fmt"
    "time"
    
    // Third-party imports second
    "github.com/gorilla/mux"
    "github.com/prometheus/client_golang/prometheus"
    
    // Local imports last
    "github.com/company/project/internal/models"
    "github.com/company/project/pkg/utils"
)
```

### Naming Conventions

**Functions and Variables**:
```go
// Exported functions: PascalCase
func CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error)
func GetUserByID(id string) (*User, error)

// Unexported functions: camelCase
func validateOrderItems(items []Item) error
func calculateTotalPrice(items []Item) float64

// Short names for short scopes
for i, item := range items {
    // i is fine here
}

// Descriptive names for longer scopes
func ProcessOrder(orderRequest OrderRequest) error {
    customerID := orderRequest.CustomerID
    orderItems := orderRequest.Items
    // ...
}
```

**Interface Naming**:
```go
// Single method interfaces: -er suffix
type Reader interface {
    Read([]byte) (int, error)
}

type Writer interface {
    Write([]byte) (int, error)
}

// Multi-method interfaces: descriptive names
type OrderRepository interface {
    Create(ctx context.Context, order *Order) error
    GetByID(ctx context.Context, id string) (*Order, error)
    Update(ctx context.Context, order *Order) error
    Delete(ctx context.Context, id string) error
}
```

### Error Handling

**Structured Error Types**:
```go
// Custom error with context
type ServiceError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Cause   error  `json:"-"`
}

func (e *ServiceError) Error() string {
    return e.Message
}

func (e *ServiceError) Unwrap() error {
    return e.Cause
}

// Error wrapping with context
func (s *service) ProcessOrder(ctx context.Context, req ProcessOrderRequest) error {
    if err := s.validateOrder(req); err != nil {
        return fmt.Errorf("order validation failed: %w", err)
    }
    
    if err := s.reserveInventory(ctx, req); err != nil {
        return fmt.Errorf("inventory reservation failed for order %s: %w", 
            req.OrderID, err)
    }
    
    return nil
}
```

**Error Handling Best Practices**:
```go
// Check errors immediately
func ProcessOrder(order *Order) error {
    if err := validateOrder(order); err != nil {
        return fmt.Errorf("validation failed: %w", err)
    }
    
    if err := saveOrder(order); err != nil {
        return fmt.Errorf("save failed: %w", err)
    }
    
    return nil
}

// Never ignore errors
func BadExample() {
    saveOrder(order) // DON'T ignore error
}

func GoodExample() error {
    if err := saveOrder(order); err != nil {
        return err
    }
    return nil
}
```

### Function Design

**Single Responsibility**:
```go
// DO: Separate concerns
func ProcessOrder(order *Order) error {
    if err := ValidateOrder(order); err != nil {
        return err
    }
    
    CalculateOrderTotal(order)
    
    if err := SaveOrder(order); err != nil {
        return err
    }
    
    return SendConfirmationEmail(order)
}

// Use context as first parameter
func GetOrder(ctx context.Context, id string) (*Order, error)

// Group related parameters in structs
type CreateOrderRequest struct {
    CustomerID string `json:"customerId"`
    Items      []Item `json:"items"`
    Notes      string `json:"notes,omitempty"`
}
```

---

## Performance & Scalability

### Memory Management

**Specify Container Capacity**:
```go
// Specify slice capacity when known
items := make([]Item, 0, expectedSize)

// Specify map capacity for better performance
cache := make(map[string]*Order, expectedSize)
```

**String Building**:
```go
// Use strings.Builder for efficiency
func BuildMessage(items []string) string {
    var builder strings.Builder
    for i, item := range items {
        if i > 0 {
            builder.WriteString(", ")
        }
        builder.WriteString(item)
    }
    return builder.String()
}
```

### Concurrency Patterns

**Worker Pool Pattern**:
```go
// Controlled concurrency for resource management
func WorkerPool(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup
    
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                result := processJob(job)
                results <- result
            }
        }()
    }
    
    wg.Wait()
}
```

**Pipeline Pattern**:
```go
// Data processing pipeline
func Pipeline(input <-chan Data) <-chan ProcessedData {
    output := make(chan ProcessedData)
    
    go func() {
        defer close(output)
        for data := range input {
            processed := transform(data)
            output <- processed
        }
    }()
    
    return output
}
```

### Caching Strategies

**Multi-Layer Caching**:
```go
// Redis + in-memory caching
var CacheBufferMap sync.Map  // DDoS protection

func (s *service) GetWithCache(ctx context.Context, key string) (interface{}, error) {
    // Check in-memory cache first
    if value, found := s.memoryCache.Get(key); found {
        return value, nil
    }
    
    // Check Redis
    if value, err := s.redisClient.Get(ctx, key).Result(); err == nil {
        s.memoryCache.Set(key, value, 5*time.Minute)
        return value, nil
    }
    
    // Fallback to source
    return s.getFromSource(ctx, key)
}
```

### Circuit Breaker Pattern

**Hystrix Implementation**:
```go
// Circuit breaker configuration
func NewCircuitBreaker(name string) {
    hystrix.ConfigureCommand(name, hystrix.CommandConfig{
        Timeout:               5000,
        MaxConcurrentRequests: 100,
        ErrorPercentThreshold: 25,
    })
}

// Usage in service calls
func (s *service) ExternalCall(ctx context.Context, req Request) error {
    return hystrix.Do("external-service", func() error {
        return s.client.Call(ctx, req)
    }, nil)
}
```

### HTTP Client Optimization

**Connection Pool Configuration**:
```go
// HTTP client with connection pooling
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

---

## Security

### Authentication and Authorization

**JWT Token Validation**:
```go
// JWT token validation middleware
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, "Missing authorization header", http.StatusUnauthorized)
            return
        }
        
        if err := validateJWT(token); err != nil {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}
```

### Input Validation

**Comprehensive Request Validation**:
```go
// Validate all inputs
func (req *CreateOrderRequest) Validate() error {
    if req.CustomerID == "" {
        return errors.New("customer ID is required")
    }
    if len(req.Items) == 0 {
        return errors.New("order must contain at least one item")
    }
    for _, item := range req.Items {
        if item.Quantity <= 0 {
            return errors.New("item quantity must be positive")
        }
    }
    return nil
}
```

### Data Protection

**PII Data Handling**:
```go
// Data masking for PII
func getMaskedEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return ""
    }
    return parts[0][:2] + "********@" + parts[1]
}

// Secure hashing
func hashString(str string) string {
    hash := sha256.New()
    hash.Write([]byte(str + salt))
    return hex.EncodeToString(hash.Sum(nil))
}
```

### Security Headers

**HTTP Security Headers**:
```go
// Security headers middleware
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        next.ServeHTTP(w, r)
    })
}
```

---

## Testing

### Test Structure

**Table-Driven Tests**:
```go
func TestIsValidOrder(t *testing.T) {
    tests := []struct {
        name  string
        order Order
        want  bool
    }{
        {
            name:  "valid order",
            order: Order{ID: "123", Status: "pending"},
            want:  true,
        },
        {
            name:  "empty order ID",
            order: Order{ID: "", Status: "pending"},
            want:  false,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := isValidOrder(tt.order)
            if got != tt.want {
                t.Errorf("isValidOrder() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

### Mock Implementation

**Professional Mocking**:
```go
// Mock interface
type MockOrderRepository struct {
    orders map[string]*Order
}

func (m *MockOrderRepository) GetByID(ctx context.Context, id string) (*Order, error) {
    order, exists := m.orders[id]
    if !exists {
        return nil, ErrOrderNotFound
    }
    return order, nil
}

func (m *MockOrderRepository) Save(ctx context.Context, order *Order) error {
    m.orders[order.ID] = order
    return nil
}

// Test using mock
func TestOrderService_CreateOrder(t *testing.T) {
    mockRepo := &MockOrderRepository{orders: make(map[string]*Order)}
    service := NewOrderService(mockRepo)
    
    order, err := service.CreateOrder(ctx, createOrderRequest)
    
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if order.ID == "" {
        t.Error("expected order ID to be set")
    }
}
```

### Load Testing

**k6 Performance Testing**:
```javascript
// k6 load test configuration
export let options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<260'],
    },
};

export default function() {
    let response = http.get('http://service-url/orders');
    check(response, {
        'status is 200': (r) => r.status === 200,
    });
}
```

### Test Coverage

**Coverage Analysis**:
```bash
# Run tests with coverage
go test -coverprofile=coverage.out ./...

# View coverage report
go tool cover -html=coverage.out

# Coverage by function
go tool cover -func=coverage.out
```

---

## Patterns & Best Practices

### Middleware Pattern

**Sophisticated Middleware Composition**:
```go
// Middleware chain for common concerns
func BuildMiddleware(s Service) Service {
    s = NewLoggingMiddleware(s)
    s = NewMetricsMiddleware(s)
    s = NewAuthMiddleware(s)
    s = NewCircuitBreakerMiddleware(s)
    return s
}

// Individual middleware implementation
func NewLoggingMiddleware(next Service) Service {
    return &loggingMiddleware{next: next}
}

func (mw loggingMiddleware) ProcessOrder(ctx context.Context, req ProcessOrderRequest) (resp ProcessOrderResponse, err error) {
    defer func(begin time.Time) {
        mw.logger.Log(
            "method", "ProcessOrder",
            "orderID", req.OrderID,
            "took", time.Since(begin),
            "err", err,
        )
    }(time.Now())
    return mw.next.ProcessOrder(ctx, req)
}
```

### Repository Pattern

**Data Access Abstraction**:
```go
// Repository interface
type Repository interface {
    Create(ctx context.Context, entity *Entity) error
    GetByID(ctx context.Context, id string) (*Entity, error)
    Update(ctx context.Context, entity *Entity) error
    Delete(ctx context.Context, id string) error
}

// Implementation with database
type sqlRepository struct {
    db *sql.DB
}

func (r *sqlRepository) Create(ctx context.Context, entity *Entity) error {
    query := `INSERT INTO entities (id, name, created_at) VALUES ($1, $2, $3)`
    _, err := r.db.ExecContext(ctx, query, entity.ID, entity.Name, entity.CreatedAt)
    return err
}
```

### Options Pattern

**Flexible Configuration**:
```go
// Options function type
type Option func(*Config)

// Option functions
func WithTimeout(timeout time.Duration) Option {
    return func(c *Config) {
        c.Timeout = timeout
    }
}

func WithRetries(retries int) Option {
    return func(c *Config) {
        c.Retries = retries
    }
}

// Constructor with options
func NewService(opts ...Option) *Service {
    config := &Config{
        Timeout: 30 * time.Second,
        Retries: 3,
    }
    
    for _, opt := range opts {
        opt(config)
    }
    
    return &Service{config: config}
}

// Usage
service := NewService(
    WithTimeout(60*time.Second),
    WithRetries(5),
)
```

### Event-Driven Architecture

**Event Publishing**:
```go
// Event publisher interface
type EventPublisher interface {
    Publish(ctx context.Context, event Event) error
}

// Event publishing implementation
func (s *service) publishOrderEvent(ctx context.Context, order Order, eventType string) error {
    event := OrderEvent{
        OrderID:   order.Code,
        EventType: eventType,
        Timestamp: time.Now(),
        Data:      order,
    }
    
    return s.pubSubClient.Publish(ctx, "order-events", event)
}
```

---

## Production Readiness

### Observability

**Prometheus Metrics**:
```go
// Comprehensive metrics collection
var (
    requestCounter = kitprometheus.NewCounterFrom(stdprometheus.CounterOpts{
        Namespace: "api",
        Name:      "requests_total",
        Help:      "Total number of requests",
    }, []string{"method", "status_code"})
    
    requestLatency = kitprometheus.NewSummaryFrom(stdprometheus.SummaryOpts{
        Namespace: "api",
        Name:      "request_duration_seconds",
        Help:      "Request latency in seconds",
    }, []string{"method"})
)
```

**Structured Logging**:
```go
// Structured logging with context
func (mw loggingMiddleware) ProcessOrder(ctx context.Context, req ProcessOrderRequest) (resp ProcessOrderResponse, err error) {
    defer func(begin time.Time) {
        mw.logger.Log(
            "method", "ProcessOrder",
            "orderID", req.OrderID,
            "customerID", req.CustomerID,
            "took", time.Since(begin),
            "err", err,
        )
    }(time.Now())
    return mw.next.ProcessOrder(ctx, req)
}
```

### Health Checks

**Comprehensive Health Checks**:
```go
// Health check endpoint
func HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
    status := map[string]interface{}{
        "status":     "healthy",
        "timestamp":  time.Now(),
        "version":    version,
        "database":   checkDatabaseHealth(),
        "redis":      checkRedisHealth(),
        "kafka":      checkKafkaHealth(),
    }
    
    json.NewEncoder(w).Encode(status)
}

func checkDatabaseHealth() string {
    if err := db.Ping(); err != nil {
        return "unhealthy"
    }
    return "healthy"
}
```

### Graceful Shutdown

**Proper Shutdown Handling**:
```go
func main() {
    server := &http.Server{
        Addr:    ":8080",
        Handler: router,
    }
    
    // Start server in goroutine
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal("Server startup failed:", err)
        }
    }()
    
    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    log.Println("Shutting down server...")
    
    // Graceful shutdown with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    if err := server.Shutdown(ctx); err != nil {
        log.Fatal("Server forced to shutdown:", err)
    }
    
    log.Println("Server exiting")
}
```

### Configuration Management

**Environment-Based Configuration**:
```go
// Configuration structure
type Config struct {
    DatabaseURL string `env:"DATABASE_URL" envDefault:"localhost:5432"`
    Port        int    `env:"PORT" envDefault:"8080"`
    Debug       bool   `env:"DEBUG" envDefault:"false"`
    RedisURL    string `env:"REDIS_URL" envDefault:"localhost:6379"`
}

func LoadConfig() (*Config, error) {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, fmt.Errorf("failed to parse config: %w", err)
    }
    return cfg, nil
}
```

---

## Common Anti-Patterns

### Avoid These Patterns

**God Object**:
```go
// DON'T: Object that knows too much
type OrderManager struct {
    // Too many responsibilities
}

func (om *OrderManager) CreateOrder() {}
func (om *OrderManager) ProcessPayment() {}
func (om *OrderManager) SendEmail() {}
func (om *OrderManager) UpdateInventory() {}

// DO: Single responsibility
type OrderService struct {
    paymentSvc  PaymentService
    emailSvc    EmailService
    inventorySvc InventoryService
}
```

**Ignoring Errors**:
```go
// DON'T: Ignore errors
func BadExample() {
    processOrder(order) // Ignoring error
}

// DO: Handle errors appropriately
func GoodExample() error {
    if err := processOrder(order); err != nil {
        return fmt.Errorf("order processing failed: %w", err)
    }
    return nil
}
```

**Premature Optimization**:
```go
// DON'T: Optimize without measurement
func PrematureOptimization() {
    // Complex caching for rarely used data
    complexCache := NewComplexCache()
    // ...
}

// DO: Measure first, then optimize
func MeasureFirst() {
    // Profile, identify bottlenecks, then optimize
    result := expensiveOperation()
    // Add optimization only if needed
}
```

**Shared State**:
```go
// DON'T: Global state
var globalCounter int

func BadIncrement() {
    globalCounter++ // Race condition
}

// DO: Proper synchronization
type Counter struct {
    mu    sync.Mutex
    value int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}
```

---

## Development Workflow

### Code Quality Tools

**Required Tools**:
```bash
# Install required tools
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run before every commit
goimports -w .
golangci-lint run
govulncheck ./...
go test -race ./...
```

### CI/CD Pipeline

**Essential Pipeline Steps**:
```yaml
# Example CI configuration
test:
  script:
    - go mod download
    - go test -race -coverprofile=coverage.out ./...
    - go tool cover -func=coverage.out
    - golangci-lint run
    - govulncheck ./...

build:
  script:
    - go build -o app ./cmd/server
    - docker build -t app:latest .
```

### Performance Monitoring

**Essential Metrics**:
- Request latency (P95, P99)
- Request rate
- Error rate
- Resource utilization (CPU, memory)
- Database connection pool usage
- Cache hit/miss ratios

---

## Summary

This guide provides comprehensive patterns and practices for Go development based on analysis of production services. The key principles are:

1. **Use Go-Kit framework** for microservices with proper layering
2. **Implement clean architecture** with dependency inversion
3. **Write comprehensive tests** including load testing
4. **Use middleware patterns** for cross-cutting concerns
5. **Implement proper error handling** with context preservation
6. **Follow security best practices** with input validation and authentication
7. **Include observability** with metrics, logging, and health checks
8. **Optimize for performance** with caching and concurrency patterns
9. **Ensure production readiness** with graceful shutdown and configuration management
10. **Avoid common anti-patterns** like god objects and shared state

Services following these patterns consistently score higher in maintainability, reliability, and production readiness. Use this guide as a reference for all Go development work.