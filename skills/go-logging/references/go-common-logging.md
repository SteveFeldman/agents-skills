# go-common Logging Library Reference

Source: `github.com/totalwinelabs/go-common/src/logging`

## Key Types

### `RequestInfo`

Captures distributed tracing and routing headers from incoming HTTP requests.
All fields tagged `log:"true"` so they are included by `GenLogString()`.

```go
type RequestInfo struct {
    UserAgent string `log:"true" json:"-"`
    TraceId   string `log:"true" json:"-"`
    SpanId    string `log:"true" json:"-"`
    ParentId  string `log:"true" json:"-"`
    Sampled   string `log:"true" json:"-"`
    Branch    string `log:"true" json:"-"`
    AppId     string `log:"true" json:"-"`
    XRealIP   string `log:"true" json:"-"`
}
```

Headers mapped:
- `TraceId` ← `X-B3-TraceId`
- `SpanId` ← `X-B3-SpanId`
- `ParentId` ← `X-B3-ParentSpanId`
- `Sampled` ← `X-B3-Sampled`
- `Branch` ← custom branch header
- `AppId` ← `app-id`
- `XRealIP` ← `X-Real-IP`
- `UserAgent` ← `user-agent`

## Key Functions

### `GetRequestInfo(ctx context.Context, r *http.Request) RequestInfo`

Populates a `RequestInfo` from HTTP request headers. Call this in transport decode functions.

```go
// In transport decode function:
func decodeMyRequest(ctx context.Context, r *http.Request) (interface{}, error) {
    return MyRequest{
        ResourceId:  r.URL.Query().Get("resourceId"),
        RequestInfo: logging.GetRequestInfo(ctx, r), // populates all trace headers
    }, nil
}
```

> Older versions of go-common have a single-arg signature `GetRequestInfo(r *http.Request) RequestInfo`.
> Check `go.mod` version and the vendored/module-cached copy to use the correct signature.

### `GenLogString(req interface{}) string`

Serializes a struct to a human-readable string for logging. Uses reflection.
**Only includes fields tagged `log:"true"`.**

```go
type MyRequest struct {
    ResourceId  string              `json:"resourceId" log:"true"`  // included
    InternalKey string              `json:"key"`                     // omitted
    RequestInfo logging.RequestInfo `json:"-" log:"true"`           // included (nested)
}

// Produces: MyRequest:{ ResourceId: 931, RequestInfo:{ TraceId: 08e193a4..., ... }}
logging.GenLogString(req)
```

### `RecordNewStruct(t reflect.Type)`

Pre-caches reflection data for a struct type. Call this at init time for performance in hot paths.

## Correct Logging Middleware Pattern

```go
package service

import (
    "context"
    "fmt"
    "time"

    "github.com/go-kit/log"
    "github.com/totalwinelabs/go-common/src/config"
    "github.com/totalwinelabs/go-common/src/logging"
)

type Middleware func(Service) Service

func LoggingMiddleware(logger log.Logger) Middleware {
    return func(next Service) Service {
        return &loggingMiddleware{next: next, logger: logger}
    }
}

type loggingMiddleware struct {
    next   Service
    logger log.Logger
}

// CORRECT: shouldLog is inside the defer so it evaluates err AFTER the service call
func (mw loggingMiddleware) GetItems(ctx context.Context, req GetItemsEndpointRequest) (r GetItemsResponse, err error) {
    defer func(begin time.Time) {
        if shouldLog(err, mw) {
            mw.logger.Log(
                "method", "GetItems",
                "Request", logging.GenLogString(req),
                "took", fmt.Sprintf("%vms", time.Since(begin).Seconds()*1000),
                "err", err,
            )
        }
    }(time.Now())
    return mw.next.GetItems(ctx, req)
}

// BROKEN: shouldLog wraps the defer — err is nil at this point, logging only fires on debug=true
func (mw loggingMiddleware) GetItemsBroken(ctx context.Context, req GetItemsEndpointRequest) (r GetItemsResponse, err error) {
    if shouldLog(err, mw) { // err is ALWAYS nil here
        defer func(begin time.Time) {
            mw.logger.Log("method", "GetItemsBroken", ...)
        }(time.Now())
    }
    return mw.next.GetItems(ctx, req)
}

func shouldLog(err error, mw loggingMiddleware) bool {
    return err != nil || mw.next.GetConfig().GetBool("debug")
}
```

## Correct Request Struct Pattern

```go
type GetItemsEndpointRequest struct {
    ResourceId          string              `json:"resourceId" log:"true"`
    Query               string              `json:"query" log:"true"`
    Category            string              `json:"category" log:"true"`
    State               string              `json:"state" log:"true"`
    IncludeAll          bool                `json:"includeAll" log:"true"`
    logging.RequestInfo `json:"-" log:"true"` // captures TraceId, SpanId, Branch, XRealIP
}
```

## Correct Transport Decode Pattern

```go
func decodeGetItems(ctx context.Context, r *http.Request) (interface{}, error) {
    vars := mux.Vars(r)
    return GetItemsEndpointRequest{
        ResourceId:  vars["resourceId"],
        Query:       r.URL.Query().Get("query"),
        RequestInfo: logging.GetRequestInfo(ctx, r), // populate trace headers
    }, nil
}
```

## `log:"true"` Field Guidelines

**Include `log:"true"` on:**
- Resource IDs, entity IDs, correlation IDs, request identifiers
- Category, state, region, branch, or other routing/classification fields
- Boolean flags that affect behavior (e.g., `IncludeAll`, `Verbose`)
- Embedded `logging.RequestInfo`
- Nested structs that contain identifiers (the nested struct also needs `log:"true"` on its fields)

**Omit `log:"true"` from:**
- Large arrays or collections (use a count field instead if needed)
- Sensitive PII: passwords, full credit card numbers, SSNs, full email addresses
- Raw binary data, base64 blobs
- Internal cache keys, internal routing tokens
- Fields already serialized at a higher level
