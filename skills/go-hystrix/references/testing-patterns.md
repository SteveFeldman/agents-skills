# Testing Patterns

## What To Look For

- [ ] Tests exist that verify behavior when the circuit is open (requests fail fast)
- [ ] Tests exist that verify timeout behavior (slow dependency triggers circuit)
- [ ] Tests exist that verify concurrency rejection (too many concurrent requests)
- [ ] Tests use `hystrix.Flush()` between test cases to reset circuit state
- [ ] Tests verify that 4xx errors do NOT trip the circuit (if using selective error filtering)
- [ ] Tests verify the fallback function behavior (if fallbacks are implemented)

## Broken Patterns

### No circuit breaker tests at all

The service has hystrix commands but no tests verifying circuit breaker behavior. This means:
- Circuit open behavior is untested — the service may behave unpredictably when a dependency fails
- Timeout configuration is untested — may be too long or too short
- Concurrency limits are untested — may not protect the service as intended

### Tests don't reset circuit state

```go
func TestGetData_Success(t *testing.T) {
    // This test may fail if a previous test opened the circuit
    // Missing: hystrix.Flush()
    result, err := service.GetData(ctx, req)
    assert.NoError(t, err)
}
```

## Correct Patterns

### Circuit open behavior test

```go
func TestGetData_CircuitOpen(t *testing.T) {
    hystrix.Flush()  // Reset all circuits

    // Configure a circuit that trips easily
    hystrix.ConfigureCommand("GetData", hystrix.CommandConfig{
        Timeout:                1000,
        MaxConcurrentRequests:  1,
        ErrorPercentThreshold:  1,
        RequestVolumeThreshold: 1,
        SleepWindow:            10000,  // Long sleep so circuit stays open
    })

    // Trip the circuit by causing an error
    output := make(chan bool, 1)
    hystrix.Go("GetData", func() error {
        return fmt.Errorf("simulated failure")
    }, nil)
    time.Sleep(100 * time.Millisecond)  // Let metrics propagate

    // Now the circuit should be open — next call should fail fast
    errCh := hystrix.Go("GetData", func() error {
        t.Fatal("should not execute when circuit is open")
        return nil
    }, nil)

    err := <-errCh
    assert.ErrorIs(t, err, hystrix.ErrCircuitOpen)
}
```

### Timeout behavior test

```go
func TestGetData_Timeout(t *testing.T) {
    hystrix.Flush()

    hystrix.ConfigureCommand("GetData", hystrix.CommandConfig{
        Timeout:               100,  // 100ms timeout
        MaxConcurrentRequests: 10,
        ErrorPercentThreshold: 50,
    })

    output := make(chan bool, 1)
    errs := hystrix.Go("GetData", func() error {
        time.Sleep(500 * time.Millisecond)  // Exceeds 100ms timeout
        output <- true
        return nil
    }, nil)

    select {
    case <-output:
        t.Fatal("should not succeed — timeout expected")
    case err := <-errs:
        assert.ErrorIs(t, err, hystrix.ErrTimeout)
    }
}
```

### Concurrency rejection test

```go
func TestGetData_MaxConcurrency(t *testing.T) {
    hystrix.Flush()

    hystrix.ConfigureCommand("GetData", hystrix.CommandConfig{
        Timeout:               5000,
        MaxConcurrentRequests: 1,  // Only 1 concurrent request allowed
        ErrorPercentThreshold: 50,
    })

    // Start a slow request that holds the single slot
    blocker := make(chan struct{})
    hystrix.Go("GetData", func() error {
        <-blocker  // Block until released
        return nil
    }, nil)

    time.Sleep(50 * time.Millisecond)  // Let the first request start

    // Second request should be rejected
    errs := hystrix.Go("GetData", func() error {
        t.Fatal("should not execute — concurrency limit reached")
        return nil
    }, nil)

    err := <-errs
    assert.ErrorIs(t, err, hystrix.ErrMaxConcurrency)
    close(blocker)  // Clean up
}
```

### Test with hystrix.Flush() for isolation

```go
func TestMain(m *testing.M) {
    // Or call hystrix.Flush() at the start of each test
    os.Exit(m.Run())
}

func TestGetData_Success(t *testing.T) {
    hystrix.Flush()  // Always reset before each test
    // ... test code ...
}
```

## Severity Classification

- **Critical:** None — missing tests are always a warning, not critical (the service still functions).
- **Warning:** No circuit breaker tests exist for any command. Tests exist but don't use `hystrix.Flush()` (flaky/order-dependent).
- **Info:** Tests cover basic cases but miss edge cases (concurrency rejection, selective error filtering).
