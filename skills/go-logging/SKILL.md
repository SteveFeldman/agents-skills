---
name: go-logging
description: "Audit and improve Go service logging to ensure Splunk logs capture method, request details, TraceID, SpanID, and timing using the go-common logging library"
---

# Go Logging Improvement

Audit the Go service's logging middleware and request/response types to ensure every endpoint emits rich, structured Splunk-friendly logs — including `method`, `Request` (with `TraceId`, `SpanId`, `Branch`, `XRealIP`), `took`, and `err`.

## Context

All Go services use:
- `github.com/go-kit/log` — the structured `log.Logger`
- `github.com/totalwinelabs/go-common/src/logging` — provides `GenLogString()`, `GetRequestInfo()`, and `RequestInfo` struct
- A `LoggingMiddleware` pattern (service-level middleware) with a `loggingMiddleware` struct

Ideal Splunk log output:
```
ts=2026-03-20T19:50:44Z caller=logging.go:117 method=GetItems Request="GetItemsEndpointRequest:{ ResourceId: 931, Query: ..., RequestInfo:{ TraceId: 08e193a4..., SpanId: 8f4a80f3..., Branch: green, XRealIP: 159.250.159.14, }}" took=96.83ms
```

## Instructions

### 1. Discover and Read the Service

- Identify the target service directory from `$ARGUMENTS` (expects a path to the service root, e.g., `~/code/my-service`). If not specified, ask the user.
- Read all files in the service root directory to understand structure.
- Find and read:
  - `*/logging.go` — the logging middleware
  - `*/transport.go` or `*/transport/*.go` — HTTP decode functions that build request structs
  - All request/response type definitions (usually `*/types/types.go`, `*/endpoints/*.go`, `*/services/*.go`, or inline in the service package)
  - `go.mod` — to confirm the `go-common` dependency

### 2. Audit: The `shouldLog` Pattern Bug

Check each logging middleware method for this **critical bug**: the `shouldLog(err, mw)` guard is evaluated **before** the actual service call, so `err` is always `nil`. This means logging only fires when `debug=true` — errors are silently swallowed.

> **Edge case:** Some services may have already worked around this by making `shouldLog` always return `true` (e.g., returning `true` in both branches). In that case the guard is a no-op and the bug has no runtime impact, but the structural fix should still be applied so the code is correct if `shouldLog` logic is ever tightened.

**Broken pattern:**
```go
func (mw loggingMiddleware) MyMethod(ctx context.Context, req MyRequest) (r MyResponse, err error) {
    if shouldLog(err, mw) {  // err is nil here — evaluated before the service call
        defer func(begin time.Time) {
            mw.logger.Log("method", "MyMethod", ...)
        }(time.Now())
    }
    return mw.next.MyMethod(ctx, req)
}
```

**Correct pattern** — move `shouldLog` inside the defer so it reads the final `err` value:
```go
func (mw loggingMiddleware) MyMethod(ctx context.Context, req MyRequest) (r MyResponse, err error) {
    defer func(begin time.Time) {
        if shouldLog(err, mw) {  // err is the named return, captured after service call
            mw.logger.Log("method", "MyMethod", "Request", logging.GenLogString(req), "took",
                fmt.Sprintf("%vms", time.Since(begin).Seconds()*1000), "err", err)
        }
    }(time.Now())
    return mw.next.MyMethod(ctx, req)
}
```

Fix every method in the logging middleware to use the correct pattern.

### 3. Audit: `RequestInfo` in Request Structs

Every request struct logged via `GenLogString()` **must** embed `logging.RequestInfo` to capture TraceId, SpanId, Branch, XRealIP etc. Check each request struct used in logging middleware methods.

**Missing RequestInfo:**
```go
type GetItemsEndpointRequest struct {
    ResourceId string `json:"resourceId" log:"true"`
    Query      string `json:"query" log:"true"`
    Category   string `json:"category" log:"true"`
    // No RequestInfo — TraceId/SpanId will never appear in logs
}
```

**Correct — embed RequestInfo with `log:"true"`:**
```go
type GetItemsEndpointRequest struct {
    ResourceId          string              `json:"resourceId" log:"true"`
    Query               string              `json:"query" log:"true"`
    Category            string              `json:"category" log:"true"`
    logging.RequestInfo `json:"-" log:"true"` // Captures TraceId, SpanId, Branch, XRealIP
}
```

Add `logging.RequestInfo \`json:"-" log:"true"\`` to every request struct that lacks it.

### 4. Audit: `log:"true"` Struct Tags

`GenLogString()` uses reflection and **only serializes fields tagged `log:"true"`**. Fields without this tag are silently omitted from logs.

Check every request and response struct referenced in `logging.go`. For each field that should appear in Splunk logs, verify it has `log:"true"`.

**Missing tags:**
```go
type GetItemsEndpointRequest struct {
    ResourceId string `json:"resourceId"`          // won't appear in logs
    ItemId     string `json:"itemId"`               // won't appear in logs
    State      string `json:"state"`                // won't appear in logs
}
```

**Correct:**
```go
type GetItemsEndpointRequest struct {
    ResourceId string `json:"resourceId" log:"true"`
    ItemId     string `json:"itemId" log:"true"`
    State      string `json:"state" log:"true"`
}
```

Add `log:"true"` to all identifying, diagnostic, or routing fields. Omit it from:
- Large payloads or arrays that would bloat logs
- Sensitive PII fields (passwords, full credit card numbers, SSNs)
- Internal cache keys or raw binary data

### 5. Audit: Transport — Populating `RequestInfo`

Even if the request struct has `logging.RequestInfo` embedded, it must be **populated** from the HTTP request in the transport decode function. Check every `decode*` function in transport files.

**Missing population:**
```go
func decodeGetItems(ctx context.Context, r *http.Request) (interface{}, error) {
    return GetItemsEndpointRequest{
        ResourceId: vars["resourceId"],
        // RequestInfo not populated — TraceId etc. will be empty strings
    }, nil
}
```

**Correct — call `logging.GetRequestInfo`:**
```go
func decodeGetItems(ctx context.Context, r *http.Request) (interface{}, error) {
    return GetItemsEndpointRequest{
        ResourceId:  vars["resourceId"],
        RequestInfo: logging.GetRequestInfo(ctx, r), // populates TraceId, SpanId, Branch, XRealIP
    }, nil
}
```

> **Note:** Older versions of `go-common` have a single-arg signature `GetRequestInfo(r)`. Check the function signature in the vendored or module-cached copy and use the correct signature for your version.

### 6. Audit: `log.Printf` and `fmt.Println/Printf` — Unstructured Logging

Scan all `.go` files in the service for uses of the standard library logger and `fmt` print functions. Use the Grep tool to search for `log\.Printf`, `log\.Println`, `stdlog\.`, `fmt\.Println`, `fmt\.Printf`, and `fmt\.Print` in `*.go` files, excluding `_test.go`.

These are **not** go-kit structured logs — they write to stdout/stderr in a format that Splunk cannot reliably parse as key-value pairs, they carry no `ts`/`caller` fields, and they are invisible to the logging middleware.

#### Why this happens — the root cause

These patterns typically appear in **inner service or client layers** (e.g., a downstream API adapter, an HTTP client wrapper) that have no `log.Logger` field. Developers fall back to `fmt`/`log` because the go-kit logger was never passed in. The fix is to thread the logger into those layers.

#### Remediation for `log.Printf` / `stdlog.Printf`

These are usually real error or warning events. Convert them to the go-kit structured logger:

**Before:**
```go
import stdlog "log"

stdlog.Printf("[fetchFromUpstream] Error calling GetResources for id=%s correlationId=%s err=%v\n",
    resourceId, correlationId, fetchErr)
```

**After:**
```go
s.logger.Log(
    "method", "fetchFromUpstream",
    "event", "error_get_resources",
    "resourceId", resourceId,
    "correlationId", correlationId,
    "err", fetchErr,
)
```

To do this, the inner type needs a logger field:

```go
// Add logger field to the inner struct
type UpstreamClient struct {
    // ... existing fields ...
    logger log.Logger  // add this
}

// Pass it from the constructor
func NewUpstreamClient(hc *http.Client, logger log.Logger, ...) *UpstreamClient {
    if logger == nil {
        logger = log.NewNopLogger()
    }
    return &UpstreamClient{
        logger: logger,
        // ... other fields ...
    }
}
```

Then update any call sites (e.g., `service.go`) to pass the logger into the constructor.

#### Remediation for `fmt.Println` / `fmt.Printf`

These fall into two categories:

**Errors/warnings that carry real diagnostic value** — convert to `s.logger.Log(...)`:
```go
// Before
fmt.Printf("[FetchData] Error getting items for resource '%s' / correlationId: %s: %v\n",
    resourceId, correlationId, err)

// After
s.logger.Log(
    "method", "FetchData",
    "event", "error_get_items",
    "resourceId", resourceId,
    "correlationId", correlationId,
    "err", err,
)
```

**Informational/debug noise** — evaluate whether it's needed in production:
```go
// Before — logs a count on every request, noisy in production
fmt.Printf("[ProcessBatch] Processing %d items\n", len(items))

// After — log only if debug mode is on, or remove entirely if it's not actionable
if s.config.GetBool("debug") {
    s.logger.Log("method", "ProcessBatch", "event", "processing_items", "count", len(items))
}
```

**Startup / init errors** — these often appear before the logger is initialized. Use `logger.Log` with `"level", "error"` and call `os.Exit(1)` if fatal:
```go
// Before
fmt.Println("Client init error: ", err)

// After — log and exit if this is fatal, or just log as a warning if non-fatal
level.Error(logger).Log("event", "client_init_error", "err", err)
```

#### Summary decision matrix

| Pattern | Action |
|---------|--------|
| `log.Printf("[METHOD] [ERROR] ...")` | Convert to `s.logger.Log(...)` with key-value pairs |
| `stdlog.Printf(...)` | Same — add logger to struct, convert |
| `fmt.Printf("... err=%v", err)` | Convert to `s.logger.Log(...)` |
| `fmt.Printf("... count=%d ...")` | Wrap in `debug` guard or remove |
| `fmt.Println("some debug noise")` | Remove if not actionable in production |
| `fmt.Println(err)` bare error | Convert to `s.logger.Log("err", err)` |

### 7. Audit: Standard Log Fields

| Field | Value | Example |
|-------|-------|---------|
| `method` | method name string | `"GetItems"` |
| `Request` | `logging.GenLogString(req)` | full request with TraceId |
| `took` | `fmt.Sprintf("%vms", time.Since(begin).Seconds()*1000)` | `"96.83ms"` |
| `err` | the named error return | `nil` or error message |

Optional but recommended:
- `Response` with `logging.GenLogString(r)` — add for endpoints where response details aid debugging
- `statusCode` — add when using `errors.Err` typed errors (use `sErr.GetCode()`)

### 8. Fix All Issues Found

After completing the audit (steps 2–7), implement all fixes:

1. **Fix `shouldLog` placement** — move guard inside defer for every method
2. **Add `logging.RequestInfo`** — embed in all request structs that are missing it
3. **Add `log:"true"` tags** — on all request/response fields that should be logged
4. **Populate `RequestInfo` in transport** — add `logging.GetRequestInfo(ctx, r)` to each decode function
5. **Ensure standard fields** — every logged method has `method`, `Request`, `took`, `err`
6. **Eliminate `log.Printf` / `stdlog.Printf`** — thread logger into inner structs, convert to `s.logger.Log()`
7. **Eliminate `fmt.Println` / `fmt.Printf`** — convert real errors to `s.logger.Log()`, remove debug noise

### 9. Verify and Report

After applying fixes:
- Check that no existing tests are broken (run `go test ./...` if available)
- Summarize changes made across each file
- Show a before/after example of what a Splunk log entry will now look like

Report format:
```
## Go Logging Audit — <ServiceName>

### Issues Fixed
- **[CRITICAL] shouldLog bug** — fixed in N methods (logging.go)
- **[HIGH] Missing RequestInfo** — added to N request structs (types.go / endpoints/*.go)
- **[HIGH] Missing log:"true" tags** — added to N fields across N structs
- **[HIGH] RequestInfo not populated** — fixed N decode functions (transport.go)

### Files Changed
- `service/logging.go` — moved shouldLog inside defer for all X methods
- `service/types/types.go` — added logging.RequestInfo and log tags
- `service/transport.go` — added GetRequestInfo() calls

### Sample Log Output (after fix)
ts=... caller=logging.go:42 method=GetItems Request="GetItemsEndpointRequest:{ ResourceId: 931, ..., RequestInfo:{ TraceId: 08e193a4..., SpanId: 8f4a80f3..., Branch: green, XRealIP: 10.0.0.1, }}" took=96.83ms err=<nil>
```
