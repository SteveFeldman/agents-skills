# Fallback Patterns

## What To Look For

- [ ] Identify all `hystrix.Go()` and `hystrix.Do()` calls where the fallback parameter is `nil`
- [ ] For each nil fallback, note whether the command protects a read or write operation
- [ ] Flag the absence of fallbacks as a finding — do NOT prescribe specific fallback implementations
- [ ] Catalog the fallback strategy options for the team's reference

## Broken Patterns

There are no "broken" patterns for fallbacks — the absence of a fallback is a **design decision**, not a bug. However, `nil` fallbacks should be explicitly flagged so the team can make an informed choice.

### Nil fallback (flag but don't prescribe)

```go
errs := hystrix.Go("GetData", func() error {
    response, serviceError = p.GetDataFromService(ctx, req)
    // ...
    output <- true
    return nil
}, nil)  // No fallback — when circuit opens, caller gets ErrCircuitOpen
```

## Fallback Strategy Catalog

The following strategies are available. The right choice depends on product requirements — the audit flags the absence, the team decides the approach.

### 1. Cached/Stale Response

Return the last known good response from cache. Suitable for read operations where slightly stale data is acceptable.

```go
errs := hystrix.Go("GetData", func() error {
    response, serviceError = p.GetDataFromService(ctx, req)
    output <- true
    return nil
}, func(err error) error {
    // Fallback: return cached data
    cached, cacheErr := p.cache.Get(cacheKey)
    if cacheErr != nil {
        return cacheErr  // Cache miss — no fallback available
    }
    response = cached
    return nil
})
```

### 2. Default/Empty Response

Return a safe default value. Suitable for auxiliary data that can be omitted without breaking the caller.

```go
errs := hystrix.Go("GetMetadata", func() error {
    metadata, serviceError = p.GetMetadataFromService(ctx, req)
    output <- true
    return nil
}, func(err error) error {
    // Fallback: return empty metadata
    metadata = MetadataResponse{Items: []Item{}}
    return nil
})
```

### 3. Degraded Response

Return a partial response with reduced functionality. Suitable when some data is better than none.

```go
errs := hystrix.Go("GetFullProfile", func() error {
    profile, serviceError = p.GetFullProfileFromService(ctx, req)
    output <- true
    return nil
}, func(err error) error {
    // Fallback: return basic profile without recommendations
    profile = ProfileResponse{
        BasicInfo:       p.getBasicInfo(ctx, req),
        Recommendations: nil,  // Omit — dependency is down
    }
    return nil
})
```

### 4. No Fallback (Fail Fast)

Appropriate for write operations, transactions, and operations where correctness matters more than availability.

```go
// Correct to use nil fallback for writes
errs := hystrix.Go("SubmitTransaction", func() error {
    result, serviceError = p.SubmitTransactionToService(ctx, req)
    output <- true
    return nil
}, nil)  // Fail fast — do not silently succeed on a write
```

## Read vs Write Decision Guide

| Operation Type | Fallback Recommended? | Rationale |
|---------------|----------------------|-----------|
| Read (core data) | Team decision | Stale data may be acceptable or dangerous depending on context |
| Read (auxiliary/optional) | Usually yes | Empty/default is better than error for non-critical data |
| Write (create/update/delete) | Usually no | Silent success on a failed write is dangerous |
| Cache read | No (handled separately) | Cache miss should fall through to the primary source |
| Cache write | No | Failed cache write is non-critical |

## Severity Classification

- **Critical:** None — missing fallbacks are never critical. The service fails fast, which is a valid strategy.
- **Warning:** All commands have nil fallbacks (flag for team awareness). Read operations with nil fallbacks where cached/default data is a viable option.
- **Info:** Write operations with nil fallbacks (correct behavior, noted for completeness).
