# Observability

## What To Look For

- [ ] A `getCircuitStatus()` helper (or equivalent) exists and is called in instrumenting middleware
- [ ] Circuit status is exposed as a Prometheus gauge metric (0 = closed/healthy, 1 = open/tripped)
- [ ] Every hystrix command has a corresponding circuit status metric
- [ ] The hystrix stream handler is started and listening on a dedicated port
- [ ] Request count and latency metrics exist per hystrix command
- [ ] Circuit open events are distinguishable in logs or metrics (for alerting)

## Broken Patterns

### No circuit status metrics

```go
// Instrumenting middleware only tracks request count and latency
func (s *instrumentingMiddleware) GetData(ctx context.Context, req GetDataRequest) (r GetDataResponse, err error) {
    defer func(begin time.Time) {
        s.requestCount.With("method", "GetData", "code", codeFrom(err)).Add(1)
        s.requestLatency.With("method", "GetData").Observe(time.Since(begin).Seconds())
        // No circuit status — can't alert when circuit opens
    }(time.Now())
    return s.next.GetData(ctx, req)
}
```

### Missing stream handler

```go
// main.go — no hystrix stream handler configured
// Cannot connect Hystrix Dashboard for real-time monitoring
```

### Circuit status not reported for all commands

```go
// Only reports status for some commands, not all
s.circuitStatus.With("circuit_name", "GetData").Set(getCircuitStatus("GetData"))
// Missing: GetMetadata, ReadCache, WriteCache
```

## Correct Patterns

### Circuit status helper

```go
func getCircuitStatus(circuitName string) float64 {
    circuit, _, _ := hystrix.GetCircuit(circuitName)
    var open float64
    switch circuit.IsOpen() {
    case true:
        open = 1
    default:
        open = 0
    }
    return open
}
```

### Full instrumentation per command

```go
func (s *instrumentingMiddleware) GetData(ctx context.Context, req GetDataRequest) (r GetDataResponse, err error) {
    defer func(begin time.Time) {
        var code string
        if err != nil {
            code = strconv.Itoa(helper.CodeFrom(err))
        } else {
            code = "200"
        }
        s.requestCount.With("method", "GetData", "code", code, "granularity", "total").Add(1)
        s.requestLatency.With("method", "GetData", "granularity", "total").Observe(time.Since(begin).Seconds())
        s.circuitStatus.With("circuit_name", "GetData").Set(getCircuitStatus("GetData"))
    }(time.Now())
    return s.next.GetData(ctx, req)
}
```

### Stream handler setup

```go
hystrixStreamHandler := hystrix.NewStreamHandler()
hystrixStreamHandler.Start()
go http.ListenAndServe(net.JoinHostPort("", "8084"), hystrixStreamHandler)
```

## Tuning Guidance

### Alerting recommendations

| Metric | Alert Condition | Severity |
|--------|----------------|----------|
| `circuit_status == 1` | Circuit open for > 30s | Critical |
| `circuit_status` flapping (0→1→0 rapidly) | > 3 state changes in 5 minutes | Warning |
| Request error rate per command | > ErrorPercentThreshold for > 1 minute | Warning |

### Stream handler port convention

Use a consistent port across services (e.g., 8084) for the hystrix stream handler. This simplifies service discovery and monitoring configuration.

## Severity Classification

- **Critical:** No circuit status metrics exposed — cannot detect or alert on circuit open events.
- **Warning:** Circuit status not reported for all commands. Stream handler missing. No alerting on circuit open events.
- **Info:** Stream handler port differs from team convention. Metrics labels inconsistent with other services.
