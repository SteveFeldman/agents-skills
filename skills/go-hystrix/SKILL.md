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
