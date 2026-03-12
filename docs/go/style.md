# Go Code Style Best Practices

## Overview
This document provides code style guidelines for Go development based on official Go documentation and analysis of our existing codebases.

## Core Style Principles

### 1. Simplicity and Readability
Go emphasizes clarity over cleverness:
- **Simple is better than complex**
- **Explicit is better than implicit**
- **Readable code is maintainable code**
- **Consistency across the codebase**

### 2. Go Idioms
Follow established Go conventions:
- **Use `gofmt`** for automatic formatting
- **Follow naming conventions**
- **Handle errors explicitly**
- **Use interfaces appropriately**

## Formatting and Structure

### 1. Automatic Formatting
Use `gofmt` to fix mechanical style issues:

**Command Line Usage**:
```bash
# Format all Go files in current directory
gofmt -w .

# Check if files are formatted
gofmt -l .

# Format and simplify code
gofmt -s -w .
```

**Editor Integration**:
- Configure editor to run `gofmt` on save
- Use `goimports` for automatic import management
- Enable `golint` for style checking

### 2. Code Organization
Structure code for readability:

**Package Organization** (from our codebases):
```go
// Package declaration with clear purpose
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

**File Organization**:
- One main concept per file
- Related functions grouped together
- Tests in separate `_test.go` files
- Exported functions before unexported

## Naming Conventions

### 1. Package Names
Keep package names concise and meaningful:

**Good Package Names**:
```go
package user     // Not package userservice
package http     // Not package httputil
package order    // Not package ordermanagement
```

**Avoid Generic Names**:
```go
// DON'T
package util
package common
package helper

// DO
package stringutil
package httputil
package mathutil
```

### 2. Function and Variable Names
Use descriptive, concise names:

**Function Naming**:
```go
// Exported functions: PascalCase
func CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error)
func GetUserByID(id string) (*User, error)

// Unexported functions: camelCase
func validateOrderItems(items []Item) error
func calculateTotalPrice(items []Item) float64
```

**Variable Naming**:
```go
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

### 3. Interface Names
Follow Go interface naming conventions:

**Single Method Interfaces**:
```go
// Use -er suffix for single method interfaces
type Reader interface {
    Read([]byte) (int, error)
}

type Writer interface {
    Write([]byte) (int, error)
}

type Closer interface {
    Close() error
}
```

**Multi-Method Interfaces**:
```go
// Descriptive names for complex interfaces
type OrderRepository interface {
    Create(ctx context.Context, order *Order) error
    GetByID(ctx context.Context, id string) (*Order, error)
    Update(ctx context.Context, order *Order) error
    Delete(ctx context.Context, id string) error
}
```

## Code Style Patterns from Our Codebases

### 1. Error Handling
Explicit and consistent error handling:

**Standard Error Handling**:
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

// Don't discard errors
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

**Custom Error Types** (from our services):
```go
// Define meaningful error types
type ValidationError struct {
    Field   string
    Message string
}

func (e ValidationError) Error() string {
    return fmt.Sprintf("validation error in %s: %s", e.Field, e.Message)
}

// Use custom errors for better error handling
func ValidateOrder(order *Order) error {
    if order.CustomerID == "" {
        return ValidationError{
            Field:   "CustomerID",
            Message: "customer ID is required",
        }
    }
    return nil
}
```

### 2. Function Design
Keep functions focused and testable:

**Single Responsibility**:
```go
// DON'T: Function does too many things
func ProcessOrderBad(order *Order) error {
    // Validate order
    if order.CustomerID == "" {
        return errors.New("invalid customer ID")
    }
    
    // Calculate price
    total := 0.0
    for _, item := range order.Items {
        total += item.Price * float64(item.Quantity)
    }
    order.Total = total
    
    // Save to database
    db.Save(order)
    
    // Send email
    sendConfirmationEmail(order)
    
    return nil
}

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
```

**Function Parameters**:
```go
// Use context as first parameter
func GetOrder(ctx context.Context, id string) (*Order, error)

// Group related parameters in structs
type CreateOrderRequest struct {
    CustomerID string `json:"customerId"`
    Items      []Item `json:"items"`
    Notes      string `json:"notes,omitempty"`
}

func CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error)
```

### 3. Struct Design
Design structs for clarity and performance:

**Struct Tags** (from our services):
```go
// Use appropriate struct tags
type Order struct {
    ID         string    `json:"id" db:"id"`
    CustomerID string    `json:"customerId" db:"customer_id"`
    Total      float64   `json:"total" db:"total"`
    CreatedAt  time.Time `json:"createdAt" db:"created_at"`
    
    // Use pointer for optional fields
    Notes      *string   `json:"notes,omitempty" db:"notes"`
    DeliveryAt *time.Time `json:"deliveryAt,omitempty" db:"delivery_at"`
}
```

**Struct Composition**:
```go
// Use embedding for common fields
type BaseEntity struct {
    ID        string    `json:"id" db:"id"`
    CreatedAt time.Time `json:"createdAt" db:"created_at"`
    UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type Order struct {
    BaseEntity
    CustomerID string  `json:"customerId" db:"customer_id"`
    Total      float64 `json:"total" db:"total"`
}
```

## Interface Design

### 1. Interface Placement
Define interfaces where they're used:

**Consumer-Defined Interfaces**:
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

### 2. Small Interfaces
Keep interfaces focused:

```go
// DON'T: Large interface
type OrderManager interface {
    CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error)
    GetOrder(ctx context.Context, id string) (*Order, error)
    UpdateOrder(ctx context.Context, order *Order) error
    DeleteOrder(ctx context.Context, id string) error
    CalculateShipping(order *Order) float64
    ValidateInventory(items []Item) error
    SendNotification(order *Order) error
}

// DO: Focused interfaces
type OrderRepository interface {
    GetByID(ctx context.Context, id string) (*Order, error)
    Save(ctx context.Context, order *Order) error
    Delete(ctx context.Context, id string) error
}

type OrderValidator interface {
    ValidateOrder(order *Order) error
}

type NotificationSender interface {
    SendOrderConfirmation(order *Order) error
}
```

## Comments and Documentation

### 1. Package Documentation
Document package purpose:

```go
// Package orderservice provides order management functionality.
//
// The service handles order creation, modification, and retrieval
// for the e-commerce platform. It integrates with inventory,
// payment, and notification services.
package orderservice
```

### 2. Function Comments
Document exported functions:

```go
// CreateOrder creates a new order for the specified customer.
// It validates the order data, calculates totals, and saves
// the order to the database. Returns the created order with
// generated ID and timestamps.
func CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error) {
    // Implementation
}
```

### 3. Comment Style
Write clear, concise comments:

**Good Comments**:
```go
// Calculate shipping cost based on weight and distance
func CalculateShipping(weight float64, distance int) float64 {
    // Base rate is $5 per 100 miles
    baseRate := float64(distance) / 100 * 5.0
    
    // Add weight surcharge for packages over 10 lbs
    if weight > 10 {
        baseRate += (weight - 10) * 0.5
    }
    
    return baseRate
}
```

**Avoid Obvious Comments**:
```go
// DON'T: State the obvious
func GetUserID() string {
    return u.ID // Returns the user ID
}

// DO: Explain the why, not the what
func GetUserID() string {
    // Return user ID for authorization checks
    return u.ID
}
```

## Testing Style

### 1. Test Function Names
Use descriptive test names:

```go
// Describe what is being tested
func TestCreateOrder_ValidInput_ReturnsOrder(t *testing.T)
func TestCreateOrder_EmptyCustomerID_ReturnsError(t *testing.T)
func TestCalculateShipping_LightPackage_ReturnsBaseRate(t *testing.T)
```

### 2. Test Structure
Organize tests clearly:

```go
func TestCreateOrder_ValidInput_ReturnsOrder(t *testing.T) {
    // Arrange
    req := CreateOrderRequest{
        CustomerID: "customer-123",
        Items: []Item{
            {ID: "item-1", Quantity: 2, Price: 10.0},
        },
    }
    
    // Act
    order, err := CreateOrder(context.Background(), req)
    
    // Assert
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    
    if order.CustomerID != req.CustomerID {
        t.Errorf("got customer ID %q, want %q", order.CustomerID, req.CustomerID)
    }
}
```

## Performance Considerations

### 1. String Building
Use appropriate string building methods:

```go
// DON'T: Inefficient string concatenation
func BuildMessage(items []string) string {
    var message string
    for _, item := range items {
        message += item + ", "
    }
    return message
}

// DO: Use strings.Builder for efficiency
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

### 2. Slice and Map Initialization
Specify capacity when possible:

```go
// Specify slice capacity when known
items := make([]Item, 0, expectedSize)

// Specify map capacity for better performance
cache := make(map[string]*Order, expectedSize)
```

## Code Style Anti-Patterns

### 1. Overly Complex Code
Avoid unnecessary complexity:

```go
// DON'T: Overly complex one-liner
return customers[customerID] != nil && customers[customerID].Status == "active" && len(customers[customerID].Orders) > 0

// DO: Break down for clarity
customer := customers[customerID]
if customer == nil {
    return false
}

return customer.Status == "active" && len(customer.Orders) > 0
```

### 2. Inconsistent Naming
Maintain naming consistency:

```go
// DON'T: Inconsistent naming
func GetUser(id string) (*User, error)
func FetchOrder(orderID string) (*Order, error)  // Should be GetOrder
func RetrieveProduct(id string) (*Product, error) // Should be GetProduct

// DO: Consistent naming
func GetUser(id string) (*User, error)
func GetOrder(id string) (*Order, error)
func GetProduct(id string) (*Product, error)
```

### 3. Unnecessary Abstractions
Don't over-engineer:

```go
// DON'T: Unnecessary abstraction for simple operations
type StringProcessor interface {
    Process(string) string
}

type UpperCaseProcessor struct{}
func (p UpperCaseProcessor) Process(s string) string {
    return strings.ToUpper(s)
}

// DO: Use simple functions for simple operations
func ToUpper(s string) string {
    return strings.ToUpper(s)
}
```

## Configuration and Environment

### 1. Configuration Management
Handle configuration cleanly:

**Environment Variables**:
```go
// Use environment variables for configuration
type Config struct {
    DatabaseURL string `env:"DATABASE_URL" envDefault:"localhost:5432"`
    Port        int    `env:"PORT" envDefault:"8080"`
    Debug       bool   `env:"DEBUG" envDefault:"false"`
}

func LoadConfig() (*Config, error) {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, err
    }
    return cfg, nil
}
```

### 2. Constants and Defaults
Define constants for magic numbers:

```go
// Define meaningful constants
const (
    DefaultTimeout = 30 * time.Second
    MaxRetries     = 3
    DefaultPort    = 8080
)

// Use constants instead of magic numbers
ctx, cancel := context.WithTimeout(context.Background(), DefaultTimeout)
defer cancel()
```

## Conclusion

Effective Go style requires:
1. **Consistency**: Use `gofmt` and follow conventions
2. **Simplicity**: Write clear, readable code
3. **Naming**: Use descriptive, concise names
4. **Error Handling**: Handle errors explicitly
5. **Interfaces**: Design small, focused interfaces
6. **Documentation**: Comment exported functions and packages
7. **Testing**: Write clear, comprehensive tests

Our existing codebases demonstrate many of these style practices effectively, particularly in error handling, interface design, and function organization. Areas for improvement include more consistent naming conventions across services and enhanced code documentation. The key is to write code that is not only functional but also maintainable and readable by the entire team.