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
