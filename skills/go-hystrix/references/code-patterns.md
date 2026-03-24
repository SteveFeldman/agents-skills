# Code Patterns

## What To Look For

- [ ] All hystrix execution sites use a consistent pattern (either all `hystrix.Go()` with channel+select, or a documented reason for `hystrix.Do()`)
- [ ] The channel+select boilerplate is identical across all methods in a service
- [ ] Output channels use buffer size 1
- [ ] The `select` statement has consistent structure (output case first, then error case)
- [ ] The final return after the `select` block is consistent
- [ ] Configuration is centralized (typically in `main.go`), not scattered across service files
- [ ] No duplicate command configurations exist

## Broken Patterns

### Mixed execution styles without justification

```go
// File A uses hystrix.Go
errs := hystrix.Go("GetData", func() error { ... }, nil)

// File B uses hystrix.Do for the same kind of operation
err := hystrix.Do("PostData", func() error { ... }, nil)
```

### Inconsistent boilerplate

```go
// Method A: standard pattern
output := make(chan bool, 1)
errs := hystrix.Go("GetItems", func() error {
    // ...
    output <- true
    return nil
}, nil)
select {
case out := <-output:
    if out { return response, serviceError }
case err := <-errs:
    return response, err
}
return response, serviceError

// Method B: different structure for the same pattern
done := make(chan struct{})  // Different channel type
errors := hystrix.Go("GetDetails", func() error {
    // ...
    close(done)  // Different signaling mechanism
    return nil
}, nil)
select {
case <-done:
    return response, serviceError
case err := <-errors:
    return response, err
}
```

### Configuration scattered across files

```go
// main.go
hystrix.ConfigureCommand("GetItems", hystrix.CommandConfig{...})

// service/items.go — additional config buried in service code
func init() {
    hystrix.ConfigureCommand("GetItemDetails", hystrix.CommandConfig{...})
}
```

## Correct Patterns

### Canonical hystrix.Go boilerplate

This is the established team pattern. All methods should follow this structure:

```go
func (p myService) getData(ctx context.Context, req GetDataRequest) (GetDataResponse, error) {
    output := make(chan bool, 1)
    var response GetDataResponse
    var serviceError error

    errs := hystrix.Go("GetData", func() error {
        response, serviceError = p.GetDataFromService(ctx, req)
        if serviceError != nil {
            if sErr, ok := serviceError.(errors.Err); ok {
                if sErr.GetCode() >= 500 {
                    return sErr
                }
            } else {
                return serviceError
            }
        }
        output <- true
        return nil
    }, nil)

    select {
    case out := <-output:
        if out {
            return response, serviceError
        }
    case err := <-errs:
        return response, err
    }
    return response, serviceError
}
```

### hystrix.Do() — when it's acceptable

`hystrix.Do()` is a simpler synchronous alternative. It is functionally equivalent but does not use the channel+select pattern. It is acceptable when:
- The team explicitly adopts it for new code
- The operation is inherently synchronous and the channel pattern adds no value

Flag `hystrix.Do()` as an **info**-level inconsistency when the rest of the codebase uses `hystrix.Go()`. It is not a bug.

```go
// Simpler synchronous pattern — acceptable but inconsistent with team convention
err := hystrix.Do("GetData", func() error {
    response, serviceError = p.GetDataFromService(ctx, req)
    if serviceError != nil {
        return serviceError
    }
    return nil
}, nil)  // nil fallback
```

## Severity Classification

- **Critical:** `hystrix.Go()` called with a command name that has no matching `ConfigureCommand()` (runs with silent defaults). Duplicate `ConfigureCommand()` calls for the same command name (last one wins silently).
- **Warning:** Inconsistent boilerplate across methods in the same service (different channel types, signaling mechanisms, or select structures). Configuration scattered across multiple files.
- **Info:** Use of `hystrix.Do()` when the rest of the codebase uses `hystrix.Go()`. Minor naming differences in local variables (e.g., `errs` vs `errors` vs `errCh`).
