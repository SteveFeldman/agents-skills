# Error Handling

## What To Look For

- [ ] The `hystrix.Go()` closure only returns errors that should trip the circuit (typically 5xx/server errors)
- [ ] Client errors (4xx) are passed through to the caller without affecting circuit health
- [ ] The error type assertion uses the service's error type correctly (e.g., `errors.Err` with `GetCode()`)
- [ ] Network errors (connection refused, DNS failures) are returned to hystrix (they should trip the circuit)
- [ ] The `select` statement handles both the output channel and error channel correctly
- [ ] Errors are not silently swallowed — every code path returns a meaningful error or response
- [ ] The output channel has the correct buffer size (should be 1 to prevent goroutine leaks)

## Broken Patterns

### All errors trip the circuit

```go
errs := hystrix.Go("GetData", func() error {
    response, err = p.GetDataFromService(ctx, req)
    if err != nil {
        return err  // 404s and 400s will trip the circuit — wrong
    }
    output <- true
    return nil
}, nil)
```

### Swallowed error in select

```go
select {
case out := <-output:
    if out {
        return response, serviceError
    }
case err := <-errs:
    return response, err
}
return response, nil  // If neither channel fires, error is swallowed as nil
```

### Missing output signal on non-5xx error path

```go
errs := hystrix.Go("GetData", func() error {
    response, err = p.GetDataFromService(ctx, req)
    if err != nil {
        if sErr, ok := err.(errors.Err); ok {
            if sErr.GetCode() >= 500 {
                return sErr
            }
        } else {
            return err
        }
        // Falls through here for 4xx errors — but output <- true is never sent
        // The select will hang until hystrix timeout
    }
    output <- true
    return nil
}, nil)
```

### Response body error ignored

```go
errs := hystrix.Go("GetData", func() error {
    response, err = p.GetDataFromService(ctx, req)
    if err != nil {
        return err
    }
    // What if response.StatusCode is 200 but response.Body contains an error?
    // This depends on the downstream — flag if the downstream is known to return 200 with error bodies
    output <- true
    return nil
}, nil)
```

## Correct Patterns

### Selective error filtering (5xx only)

```go
output := make(chan bool, 1)  // Buffer size 1 prevents goroutine leak
var response DataResponse
var serviceError error

errs := hystrix.Go("GetData", func() error {
    response, serviceError = p.GetDataFromService(ctx, req)
    if serviceError != nil {
        if sErr, ok := serviceError.(errors.Err); ok {
            if sErr.GetCode() >= 500 {
                return sErr  // 5xx errors trip the circuit
            }
        } else {
            return serviceError  // Non-typed errors trip the circuit (safe default)
        }
    }
    output <- true
    return nil
}, nil)

select {
case out := <-output:
    if out {
        return response, serviceError  // Return response + original error (may be 4xx)
    }
case err := <-errs:
    return response, err  // Return circuit breaker error
}
return response, serviceError
```

## Tuning Guidance

### Error filtering decision matrix

| Error Type | Should Trip Circuit? | Rationale |
|-----------|---------------------|-----------|
| 5xx server error | Yes | Downstream is unhealthy |
| Connection refused / DNS failure | Yes | Downstream is unreachable |
| Timeout (from hystrix) | Yes (automatic) | Hystrix handles this internally |
| 4xx client error | No | Client sent bad data, downstream is fine |
| 404 not found | No (usually) | Resource doesn't exist, not a service health issue |
| 429 rate limited | Maybe | Depends on whether rate limiting indicates overload |

### Channel buffer sizing

The output channel should always be created with buffer size 1:
```go
output := make(chan bool, 1)
```

Buffer size 0 (unbuffered) can cause goroutine leaks: if hystrix times out before `output <- true` executes, the goroutine blocks forever on the send.

## Severity Classification

- **Critical:** All errors (including 4xx) trip the circuit. Output channel buffer size is 0 (goroutine leak). Missing error return path in select (error swallowed as nil).
- **Warning:** Missing `output <- true` on the non-5xx error path (causes timeout instead of immediate return). Non-typed errors not handled.
- **Info:** Error filtering works but could be more explicit about edge cases (429, response body errors).
