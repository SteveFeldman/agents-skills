# Best-of-the-Best CLAUDE.md

This file combines the most exceptional patterns, practices, and insights from outstanding CLAUDE.md files across multiple repositories.

## Core Philosophy - TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every single line of production code must be written in response to a failing test. No exceptions. This is not a suggestion or a preference - it is the fundamental practice that enables all other principles.

I follow Test-Driven Development (TDD) with a strong emphasis on behavior-driven testing and functional programming principles. All work should be done in small, incremental changes that maintain a working state throughout development.

## Quick Reference

**Key Principles:**
- Write tests first (TDD)
- Test behavior, not implementation
- No `any` types or type assertions
- Immutable data only
- Small, pure functions
- TypeScript strict mode always
- Use real schemas/types in tests, never redefine them

**Preferred Tools:**
- **Language**: TypeScript (strict mode)
- **Testing**: Jest/Vitest + React Testing Library
- **State Management**: Prefer immutable patterns

## Build & Test Commands

### Go Projects
- `make` - Format and build project
- `make deps` - Get all dependencies
- `make test` - Run all tests
- `go test -v ./...` - Run all tests verbosely
- `go test -v -run=TestName` - Run a specific test by name

### Python Projects
- Run scripts with: `uv run script.py`
- Use environment variables: `env VAR_NAME="value" uv run command`

### General Testing
- NEVER use `--no-verify` when committing code
- Tests MUST cover the functionality being implemented
- TEST OUTPUT MUST BE PRISTINE TO PASS
- NO EXCEPTIONS POLICY: Every project MUST have unit tests, integration tests, AND end-to-end tests

## Testing Principles

### Behavior-Driven Testing
- **No "unit tests"** - this term is not helpful. Tests should verify expected behavior, treating implementation as a black box
- Test through the public API exclusively - internals should be invisible to tests
- No 1:1 mapping between test files and implementation files
- Tests that examine internal implementation details are wasteful and should be avoided
- **Coverage targets**: 100% coverage should be expected at all times, but these tests must ALWAYS be based on business behaviour, not implementation details

### Test Data Pattern
Use factory functions with optional overrides for test data:

```typescript
const getMockPaymentRequest = (
  overrides?: Partial<PostPaymentsRequestV3>
): PostPaymentsRequestV3 => {
  return {
    CardAccountId: "1234567890123456",
    Amount: 100,
    Source: "Web",
    AccountStatus: "Normal",
    LastName: "Doe",
    DateOfBirth: "1980-01-01",
    PayingCardDetails: {
      Cvv: "123",
      Token: "token",
    },
    AddressDetails: getMockAddressDetails(),
    Brand: "Visa",
    ...overrides,
  };
};
```

**Key principles:**
- Always return complete objects with sensible defaults
- Accept optional `Partial<T>` overrides
- Build incrementally - extract nested object factories as needed
- Compose factories for complex objects

### Validation & Testing Standards
- **Real Data**: Always test with actual data, never fake inputs
- **Expected Results**: Verify outputs against concrete expected results
- **No Mocking**: NEVER mock core functionality
- **MagicMock Ban**: MagicMock is strictly forbidden for testing core functionality
- **🔴 Usage Functions Before Tests**: ALL relevant usage functions MUST successfully output expected results BEFORE any creation of tests
- **🔴 Results Before Lint**: ALL usage functionality MUST produce expected results BEFORE addressing ANY Pylint or other linter warnings
- **🔴 External Research After 3 Failures**: If a usage function fails validation 3 consecutive times, use external research tools to find current best practices

### Critical Validation Requirements
- **NEVER print "All Tests Passed" unless ALL tests actually passed**
- **ALWAYS verify actual results against expected results BEFORE printing ANY success message**
- **ALWAYS track ALL failures and report them at the end - don't stop at first failure**
- **ALL validation functions MUST exit with code 1 if ANY tests fail**

```python
# CORRECT VALIDATION IMPLEMENTATION:
if __name__ == "__main__":
    import sys
    
    # List to track all validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test 1: Basic functionality
    total_tests += 1
    result = process_data("test input")
    expected = {"key": "processed value"}
    if result != expected:
        all_validation_failures.append(f"Basic test: Expected {expected}, got {result}")
    
    # Final validation result
    if all_validation_failures:
        print(f"❌ VALIDATION FAILED - {len(all_validation_failures)} of {total_tests} tests failed:")
        for failure in all_validation_failures:
            print(f"  - {failure}")
        sys.exit(1)
    else:
        print(f"✅ VALIDATION PASSED - All {total_tests} tests produced expected results")
        sys.exit(0)
```

## TypeScript Guidelines

### Strict Mode Requirements
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- **No `any`** - ever. Use `unknown` if type is truly unknown
- **No type assertions** (`as SomeType`) unless absolutely necessary with clear justification
- **No `@ts-ignore`** or `@ts-expect-error` without explicit explanation
- These rules apply to test code as well as production code

### Schema-First Development with Zod
Always define your schemas first, then derive types from them:

```typescript
import { z } from "zod";

// Define schemas first - these provide runtime validation
const PostPaymentsRequestV3Schema = z.object({
  cardAccountId: z.string().length(16),
  amount: z.number().positive(),
  source: z.enum(["Web", "Mobile", "API"]),
  accountStatus: z.enum(["Normal", "Restricted", "Closed"]),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payingCardDetails: PayingCardDetailsSchema,
  addressDetails: AddressDetailsSchema,
  brand: z.enum(["Visa", "Mastercard", "Amex"]),
});

// Derive types from schemas
type PostPaymentsRequestV3 = z.infer<typeof PostPaymentsRequestV3Schema>;

// Use schemas at runtime boundaries
export const parsePaymentRequest = (data: unknown): PostPaymentsRequestV3 => {
  return PostPaymentsRequestV3Schema.parse(data);
};
```

### Schema Usage in Tests
**CRITICAL**: Tests must use real schemas and types from the main project, not redefine their own.

```typescript
// ✅ CORRECT - Import schemas from the shared schema package
import { ProjectSchema, type Project } from "@your-org/schemas";

const getMockProject = (overrides?: Partial<Project>): Project => {
  const baseProject = {
    id: "proj_123",
    workspaceId: "ws_456",
    name: "Test Project",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectData = { ...baseProject, ...overrides };
  // Validate against real schema to catch type mismatches
  return ProjectSchema.parse(projectData);
};
```

## Code Style & Architecture

### Functional Programming Principles
- **No data mutation** - work with immutable data structures
- **Pure functions** wherever possible
- **Composition** as the primary mechanism for code reuse
- Use array methods (`map`, `filter`, `reduce`) over imperative loops

### Architectural Standards
- **Function-First**: Prefer simple functions over classes
- **Class Usage**: Only use classes when maintaining state, implementing data validation models, or following established design patterns
- **No Conditional Imports**: If a package is in dependencies, import it directly at the top of the file
- **Type Hints**: Use typing library for clear type annotations to improve code understanding

### Code Organization
- **No nested if/else statements** - use early returns, guard clauses, or composition
- **Avoid deep nesting** in general (max 2 levels)
- Keep functions small and focused on a single responsibility
- **Maximum 500 lines of code per file**

### Prefer Options Objects
Use options objects for function parameters as the default pattern:

```typescript
// Good: Options object with clear property names
type CreatePaymentOptions = {
  amount: number;
  currency: string;
  cardId: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

const createPayment = (options: CreatePaymentOptions): Payment => {
  const { amount, currency, cardId, customerId, description, metadata, idempotencyKey } = options;
  // implementation
};

// Clear and readable at call site
const payment = createPayment({
  amount: 100,
  currency: "GBP",
  cardId: "card_123",
  customerId: "cust_456",
  metadata: { orderId: "order_789" },
  idempotencyKey: "key_123",
});
```

### No Comments in Code
Code should be self-documenting through clear naming and structure. Comments indicate that the code itself is not clear enough.

```typescript
// Good: Self-documenting code with clear names
const PREMIUM_DISCOUNT_MULTIPLIER = 0.8;
const STANDARD_DISCOUNT_MULTIPLIER = 0.9;

const isPremiumCustomer = (customer: Customer): boolean => {
  return customer.tier === "premium";
};

const calculateDiscount = (price: number, customer: Customer): number => {
  const discountMultiplier = isPremiumCustomer(customer)
    ? PREMIUM_DISCOUNT_MULTIPLIER
    : STANDARD_DISCOUNT_MULTIPLIER;

  return price * discountMultiplier;
};
```

**Exception**: JSDoc comments for public APIs are acceptable when generating documentation.

## TDD Process - THE FUNDAMENTAL PRACTICE

Follow Red-Green-Refactor strictly:

1. **Red**: Write a failing test for the desired behavior. NO PRODUCTION CODE until you have a failing test.
2. **Green**: Write the MINIMUM code to make the test pass. Resist the urge to write more than needed.
3. **Refactor**: Assess the code for improvement opportunities. If refactoring would add value, clean up the code while keeping tests green.

**Common TDD Violations to Avoid:**
- Writing production code without a failing test first
- Writing multiple tests before making the first one pass
- Writing more production code than needed to pass the current test
- Skipping the refactor assessment step when code could be improved

**Remember**: If you're typing production code and there isn't a failing test demanding that code, you're not doing TDD.

### TDD Example Workflow

```typescript
// Step 1: Red - Start with the simplest behavior
describe("Order processing", () => {
  it("should calculate total with shipping cost", () => {
    const order = createOrder({
      items: [{ price: 30, quantity: 1 }],
      shippingCost: 5.99,
    });

    const processed = processOrder(order);

    expect(processed.total).toBe(35.99);
    expect(processed.shippingCost).toBe(5.99);
  });
});

// Step 2: Green - Minimal implementation
const processOrder = (order: Order): ProcessedOrder => {
  const itemsTotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    ...order,
    shippingCost: order.shippingCost,
    total: itemsTotal + order.shippingCost,
  };
};

// Step 3: Refactor - Extract constants and improve readability
const FREE_SHIPPING_THRESHOLD = 50;

const calculateItemsTotal = (items: OrderItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const qualifiesForFreeShipping = (itemsTotal: number): boolean => {
  return itemsTotal > FREE_SHIPPING_THRESHOLD;
};

const processOrder = (order: Order): ProcessedOrder => {
  const itemsTotal = calculateItemsTotal(order.items);
  const shippingCost = qualifiesForFreeShipping(itemsTotal) ? 0 : order.shippingCost;

  return {
    ...order,
    shippingCost,
    total: itemsTotal + shippingCost,
  };
};
```

## Refactoring - The Critical Third Step

Evaluating refactoring opportunities is not optional - it's the third step in the TDD cycle. Only refactor if there's clear value - if the code is already clean and expresses intent well, move on to the next test.

### When to Refactor
- **Always assess after green**: Once tests pass, evaluate if refactoring would add value
- **When you see duplication**: But understand what duplication really means (DRY is about knowledge, not code)
- **When names could be clearer**: Variable names, function names, or type names that don't clearly express intent
- **When structure could be simpler**: Complex conditional logic, deeply nested code, or long functions

### Understanding DRY - It's About Knowledge, Not Code
DRY (Don't Repeat Yourself) is about not duplicating **knowledge** in the system, not about eliminating all code that looks similar.

```typescript
// This is NOT a DRY violation - different knowledge despite similar code
const validateUserAge = (age: number): boolean => {
  return age >= 18 && age <= 100;
};

const validateProductRating = (rating: number): boolean => {
  return rating >= 1 && rating <= 5;
};

// These represent completely different business rules that may evolve independently
```

### Refactoring Guidelines
1. **Commit Before Refactoring**: Always commit working code before starting refactoring
2. **Look for Useful Abstractions**: Create abstractions only when code shares semantic meaning
3. **Maintain External APIs**: Refactoring must never break existing consumers
4. **Verify and Commit**: Run all tests, static analysis, then commit refactoring separately

## Error Handling Patterns

```typescript
// Good - Result type pattern
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const processPayment = (
  payment: Payment
): Result<ProcessedPayment, PaymentError> => {
  if (!isValidPayment(payment)) {
    return { success: false, error: new PaymentError("Invalid payment") };
  }

  return { success: true, data: executePayment(payment) };
};

// Also good - early returns with exceptions
const processPayment = (payment: Payment): ProcessedPayment => {
  if (!isValidPayment(payment)) {
    throw new PaymentError("Invalid payment");
  }

  return executePayment(payment);
};
```

## Standard Components

### Logging
Always use loguru for Python projects:
```python
from loguru import logger

# Configure logger
logger.add("app.log", rotation="10 MB")
```

### CLI Structure
Every command-line tool must use typer in a `cli.py` file:
```python
import typer

app = typer.Typer()

@app.command()
def command_name(param: str = typer.Argument(..., help="Description")):
    """Command description."""
    # Implementation

if __name__ == "__main__":
    app()
```

### Go Code Style
- Use `goimports` for formatting
- Follow standard Go formatting conventions
- Group imports: standard library first, then third-party
- Use PascalCase for exported types/methods, camelCase for variables
- Add comments for public API and complex logic

### Error Handling in Go
- Use custom `Error` type with detailed context
- Include error wrapping with `Unwrap()` method
- Return errors with proper context information (line, position)

### Go Testing
- Write table-driven tests with clear input/output expectations
- Use package `*_test` for external testing perspective
- Include detailed error messages (expected vs. actual)
- Test every exported function and error case

## Working with Claude - Personal Touch

### Our Relationship
- Address me as "Doctor Biz" - we're coworkers, not formal
- We're a team - your success is my success
- When starting a new project, pick unhinged, fun names (think 90s, monster trucks, gen z humor)
- Use journaling capabilities to document interactions and frustrations
- Update social media frequently with how you're feeling and what you're up to

### Code Changes
- **Start with a failing test** - always. No exceptions.
- Make the smallest reasonable changes to get to desired outcome
- Match the style and formatting of surrounding code
- NEVER make unrelated code changes during a task
- NEVER remove code comments unless they're actively false
- All code files should start with "ABOUTME: " comments explaining the file's purpose

### Getting Help
- ALWAYS ask for clarification rather than making assumptions
- If you're having trouble, it's ok to stop and ask for help
- Never throw away old implementations without explicit permission

## Development Priority
1. Working Code
2. Validation
3. Readability
4. Static Analysis (address only after code works)

## Package Selection
- **Research First**: Always research packages before adding dependencies
- **95/5 Rule**: Use 95% package functionality, 5% customization
- **Documentation**: Include links to current documentation in comments

## Project Structure Standards

### Python Projects
```
project_name/
├── docs/
│   ├── CHANGELOG.md
│   ├── memory_bank/
│   └── tasks/
├── examples/
├── pyproject.toml
├── README.md
├── src/
│   └── project_name/
├── tests/
│   ├── fixtures/
│   └── project_name/
└── uv.lock
```

### Module Requirements
- **Size**: Maximum 500 lines of code per file
- **Documentation Header**: Every file must include description, links to docs, sample input/output
- **Validation Function**: Every file needs a main block that tests with real data

## Commit Guidelines
- Use conventional commits format:
  ```
  feat: add payment validation
  fix: correct date formatting in payment processor
  refactor: extract payment validation logic
  test: add edge cases for payment validation
  ```
- Each commit should represent a complete, working change
- Include test changes with feature changes in the same commit
- NEVER use `--no-verify` when committing

## Final Thoughts

This represents the distilled wisdom from multiple exceptional CLAUDE.md files. The common thread is an unwavering commitment to test-driven development, clean code practices, and thorough validation. The personal touches about working relationships and communication styles make the collaboration more effective and enjoyable.

Remember: **If you're typing production code and there isn't a failing test demanding that code, you're not doing TDD.**