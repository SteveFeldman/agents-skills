# Go Unit Testing Best Practices

## Overview
This document provides testing guidelines for Go development based on Go's testing package and analysis of our existing codebases.

## Core Testing Principles

### 1. Testing Pyramid
Balanced testing strategy:
- **Unit Tests (70%)**: Test individual functions and methods
- **Integration Tests (20%)**: Test component interactions
- **End-to-End Tests (10%)**: Test complete workflows
- **Performance Tests**: Benchmark critical paths

### 2. Test Structure
Standard Go testing organization:
- Test files end with `_test.go`
- Test functions start with `Test`
- Benchmark functions start with `Benchmark`
- Example functions start with `Example`

### 3. Test Independence
Each test should be:
- **Isolated**: Independent of other tests
- **Repeatable**: Same result every time
- **Self-contained**: All necessary setup included
- **Deterministic**: No random behavior

## Testing Patterns from Our Codebases

### 1. Table-Driven Tests
Comprehensive test coverage pattern:

**Example from Talon One Falcon**:
```go
func TestIsEarnedPointsSubledger(t *testing.T) {
    tests := []struct {
        name      string
        subledger string
        want      bool
    }{
        {
            name:      "earned points subledger",
            subledger: "AndMorePoints",
            want:      true,
        },
        {
            name:      "non-earned points subledger",
            subledger: "SpentPoints",
            want:      false,
        },
        {
            name:      "empty subledger",
            subledger: "",
            want:      false,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := isEarnedPointsSubledger(tt.subledger)
            if got != tt.want {
                t.Errorf("isEarnedPointsSubledger() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

**Benefits**:
- Easy to add new test cases
- Clear test case documentation
- Comprehensive coverage
- Parallel test execution with `t.Run()`

### 2. Approval Testing
Snapshot testing for complex outputs:

**Example from Order History Subscriber**:
```go
func TestSummarizeOrder(t *testing.T) {
    // Load test data
    orderBytes, err := ioutil.ReadFile("testdata/order.json")
    if err != nil {
        t.Fatal(err)
    }
    
    var order UnifiedOrder
    if err := json.Unmarshal(orderBytes, &order); err != nil {
        t.Fatal(err)
    }
    
    // Execute function under test
    summary := SummarizeOrder(order)
    
    // Approval testing - compare with approved output
    approvals.VerifyJSONStruct(t, summary)
}
```

**Benefits**:
- Great for testing complex outputs
- Prevents regression
- Easy to review changes
- Works well with JSON/XML outputs

### 3. Mock-Based Testing
Isolate dependencies:

**Example from OMS Order Service**:
```go
// Mock interface
type MockRepository struct {
    orders map[string]*Order
}

func (m *MockRepository) GetOrder(ctx context.Context, id string) (*Order, error) {
    order, exists := m.orders[id]
    if !exists {
        return nil, ErrOrderNotFound
    }
    return order, nil
}

func (m *MockRepository) SaveOrder(ctx context.Context, order *Order) error {
    m.orders[order.ID] = order
    return nil
}

// Test using mock
func TestOrderService_CreateOrder(t *testing.T) {
    // Setup
    mockRepo := &MockRepository{orders: make(map[string]*Order)}
    service := NewOrderService(mockRepo)
    
    // Execute
    order, err := service.CreateOrder(ctx, createOrderRequest)
    
    // Assert
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if order.ID == "" {
        t.Error("expected order ID to be set")
    }
}
```

### 4. Integration Testing
Test with real dependencies:

**Example Pattern from Multiple Services**:
```go
// +build integration

func TestOrderServiceIntegration(t *testing.T) {
    // Setup test database
    db := setupTestDatabase(t)
    defer cleanupTestDatabase(t, db)
    
    // Create real service with test dependencies
    service := NewOrderService(db)
    
    // Test real workflow
    order, err := service.CreateOrder(ctx, validRequest)
    if err != nil {
        t.Fatalf("integration test failed: %v", err)
    }
    
    // Verify state in database
    stored, err := service.GetOrder(ctx, order.ID)
    if err != nil {
        t.Fatalf("failed to retrieve order: %v", err)
    }
    
    assert.Equal(t, order.ID, stored.ID)
}
```

## Testing Framework Patterns

### 1. Standard Testing Package
Core Go testing functionality:

**Basic Test Structure**:
```go
func TestFunction(t *testing.T) {
    // Setup
    input := "test input"
    expected := "expected output"
    
    // Execute
    result := FunctionUnderTest(input)
    
    // Assert
    if result != expected {
        t.Errorf("got %q, want %q", result, expected)
    }
}
```

**Subtests for Organization**:
```go
func TestValidation(t *testing.T) {
    t.Run("valid input", func(t *testing.T) {
        err := Validate("valid")
        if err != nil {
            t.Errorf("unexpected error: %v", err)
        }
    })
    
    t.Run("invalid input", func(t *testing.T) {
        err := Validate("")
        if err == nil {
            t.Error("expected validation error")
        }
    })
}
```

### 2. Test Helpers
Reusable testing utilities:

**Common Test Utilities**:
```go
// Test helper functions
func testutils.AssertNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
}

func testutils.AssertError(t *testing.T, err error, msg string) {
    t.Helper()
    if err == nil {
        t.Fatalf("expected error: %s", msg)
    }
}

func testutils.AssertEqual(t *testing.T, got, want interface{}) {
    t.Helper()
    if !reflect.DeepEqual(got, want) {
        t.Errorf("got %+v, want %+v", got, want)
    }
}
```

### 3. Test Setup and Teardown
Manage test resources:

**Test Main Pattern**:
```go
func TestMain(m *testing.M) {
    // Setup
    setup()
    
    // Run tests
    code := m.Run()
    
    // Teardown
    teardown()
    
    os.Exit(code)
}

func setup() {
    // Initialize test dependencies
    // Start test servers
    // Setup test databases
}

func teardown() {
    // Clean up resources
    // Stop test servers
    // Clean test databases
}
```

## Performance Testing

### 1. Benchmark Tests
Measure performance:

**Benchmark Example**:
```go
func BenchmarkStringBuilder(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var sb strings.Builder
        for j := 0; j < 1000; j++ {
            sb.WriteString("test")
        }
        _ = sb.String()
    }
}

func BenchmarkStringConcatenation(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var s string
        for j := 0; j < 1000; j++ {
            s += "test"
        }
    }
}
```

**Memory Benchmarks**:
```go
func BenchmarkFunction(b *testing.B) {
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        result := ExpensiveFunction()
        _ = result
    }
}
```

### 2. Load Testing
Test system under load:

**k6 Load Testing** (from Talon One Falcon):
```javascript
import http from 'k6/http';
import { check } from 'k6';

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
    let response = http.get('http://service-url/endpoint');
    check(response, {
        'status is 200': (r) => r.status === 200,
    });
}
```

## Test Organization

### 1. File Organization
Structure test files properly:
```
service/
├── handlers/
│   ├── order.go
│   └── order_test.go
├── services/
│   ├── order_service.go
│   └── order_service_test.go
└── testdata/
    ├── valid_order.json
    └── invalid_order.json
```

### 2. Test Data Management
Manage test data effectively:

**Test Data Files**:
```go
func loadTestData(t *testing.T, filename string) []byte {
    data, err := ioutil.ReadFile(filepath.Join("testdata", filename))
    if err != nil {
        t.Fatalf("failed to load test data: %v", err)
    }
    return data
}

func TestOrderProcessing(t *testing.T) {
    orderData := loadTestData(t, "valid_order.json")
    var order Order
    if err := json.Unmarshal(orderData, &order); err != nil {
        t.Fatalf("failed to unmarshal test data: %v", err)
    }
    
    // Test with loaded data
}
```

### 3. Test Categories
Organize tests by type:

**Build Tags for Test Types**:
```go
// +build unit

func TestUnitFunction(t *testing.T) {
    // Unit test implementation
}
```

```go
// +build integration

func TestIntegrationFlow(t *testing.T) {
    // Integration test implementation
}
```

**Running Specific Test Types**:
```bash
# Run only unit tests
go test -tags=unit ./...

# Run only integration tests
go test -tags=integration ./...

# Run all tests
go test ./...
```

## Error Testing

### 1. Error Condition Testing
Test error scenarios:

**Error Path Testing**:
```go
func TestValidateOrder_InvalidData(t *testing.T) {
    tests := []struct {
        name    string
        order   Order
        wantErr string
    }{
        {
            name:    "empty order ID",
            order:   Order{ID: ""},
            wantErr: "order ID is required",
        },
        {
            name:    "negative quantity",
            order:   Order{ID: "123", Items: []Item{{Quantity: -1}}},
            wantErr: "quantity must be positive",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateOrder(tt.order)
            if err == nil {
                t.Error("expected error, got nil")
            }
            if !strings.Contains(err.Error(), tt.wantErr) {
                t.Errorf("error %q does not contain %q", err.Error(), tt.wantErr)
            }
        })
    }
}
```

### 2. Panic Testing
Test panic conditions:

**Panic Recovery Testing**:
```go
func TestFunctionPanics(t *testing.T) {
    defer func() {
        if r := recover(); r == nil {
            t.Error("expected panic, but function did not panic")
        }
    }()
    
    FunctionThatShouldPanic()
}
```

## Mocking and Dependency Injection

### 1. Interface-Based Mocking
Design for testability:

**Mockable Dependencies**:
```go
// Define interfaces for dependencies
type Database interface {
    Get(ctx context.Context, id string) (*Entity, error)
    Save(ctx context.Context, entity *Entity) error
}

type EmailService interface {
    SendEmail(ctx context.Context, email Email) error
}

// Service with dependencies
type Service struct {
    db    Database
    email EmailService
}

// Test with mocks
func TestService_ProcessOrder(t *testing.T) {
    mockDB := &MockDatabase{}
    mockEmail := &MockEmailService{}
    
    service := &Service{
        db:    mockDB,
        email: mockEmail,
    }
    
    // Test service behavior
}
```

### 2. Dependency Injection for Testing
Constructor injection pattern:

**Testable Constructor**:
```go
// Production constructor
func NewService() *Service {
    return &Service{
        db:    NewDatabase(),
        email: NewEmailService(),
    }
}

// Test constructor
func NewServiceWithDeps(db Database, email EmailService) *Service {
    return &Service{
        db:    db,
        email: email,
    }
}
```

## Test Coverage

### 1. Coverage Analysis
Measure test coverage:

**Generate Coverage Reports**:
```bash
# Run tests with coverage
go test -coverprofile=coverage.out ./...

# View coverage report
go tool cover -html=coverage.out

# Coverage by function
go tool cover -func=coverage.out
```

### 2. Coverage Guidelines
Coverage best practices:
- **Target 80%+ coverage** for critical business logic
- **Focus on important paths** rather than 100% coverage
- **Test edge cases** and error conditions
- **Don't test trivial code** (getters/setters)

## Testing Anti-Patterns to Avoid

### 1. Common Mistakes
Avoid these testing pitfalls:

**Brittle Tests**:
```go
// DON'T: Test implementation details
func TestBadExample(t *testing.T) {
    service := NewService()
    service.internalCounter = 5  // Testing internals
    // ...
}

// DO: Test behavior
func TestGoodExample(t *testing.T) {
    service := NewService()
    result := service.ProcessData(input)
    assert.Equal(t, expected, result)
}
```

**Test Dependencies**:
```go
// DON'T: Tests that depend on each other
func TestFirstFunction(t *testing.T) {
    globalState = "modified"
}

func TestSecondFunction(t *testing.T) {
    // Depends on first test running first
    assert.Equal(t, "modified", globalState)
}
```

### 2. Over-Mocking
Avoid excessive mocking:
- **Mock external dependencies** (databases, APIs)
- **Don't mock value objects** (simple data structures)
- **Don't mock everything** (test some real interactions)

## Continuous Integration

### 1. CI Test Strategy
Automated testing in CI:

**Test Pipeline**:
```yaml
# Example CI configuration
test:
  script:
    - go test -race -coverprofile=coverage.out ./...
    - go test -tags=integration ./...
    - go tool cover -func=coverage.out
```

### 2. Test Performance
Monitor test performance:
- **Fast unit tests** (< 100ms each)
- **Parallel test execution** (`t.Parallel()`)
- **Separate slow tests** (integration, performance)

## Conclusion

Effective Go testing requires:
1. **Comprehensive Coverage**: Unit, integration, and performance tests
2. **Test Organization**: Clear structure and naming
3. **Test Independence**: Isolated, repeatable tests
4. **Mock Strategy**: Interface-based mocking for dependencies
5. **Performance Testing**: Benchmarks and load testing
6. **Continuous Integration**: Automated test execution

Our existing codebases demonstrate many good testing practices, particularly approval testing and mock-based testing. Areas for improvement include more comprehensive test coverage across all services and standardized testing utilities. The key is to write tests that provide confidence in the code while being maintainable and fast to execute.