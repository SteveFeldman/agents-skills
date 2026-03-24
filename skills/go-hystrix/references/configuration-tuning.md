# Configuration Tuning

## What To Look For

- [ ] All `hystrix.ConfigureCommand()` calls set explicit `Timeout`, `MaxConcurrentRequests`, and `ErrorPercentThreshold`
- [ ] Timeouts are config-driven (not hardcoded) for service dependencies; hardcoded is acceptable for cache layers with known latency profiles
- [ ] `MaxConcurrentRequests` varies by dependency based on expected traffic (not uniform across all commands)
- [ ] `ErrorPercentThreshold` is appropriate for the dependency type
- [ ] `SleepWindow` is explicitly set (default is 5000ms — may be too long for fast-recovering dependencies or too short for slow ones)
- [ ] `RequestVolumeThreshold` is explicitly set (default is 20 — may be too low for high-traffic commands or too high for low-traffic ones)
- [ ] Timeouts are shorter than the upstream caller's timeout (otherwise the circuit breaker never trips before the caller times out)
- [ ] Each `hystrix.Go()`/`hystrix.Do()` command name matches a configured command (unconfigured commands use hystrix defaults silently)

## Broken Patterns

### Uniform concurrency across all commands

```go
// Every command gets the same concurrency regardless of traffic
hystrix.ConfigureCommand("GetData", hystrix.CommandConfig{
    Timeout:               baseTimeout,
    MaxConcurrentRequests: 100,
    ErrorPercentThreshold: 25,
})
hystrix.ConfigureCommand("GetCacheData", hystrix.CommandConfig{
    Timeout:               baseTimeout,
    MaxConcurrentRequests: 100,  // Same as above — cache calls are much more frequent
    ErrorPercentThreshold: 25,
})
```

### Missing SleepWindow and RequestVolumeThreshold

```go
// Only sets 3 of 5 config values — relies on hystrix defaults for the rest
hystrix.ConfigureCommand("FetchItems", hystrix.CommandConfig{
    Timeout:               5000,
    MaxConcurrentRequests: 100,
    ErrorPercentThreshold: 25,
    // SleepWindow defaults to 5000ms
    // RequestVolumeThreshold defaults to 20
})
```

### Hardcoded timeouts for external services

```go
// Timeout is hardcoded — can't be tuned per environment
hystrix.ConfigureCommand("CallExternalAPI", hystrix.CommandConfig{
    Timeout:               3000,  // Should be config-driven
    MaxConcurrentRequests: 100,
    ErrorPercentThreshold: 25,
})
```

## Correct Patterns

### Varied concurrency by dependency type

```go
// High-traffic core operation
hystrix.ConfigureCommand("GetPrimaryData", hystrix.CommandConfig{
    Timeout:               s.GetConfig().GetInt("baseTimeout"),
    MaxConcurrentRequests: 600,
    ErrorPercentThreshold: 25,
})

// Lower-traffic auxiliary data
hystrix.ConfigureCommand("GetMetadata", hystrix.CommandConfig{
    Timeout:               s.GetConfig().GetInt("baseTimeout"),
    MaxConcurrentRequests: 100,
    ErrorPercentThreshold: 25,
})

// Cache layer — high concurrency, low timeout
hystrix.ConfigureCommand("ReadCache", hystrix.CommandConfig{
    Timeout:               1000,  // Hardcoded is OK for cache — known latency profile
    MaxConcurrentRequests: 400,
    ErrorPercentThreshold: 25,
})
```

### Full configuration with all fields

```go
hystrix.ConfigureCommand("FetchItems", hystrix.CommandConfig{
    Timeout:                5000,
    MaxConcurrentRequests:  200,
    ErrorPercentThreshold:  25,
    SleepWindow:            3000,  // How long to wait before testing if circuit should close
    RequestVolumeThreshold: 10,    // Min requests before circuit can trip
})
```

## Tuning Guidance

These are starting-point heuristics. Validate against actual p99 latencies and traffic patterns before applying.

### Dependency-Type Benchmark Table

| Dependency Type | Timeout | MaxConcurrent | ErrorThreshold | SleepWindow | Notes |
|----------------|---------|---------------|----------------|-------------|-------|
| Cache (Redis) | 500-1000ms | 200-400 | 25-50% | 2000-3000ms | Known latency, high throughput |
| Internal service | config-driven | 100-300 | 25% | 3000-5000ms | Match SLA of downstream |
| External API | config-driven | 50-200 | 10-25% | 5000-10000ms | Less predictable, protect aggressively |
| Database | config-driven | 50-200 | 25% | 3000-5000ms | Depends on query complexity |

### Timeout Hierarchy Rule

The circuit breaker timeout MUST be shorter than the caller's timeout. If a client calls your service with a 10s timeout, and your service calls a downstream with a 10s hystrix timeout, the downstream circuit never trips — the client times out first.

**Rule of thumb:** hystrix timeout ≤ 80% of the caller's timeout for that path.

### Concurrency Sizing

- Start with expected peak QPS for the command
- Add 50-100% headroom for burst traffic
- Core read paths (most traffic): 400-600
- Auxiliary/secondary reads: 100-200
- Write operations: 50-100 (writes are typically lower volume)
- Cache operations: 200-400 (fast but frequent)

## Severity Classification

- **Critical:** Command name in `hystrix.Go()` does not match any `ConfigureCommand()` (silent default config). Timeout is higher than upstream caller timeout.
- **Warning:** Uniform `MaxConcurrentRequests` across commands with different traffic profiles. Missing `SleepWindow` or `RequestVolumeThreshold`. Hardcoded timeout for external service dependency.
- **Info:** All thresholds set but values could be optimized based on actual metrics.
