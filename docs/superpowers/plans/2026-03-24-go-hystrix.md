# go-hystrix Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a skill that audits Hystrix circuit breaker implementations in Go services across 7 dimensions, producing tiered reports with quick-win code fixes and team recommendations.

**Architecture:** A single SKILL.md defines the 3-phase audit workflow (Discovery → Dimension Audits → Report). Seven reference files under `references/` provide the domain knowledge for each audit dimension. The skill integrates with the go-staff-engineer agent via a trigger condition added to the agent definition.

**Tech Stack:** Markdown skill files following the agents-skills repo conventions. All code examples in Go using `github.com/afex/hystrix-go`.

**Spec:** `docs/superpowers/specs/2026-03-24-go-hystrix-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `skills/go-hystrix/SKILL.md` | Main audit workflow, scope detection, phase 1-3 instructions, report template |
| Create | `skills/go-hystrix/references/configuration-tuning.md` | Dimension 1: timeout, concurrency, threshold, sleep window auditing |
| Create | `skills/go-hystrix/references/error-handling.md` | Dimension 2: error filtering, swallowed errors |
| Create | `skills/go-hystrix/references/code-patterns.md` | Dimension 3: canonical hystrix.Go boilerplate, deviations |
| Create | `skills/go-hystrix/references/observability.md` | Dimension 4: Prometheus, stream handler, alerting |
| Create | `skills/go-hystrix/references/naming-conventions.md` | Dimension 5: command naming, traceability |
| Create | `skills/go-hystrix/references/testing-patterns.md` | Dimension 6: circuit breaker test templates |
| Create | `skills/go-hystrix/references/fallback-patterns.md` | Dimension 7: nil fallback flagging, strategy catalog |
| Modify | `agents/go-staff-engineer.md` | Add circuit breaker auditing trigger to Observability & Operations |

---

### Task 1: Create SKILL.md — Frontmatter and Scope Detection

**Files:**
- Create: `skills/go-hystrix/SKILL.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p skills/go-hystrix/references
```

- [ ] **Step 2: Write SKILL.md with frontmatter, context, and scope detection**

Write `skills/go-hystrix/SKILL.md` with:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add skills/go-hystrix/SKILL.md
git commit -m "feat(go-hystrix): add SKILL.md with frontmatter and scope detection"
```

---

### Task 2: SKILL.md — Phase 1 Discovery Instructions

**Files:**
- Modify: `skills/go-hystrix/SKILL.md`

- [ ] **Step 1: Append Phase 1 discovery steps to SKILL.md**

Append the following after the scope detection section:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/SKILL.md
git commit -m "feat(go-hystrix): add Phase 1 discovery instructions"
```

---

### Task 3: SKILL.md — Phase 2 Dimension Audit Loop and Phase 3 Report Template

**Files:**
- Modify: `skills/go-hystrix/SKILL.md`

- [ ] **Step 1: Append Phase 2 and Phase 3 to SKILL.md**

Append the following:

```markdown
### 6. Audit Dimensions

For each dimension (1-7), read the corresponding reference file under `references/`, then run its checklist against the command map and source code. For each finding:

- Classify severity: **Critical** (misconfigured/ineffective), **Warning** (suboptimal but functional), **Info** (style/consistency)
- Tag as **Quick Win** (include before/after code) or **Recommendation** (describe the issue, note effort as S/M/L)

**Dimension order:**
1. **Configuration Tuning** — read `references/configuration-tuning.md`
2. **Error Handling** — read `references/error-handling.md`
3. **Code Patterns** — read `references/code-patterns.md`
4. **Observability** — read `references/observability.md`
5. **Naming Conventions** — read `references/naming-conventions.md`
6. **Testing** — read `references/testing-patterns.md`
7. **Fallback Patterns** — read `references/fallback-patterns.md`

### 7. Generate Report

Produce the audit report in this format. For dimensions with no findings, include the heading with "No issues found."

~~~markdown
# Hystrix Audit Report: {service-name}

## Executive Summary
- **Commands audited:** {count}
- **Dependencies protected:** {list}
- **Overall health:** {Critical: N | Warning: N | Info: N}

### Quick Wins (ready to apply)
| # | Finding | Dimension | Severity | File:Line |
|---|---------|-----------|----------|-----------|
| 1 | ... | ... | ... | ... |

### Recommendations (team decision needed)
| # | Finding | Dimension | Severity | Effort |
|---|---------|-----------|----------|--------|
| 1 | ... | ... | ... | S/M/L |

---

## Command Inventory
| Command | Timeout | MaxConcurrent | ErrorThreshold | Protected Dependency | File:Line |
|---------|---------|---------------|----------------|---------------------|-----------|

---

## Dimension 1: Configuration Tuning
### Findings
{findings with severity badges}
### Quick Win Code
{before/after diffs for fixable items}

## Dimension 2: Error Handling
### Findings
{error filtering analysis, swallowed errors}
### Quick Win Code
{fixes where applicable}

## Dimension 3: Code Patterns
### Findings
{deviations from standard boilerplate}
### Quick Win Code
{normalization diffs}

## Dimension 4: Observability
### Findings
{metrics integration, stream handler, alerting gaps}
### Quick Win Code
{missing metrics registration, etc.}

## Dimension 5: Naming Conventions
### Findings
{inconsistent or non-traceable names}
### Quick Win Code
{renames where safe}

## Dimension 6: Testing
### Findings
{missing circuit breaker test coverage}
### Recommendations
{test patterns to add}

## Dimension 7: Fallback Patterns
### Findings
{flag missing fallbacks — no prescriptive fixes, defer to team}
~~~

**Severity definitions:**
- **Critical** — circuit breaker is misconfigured or ineffective (e.g., timeout higher than upstream timeout, circuit never trips)
- **Warning** — suboptimal but functional (e.g., uniform concurrency not tuned per dependency, missing sleep window config)
- **Info** — style/consistency issues (e.g., naming inconsistency, boilerplate deviation)

**Effort sizing for recommendations:**
- **S** — isolated change, single file
- **M** — multi-file change, requires testing
- **L** — architectural change, requires team alignment
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/SKILL.md
git commit -m "feat(go-hystrix): add Phase 2 dimension audit loop and Phase 3 report template"
```

---

### Task 4: Reference — configuration-tuning.md

**Files:**
- Create: `skills/go-hystrix/references/configuration-tuning.md`

- [ ] **Step 1: Write configuration-tuning.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/configuration-tuning.md
git commit -m "feat(go-hystrix): add configuration-tuning reference"
```

---

### Task 5: Reference — error-handling.md

**Files:**
- Create: `skills/go-hystrix/references/error-handling.md`

- [ ] **Step 1: Write error-handling.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/error-handling.md
git commit -m "feat(go-hystrix): add error-handling reference"
```

---

### Task 6: Reference — code-patterns.md

**Files:**
- Create: `skills/go-hystrix/references/code-patterns.md`

- [ ] **Step 1: Write code-patterns.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/code-patterns.md
git commit -m "feat(go-hystrix): add code-patterns reference"
```

---

### Task 7: Reference — observability.md

**Files:**
- Create: `skills/go-hystrix/references/observability.md`

- [ ] **Step 1: Write observability.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/observability.md
git commit -m "feat(go-hystrix): add observability reference"
```

---

### Task 8: Reference — naming-conventions.md

**Files:**
- Create: `skills/go-hystrix/references/naming-conventions.md`

- [ ] **Step 1: Write naming-conventions.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/naming-conventions.md
git commit -m "feat(go-hystrix): add naming-conventions reference"
```

---

### Task 9: Reference — testing-patterns.md

**Files:**
- Create: `skills/go-hystrix/references/testing-patterns.md`

- [ ] **Step 1: Write testing-patterns.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/testing-patterns.md
git commit -m "feat(go-hystrix): add testing-patterns reference"
```

---

### Task 10: Reference — fallback-patterns.md

**Files:**
- Create: `skills/go-hystrix/references/fallback-patterns.md`

- [ ] **Step 1: Write fallback-patterns.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/go-hystrix/references/fallback-patterns.md
git commit -m "feat(go-hystrix): add fallback-patterns reference"
```

---

### Task 11: Update go-staff-engineer Agent Definition

**Files:**
- Modify: `agents/go-staff-engineer.md:35-39` (Observability & Operations section)

- [ ] **Step 1: Read current agent definition**

Read `agents/go-staff-engineer.md` to confirm the exact text of the Observability & Operations section.

- [ ] **Step 2: Add circuit breaker auditing trigger**

Add the following bullet point to the "Observability & Operations" section after "Graceful Shutdown":

```markdown
- **Circuit Breaker Auditing**: When reviewing a Go service that imports `github.com/afex/hystrix-go`, invoke the `/go-hystrix` skill to audit the circuit breaker implementation. Pass relevant file paths as arguments for scoped reviews, or invoke without arguments for a full repo audit.
```

- [ ] **Step 3: Commit**

```bash
git add agents/go-staff-engineer.md
git commit -m "feat(go-staff-engineer): add hystrix audit trigger to observability section"
```

---

### Task 12: Verification — Test the Skill Against a Real Service

**Files:**
- Read only — no changes

- [ ] **Step 1: Verify all files exist**

```bash
ls -la skills/go-hystrix/SKILL.md
ls -la skills/go-hystrix/references/
```

Expected: SKILL.md and 7 reference files.

- [ ] **Step 2: Verify SKILL.md frontmatter**

Read `skills/go-hystrix/SKILL.md` and confirm:
- Frontmatter has `name: go-hystrix` and a description
- All 7 instruction steps are present (0-7)
- Report template is complete with all 7 dimensions

- [ ] **Step 3: Verify each reference file**

Read each reference file and confirm it has:
- "What To Look For" checklist
- "Broken Patterns" with code examples
- "Correct Patterns" with code examples
- "Severity Classification" section

- [ ] **Step 4: Verify agent update**

Read `agents/go-staff-engineer.md` and confirm the circuit breaker auditing bullet is present in the Observability & Operations section.

- [ ] **Step 5: Dry-run mental walkthrough**

Using a representative Go service with 10+ hystrix commands, mentally trace through the SKILL.md workflow:
1. Would scope detection work for `/go-hystrix` (full) and `/go-hystrix service/` (scoped)?
2. Would Phase 1 discovery find all `ConfigureCommand()` and `hystrix.Go()` calls?
3. Would each dimension reference file produce meaningful findings?
4. Would the report template capture all findings?

- [ ] **Step 6: Commit verification notes (optional)**

If any issues were found during verification, fix them and commit. Otherwise, no commit needed.
