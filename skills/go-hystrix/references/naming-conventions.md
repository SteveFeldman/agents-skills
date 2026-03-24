# Naming Conventions

## What To Look For

- [ ] Command names are descriptive and match the service method they protect
- [ ] Namespace prefixing is used consistently (either all commands use `service:Operation` or none do)
- [ ] Command names used in `hystrix.Go()`/`hystrix.Do()` exactly match `ConfigureCommand()` names (case-sensitive)
- [ ] Command names are traceable from Prometheus metrics / logs back to source code
- [ ] No duplicate command names exist across different operations
- [ ] Cache-related commands include a distinguishing prefix or suffix (e.g., `read_redis_service`, `write_redis_service`)

## Broken Patterns

### Inconsistent prefixing

```go
// Some commands use namespace prefix, others don't
hystrix.ConfigureCommand("service_a:GetItems", ...)    // prefixed
hystrix.ConfigureCommand("GetDetails", ...)             // bare
hystrix.ConfigureCommand("service_a:GetMetadata", ...)  // prefixed
```

### Command name doesn't match method

```go
// Command named "GetData" but protects a method called "FetchItemDetails"
hystrix.Go("GetData", func() error {
    response, err = p.FetchItemDetails(ctx, req)
    // ...
}, nil)
```

### Non-traceable names

```go
// Generic names that could apply to anything
hystrix.ConfigureCommand("read", ...)
hystrix.ConfigureCommand("write", ...)
hystrix.ConfigureCommand("call", ...)
```

## Correct Patterns

### Consistent bare naming (when service has unique operations)

```go
hystrix.ConfigureCommand("GetItems", ...)
hystrix.ConfigureCommand("GetItemDetails", ...)
hystrix.ConfigureCommand("UpdateItem", ...)
```

### Consistent namespace prefixing (when disambiguation is needed)

```go
hystrix.ConfigureCommand("inventory:GetItems", ...)
hystrix.ConfigureCommand("inventory:GetItemDetails", ...)
hystrix.ConfigureCommand("notifications:SendAlert", ...)
```

### Cache commands with clear prefix/suffix

```go
hystrix.ConfigureCommand("service_read_redis", ...)
hystrix.ConfigureCommand("service_write_redis", ...)
```

## Severity Classification

- **Critical:** Command name in `hystrix.Go()` does not match any `ConfigureCommand()` (typo or missing config — runs with defaults silently).
- **Warning:** Inconsistent namespace prefixing within the same service. Command names that don't correspond to the method or dependency they protect.
- **Info:** Minor naming style inconsistencies (camelCase vs snake_case). Cache command naming differs from team convention.
