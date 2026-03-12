# Go Design Patterns Best Practices

## Overview
This document provides design pattern guidelines for Go development based on analysis of established patterns and our existing codebases.

## Core Design Pattern Categories

### 1. Creational Patterns
Patterns for object creation:
- **Factory Method**: Create objects without specifying exact classes
- **Builder**: Construct complex objects step by step
- **Singleton**: Ensure a class has only one instance
- **Prototype**: Create objects by cloning existing instances

### 2. Structural Patterns
Patterns for object composition:
- **Adapter**: Allow incompatible interfaces to work together
- **Decorator**: Add behavior to objects dynamically
- **Facade**: Provide simplified interface to complex subsystem
- **Proxy**: Provide placeholder/surrogate for another object

### 3. Behavioral Patterns
Patterns for object interaction:
- **Observer**: Define one-to-many dependency between objects
- **Strategy**: Define family of algorithms and make them interchangeable
- **Command**: Encapsulate requests as objects
- **Template Method**: Define algorithm skeleton in base class

## Patterns from Our Codebases

### 1. Middleware Pattern
Cross-cutting concerns implementation:

**Chain of Responsibility** (All Services):
```go
// Middleware chain pattern
func BuildMiddleware(service Service) Service {
    service = NewLoggingMiddleware(service)
    service = NewMetricsMiddleware(service)
    service = NewAuthMiddleware(service)
    return service
}

// Individual middleware
func NewLoggingMiddleware(next Service) Service {
    return &loggingMiddleware{next: next}
}
```

**Decorator Pattern** (Account, Cart Services):
- Adds logging, metrics, and authentication
- Composable middleware stack
- Non-intrusive enhancement

### 2. Repository Pattern
Data access abstraction:

**Repository Interface** (OMS-Order-Service):
```go
type Repository interface {
    Create(ctx context.Context, entity *Entity) error
    GetByID(ctx context.Context, id string) (*Entity, error)
    Update(ctx context.Context, entity *Entity) error
    Delete(ctx context.Context, id string) error
}

// Concrete implementation
type sqlRepository struct {
    db *sql.DB
}

func (r *sqlRepository) Create(ctx context.Context, entity *Entity) error {
    // Database-specific implementation
}
```

### 3. Service Layer Pattern
Business logic encapsulation:

**Service Interface Pattern** (All Services):
```go
// Service interface defines business operations
type Service interface {
    ProcessOrder(ctx context.Context, req ProcessOrderRequest) (*ProcessOrderResponse, error)
    GetOrder(ctx context.Context, id string) (*Order, error)
}

// Implementation with dependencies
type orderService struct {
    repo   Repository
    cache  Cache
    logger Logger
}
```

### 4. Circuit Breaker Pattern
Fault tolerance implementation:

**Circuit Breaker** (Hystrix in Multiple Services):
```go
// Circuit breaker configuration
func NewCircuitBreaker(name string) {
    hystrix.ConfigureCommand(name, hystrix.CommandConfig{
        Timeout:               10000,
        MaxConcurrentRequests: 100,
        ErrorPercentThreshold: 25,
    })
}

// Usage in service calls
func (s *service) ExternalCall() error {
    return hystrix.Do("external-service", func() error {
        return s.client.Call()
    }, nil)
}
```

## Concurrency Patterns

### 1. Worker Pool Pattern
Controlled concurrency:

**Bounded Parallelism** (Loyalty-Update-Consumer):
```go
// Worker pool implementation
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

### 2. Pipeline Pattern
Data processing pipeline:

**Producer-Consumer** (Order-History-Subscriber):
```go
// Pipeline stages
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

### 3. Fan-Out/Fan-In Pattern
Parallel processing with aggregation:

**Concurrent Processing** (Rich Relevance):
```go
// Fan-out: distribute work
func FanOut(input <-chan Work, numWorkers int) []<-chan Result {
    outputs := make([]<-chan Result, numWorkers)
    
    for i := 0; i < numWorkers; i++ {
        output := make(chan Result)
        outputs[i] = output
        
        go func() {
            defer close(output)
            for work := range input {
                result := process(work)
                output <- result
            }
        }()
    }
    
    return outputs
}

// Fan-in: combine results
func FanIn(inputs []<-chan Result) <-chan Result {
    output := make(chan Result)
    var wg sync.WaitGroup
    
    for _, input := range inputs {
        wg.Add(1)
        go func(ch <-chan Result) {
            defer wg.Done()
            for result := range ch {
                output <- result
            }
        }(input)
    }
    
    go func() {
        wg.Wait()
        close(output)
    }()
    
    return output
}
```

## Messaging Patterns

### 1. Publisher-Subscriber Pattern
Event-driven communication:

**Event Publishing** (Cart Service):
```go
// Event publisher
type EventPublisher interface {
    Publish(ctx context.Context, event Event) error
}

// Event subscriber
type EventSubscriber interface {
    Subscribe(topic string, handler EventHandler) error
}

// Event handler
type EventHandler func(event Event) error
```

### 2. Message Queue Pattern
Asynchronous message processing:

**Kafka Integration** (Multiple Services):
```go
// Message producer
type MessageProducer interface {
    Send(ctx context.Context, message Message) error
}

// Message consumer
type MessageConsumer interface {
    Consume(ctx context.Context, handler MessageHandler) error
}

// Message handler
type MessageHandler func(message Message) error
```

## Error Handling Patterns

### 1. Error Wrapping Pattern
Contextual error information:

**Custom Error Types** (All Services):
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

// Error wrapping
func WrapError(err error, message string) error {
    return &ServiceError{
        Code:    500,
        Message: message,
        Cause:   err,
    }
}
```

### 2. Result Pattern
Explicit success/failure handling:

**Result Type** (Common Pattern):
```go
// Result type for explicit error handling
type Result[T any] struct {
    Value T
    Error error
}

func (r Result[T]) IsSuccess() bool {
    return r.Error == nil
}

func (r Result[T]) IsFailure() bool {
    return r.Error != nil
}

// Usage
func ProcessData(data Data) Result[ProcessedData] {
    if err := validate(data); err != nil {
        return Result[ProcessedData]{Error: err}
    }
    
    processed := transform(data)
    return Result[ProcessedData]{Value: processed}
}
```

## Configuration Patterns

### 1. Options Pattern
Flexible configuration:

**Functional Options** (Service Configuration):
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

### 2. Builder Pattern
Complex object construction:

**Service Builder** (Configuration Pattern):
```go
// Service builder
type ServiceBuilder struct {
    config Config
}

func NewServiceBuilder() *ServiceBuilder {
    return &ServiceBuilder{
        config: DefaultConfig(),
    }
}

func (b *ServiceBuilder) WithDatabase(db Database) *ServiceBuilder {
    b.config.Database = db
    return b
}

func (b *ServiceBuilder) WithCache(cache Cache) *ServiceBuilder {
    b.config.Cache = cache
    return b
}

func (b *ServiceBuilder) Build() *Service {
    return &Service{config: b.config}
}

// Usage
service := NewServiceBuilder().
    WithDatabase(db).
    WithCache(cache).
    Build()
```

## Testing Patterns

### 1. Mock Pattern
Test isolation:

**Interface Mocking** (Testing Infrastructure):
```go
// Mockable interface
type Database interface {
    Get(ctx context.Context, id string) (*Entity, error)
    Save(ctx context.Context, entity *Entity) error
}

// Mock implementation
type MockDatabase struct {
    entities map[string]*Entity
}

func (m *MockDatabase) Get(ctx context.Context, id string) (*Entity, error) {
    entity, exists := m.entities[id]
    if !exists {
        return nil, ErrNotFound
    }
    return entity, nil
}

func (m *MockDatabase) Save(ctx context.Context, entity *Entity) error {
    m.entities[entity.ID] = entity
    return nil
}
```

### 2. Test Builder Pattern
Test data construction:

**Test Data Builders** (Testing Utilities):
```go
// Test builder for complex objects
type OrderBuilder struct {
    order *Order
}

func NewOrderBuilder() *OrderBuilder {
    return &OrderBuilder{
        order: &Order{
            ID:     "default-id",
            Status: "pending",
            Items:  []Item{},
        },
    }
}

func (b *OrderBuilder) WithID(id string) *OrderBuilder {
    b.order.ID = id
    return b
}

func (b *OrderBuilder) WithStatus(status string) *OrderBuilder {
    b.order.Status = status
    return b
}

func (b *OrderBuilder) WithItems(items ...Item) *OrderBuilder {
    b.order.Items = items
    return b
}

func (b *OrderBuilder) Build() *Order {
    return b.order
}

// Usage in tests
order := NewOrderBuilder().
    WithID("test-order-1").
    WithStatus("completed").
    WithItems(
        Item{ID: "item-1", Quantity: 2},
        Item{ID: "item-2", Quantity: 1},
    ).
    Build()
```

## Synchronization Patterns

### 1. Mutex Pattern
Shared resource protection:

**Concurrent Access Control**:
```go
// Thread-safe cache
type SafeCache struct {
    mu    sync.RWMutex
    cache map[string]interface{}
}

func (c *SafeCache) Get(key string) (interface{}, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    value, exists := c.cache[key]
    return value, exists
}

func (c *SafeCache) Set(key string, value interface{}) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.cache[key] = value
}
```

### 2. Channel Pattern
Communication and coordination:

**Channel-Based Communication**:
```go
// Worker coordination
type WorkerPool struct {
    workers int
    jobs    chan Job
    results chan Result
}

func NewWorkerPool(workers int) *WorkerPool {
    return &WorkerPool{
        workers: workers,
        jobs:    make(chan Job, workers),
        results: make(chan Result, workers),
    }
}

func (p *WorkerPool) Start() {
    for i := 0; i < p.workers; i++ {
        go p.worker()
    }
}

func (p *WorkerPool) worker() {
    for job := range p.jobs {
        result := job.Process()
        p.results <- result
    }
}
```

## Anti-Patterns to Avoid

### 1. God Object
Avoid objects that know too much:
- **Single Responsibility**: Each object has one reason to change
- **Interface Segregation**: Many specific interfaces over one general
- **Dependency Inversion**: Depend on abstractions, not concretions

### 2. Anemic Domain Model
Avoid data-only objects:
- **Rich Domain Models**: Behavior with data
- **Encapsulation**: Hide internal state
- **Domain Logic**: Business rules in domain objects

### 3. Cargo Cult Programming
Avoid copying patterns without understanding:
- **Understand the Problem**: Know why you need a pattern
- **Consider Alternatives**: Patterns are tools, not rules
- **Simplicity First**: Use simplest solution that works

## Pattern Selection Guidelines

### 1. When to Use Patterns
- **Recurring Problems**: Solve common design problems
- **Proven Solutions**: Use battle-tested approaches
- **Communication**: Patterns provide common vocabulary

### 2. When Not to Use Patterns
- **Over-Engineering**: Don't add complexity unnecessarily
- **Premature Optimization**: Solve actual problems, not potential ones
- **Cargo Cult**: Don't use patterns without understanding

### 3. Pattern Evaluation
- **Problem Fit**: Does the pattern solve your specific problem?
- **Complexity Trade-off**: Is the added complexity worth it?
- **Maintainability**: Does it make code easier to understand?

## Conclusion

Effective use of design patterns in Go requires:
1. **Understanding**: Know why patterns exist
2. **Appropriateness**: Use patterns that fit the problem
3. **Simplicity**: Prefer simple solutions over complex patterns
4. **Consistency**: Use patterns consistently across codebase
5. **Evolution**: Refactor to patterns as needs evolve

Our existing codebases demonstrate many of these patterns effectively, particularly middleware, repository, and service patterns. The key is to use patterns as tools for solving specific problems, not as ends in themselves.