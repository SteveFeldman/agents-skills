---
name: go-hystrix
description: Audit and optimize Hystrix circuit breaker implementations in Go services for scaling, performance, and availability
---

# Hystrix Circuit Breaker Audit

Audit a Go service's Hystrix circuit breaker implementation across 7 dimensions: configuration tuning, error handling, code patterns, observability, naming conventions, testing, and fallback patterns. Produces a tiered report with quick-win code fixes and recommendations requiring team decisions.

## Context

Go services using `github.com/afex/hystrix-go` implement circuit breakers to protect downstream dependencies. Common patterns include:
- `hystrix.ConfigureCommand()` in `main.go` to set timeouts, concurrency, and error thresholds
- `hystrix.Go()` with a channel+select pattern for async execution
- `hystrix.GetCircuit()` in instrumenting middleware for Prometheus metrics
- `hystrix.NewStreamHandler()` for real-time circuit monitoring

## Instructions

### 0. Determine Audit Scope

- If `$ARGUMENTS` contains file paths or a subdirectory: **scoped audit** — only audit hystrix usage in those files
- If `$ARGUMENTS` is empty: **full repo audit** — audit the entire service in the current working directory
- If invoked by go-staff-engineer agent: follow the agent's scope directive

For scoped audits, skip dimensions where no relevant findings exist and produce a condensed report.

### 1. Find Hystrix Imports

- Check `go.mod` for `github.com/afex/hystrix-go` dependency
- Scan all `*.go` files for `"github.com/afex/hystrix-go/hystrix"` imports
- If no hystrix usage is found, report "No hystrix-go usage detected" and stop

### 2. Map Command Configurations

- Search for all `hystrix.ConfigureCommand()` calls (typically in `main.go`)
- For each command, extract:
  - Command name (first argument string)
  - `Timeout` value and whether it's hardcoded or config-driven
  - `MaxConcurrentRequests` value
  - `ErrorPercentThreshold` value
  - Whether `SleepWindow` or `RequestVolumeThreshold` are set (note if using defaults)

Build the **Command Inventory Table**:

| Command | Timeout | MaxConcurrent | ErrorThreshold | SleepWindow | ReqVolumeThreshold | File:Line |
|---------|---------|---------------|----------------|-------------|-------------------|-----------|

### 3. Map Execution Sites

- Search for all `hystrix.Go()` and `hystrix.Do()` calls across `*.go` files
- For each call, record:
  - The command name string (must match a configured command)
  - The file and line number
  - Whether a fallback function is provided (second/third parameter)
  - The service method or dependency it protects
- Flag any execution sites where the command name does not match a configured command

### 4. Map Middleware and Wrappers

- Search for `hystrix.GetCircuit()` calls — these indicate monitoring/metrics integration
- Identify instrumenting middleware that exposes circuit status (typically a `getCircuitStatus()` helper)
- Note which metrics system is used (Prometheus, StatsD, etc.)

### 5. Identify Protected Dependencies

- For each hystrix command, trace the code inside the `hystrix.Go()`/`hystrix.Do()` closure to identify what external service or resource it protects
- Categorize each dependency: external API, cache (Redis), database, internal service, etc.

Output: A **command map** linking each command to its configuration, execution site, and protected dependency. This map is the foundation for all 7 dimension audits.
