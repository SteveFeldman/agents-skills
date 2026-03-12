---
name: otel-trace-analysis
description: Analyze OpenTelemetry traces for latency issues, error diagnosis, retry patterns, dependency bottlenecks, and trace integrity problems. Use when the user provides OTEL trace JSON files or asks about distributed system performance issues.
user_invocable: true
---

# OpenTelemetry Trace Analysis Skill

Interpret, diagnose, and explain OpenTelemetry (OTEL) traces from distributed systems. Focus on latency analysis, error diagnosis, retry behavior, dependency bottlenecks, and trace integrity issues.

**CRITICAL: Deep Dive (Full Analysis) is the DEFAULT. Never take shortcuts unless explicitly requested.**

---

## Analysis Modes

### Deep Dive Mode (DEFAULT)

**This is the default mode. Always use Deep Dive unless the user explicitly requests Triage.**

Deep Dive requires ALL of the following steps and output sections. Do NOT skip, summarize, or abbreviate any section:

**Required Steps:**
1. **Ingest & normalize** — Detect schema version, extract all spans
2. **Build span graph** — Tree structure + cross-links
3. **Integrity check** — Orphans, missing parents, sampling artifacts, duplicate IDs
4. **Critical path analysis** — With self-time and waiting-time breakdown
5. **Error analysis** — Categorize ALL errors: root cause, propagated, masked, expected
6. **Pattern detection** — Retries, timeouts, fan-out, circuit breakers
7. **Timing anomalies** — Async tails, child outliving parent, clock skew
8. **Dependency map** — Service-to-service call summary with latency stats
9. **Full report** — Evidence-backed hypotheses with span IDs and exact values

**Required Output Sections (ALL 10 are MANDATORY):**
1. Scorecard
2. Dependency Summary Table
3. Summary
4. Key Observations (with specific values, counts, durations)
5. Critical Path (tree diagram with timing breakdown)
6. Error Analysis (all 4 categories)
7. Timing Anomalies
8. Retry Patterns
9. Likely Cause(s)
10. Recommended Actions

---

### Triage Mode (ONLY when explicitly requested)

**Use ONLY when user explicitly says:** "quick", "triage", "summary only", "brief", "60-second answer"

Triage is a SHORTCUT. Never default to it.

1. **Quick stats** — Total duration, span count, error count
2. **Find the bottleneck** — Longest span on critical path
3. **Find the root error** — Deepest span with `status.code=2`
4. **Check for patterns** — Retry signature? Timeout cascade?
5. **Report** — 5-line summary with next step

**Triage Output:**
```
Duration: 3.2s | Spans: 47 | Errors: 2
Bottleneck: "db.query" (2.1s) in orders-service
Root Error: "connection refused" in payments-service
Pattern: Timeout cascade (parent ended before child)
Next: Check payments-service connectivity
```

---

### Mode Selection Rules

| User Command / Phrase | Mode | Description |
|----------------------|------|-------------|
| `/otel-trace-analysis <file>` | **Deep Dive** | Full analysis with all 10 sections |
| "analyze this trace" | **Deep Dive** | Full analysis |
| "what happened?" | **Deep Dive** | Full analysis |
| "investigate" | **Deep Dive** | Full analysis |
| "deep dive" | **Deep Dive** | Full analysis |
| "full analysis" | **Deep Dive** | Full analysis |
| (no specific mode requested) | **Deep Dive** | Full analysis (DEFAULT) |
| "quick" | Triage | 5-line summary only |
| "triage" | Triage | 5-line summary only |
| "brief" | Triage | 5-line summary only |
| "summary only" | Triage | 5-line summary only |
| "60 seconds" | Triage | 5-line summary only |

**NEVER take shortcuts unless explicitly asked. When in doubt, use Deep Dive.**

---

## Trace JSON Structure

OTEL traces use this hierarchical format:

```json
{
  "batches": [
    {
      "resource": {
        "attributes": [
          {"key": "service.name", "value": {"stringValue": "my-service"}},
          {"key": "telemetry.sdk.language", "value": {"stringValue": "go"}}
        ]
      },
      "instrumentationLibrarySpans": [
        {
          "instrumentationLibrary": {
            "name": "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp",
            "version": "0.60.0"
          },
          "spans": [/* array of span objects */]
        }
      ]
    }
  ]
}
```

### Schema Variants

OTEL JSON exports come in two schema versions:

| Version | Top-Level Key | Span Container | Status |
|---------|--------------|----------------|--------|
| OTLP v0.x | `batches` | `instrumentationLibrarySpans` | Common (your current traces) |
| OTLP v1.x | `resourceSpans` | `scopeSpans` | Newer standard |

**Detection logic:**
```javascript
// Detect schema version
const isLegacy = trace.batches !== undefined;
const isModern = trace.resourceSpans !== undefined;

// Normalize to common accessor
const getSpans = (trace) => {
  if (trace.batches) {
    return trace.batches.flatMap(b =>
      b.instrumentationLibrarySpans?.flatMap(ils => ils.spans) ?? []
    );
  }
  if (trace.resourceSpans) {
    return trace.resourceSpans.flatMap(rs =>
      rs.scopeSpans?.flatMap(ss => ss.spans) ?? []
    );
  }
  return [];
};
```

**Analysis tip:** Always check which schema you have before running jq commands. The skill's jq examples use the legacy format; adapt paths for modern format.

### Span Structure

```json
{
  "traceId": "70eca60a2b3a542769facb8874e621fd",
  "spanId": "03731dffbdf4129e",
  "parentSpanId": "30f2d4a18f3512cd",
  "name": "GET /api/users",
  "kind": "SPAN_KIND_SERVER",
  "startTimeUnixNano": 1771599406034000000,
  "endTimeUnixNano": 1771599416167578000,
  "attributes": [
    {"key": "http.method", "value": {"stringValue": "GET"}},
    {"key": "http.status_code", "value": {"intValue": 200}}
  ],
  "status": {"code": 0, "message": ""},
  "events": [
    {
      "name": "exception",
      "timeUnixNano": 1771599416167000000,
      "attributes": [
        {"key": "exception.type", "value": {"stringValue": "*errors.Error"}},
        {"key": "exception.message", "value": {"stringValue": "connection refused"}}
      ]
    }
  ]
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `traceId` | Unique ID linking all spans in a distributed trace |
| `spanId` | Unique ID for this span |
| `parentSpanId` | ID of parent span (empty/missing for root spans) |
| `name` | Operation name |
| `kind` | Span type (see Span Kinds) |
| `startTimeUnixNano` / `endTimeUnixNano` | Timing in nanoseconds since Unix epoch |
| `attributes` | Key-value pairs with operation details |
| `status.code` | 0=UNSET, 1=OK, 2=ERROR |
| `status.message` | Error description when code=2 |
| `events` | Timestamped events (exceptions, logs) |
| `droppedAttributesCount` | Indicates truncation if >0 |

### Attribute Value Types

Attributes use typed values:
```json
{"key": "http.method", "value": {"stringValue": "GET"}}
{"key": "http.status_code", "value": {"intValue": 200}}
{"key": "cache.hit", "value": {"boolValue": true}}
{"key": "db.rows_affected", "value": {"intValue": 5}}
```

---

## Span Kinds

| Kind | Meaning | Examples |
|------|---------|----------|
| `SPAN_KIND_SERVER` | Handler for incoming request | HTTP server endpoint, gRPC server method |
| `SPAN_KIND_CLIENT` | Initiator of outgoing request | HTTP client call, database query, gRPC client |
| `SPAN_KIND_INTERNAL` | Internal operation | Business logic, local processing |
| `SPAN_KIND_PRODUCER` | Message queue producer | Kafka produce, RabbitMQ publish |
| `SPAN_KIND_CONSUMER` | Message queue consumer | Kafka consume, RabbitMQ subscribe |
| `null` | Unspecified (treat as INTERNAL) | Legacy instrumentation |

**Analysis tip:** CLIENT spans calling external services often dominate latency. SERVER spans show where time is spent handling requests.

**Numeric Span Kinds (some exporters):**

Some exporters use numeric enums instead of strings:
| Numeric | String Equivalent |
|---------|------------------|
| 0 | `SPAN_KIND_UNSPECIFIED` |
| 1 | `SPAN_KIND_INTERNAL` |
| 2 | `SPAN_KIND_SERVER` |
| 3 | `SPAN_KIND_CLIENT` |
| 4 | `SPAN_KIND_PRODUCER` |
| 5 | `SPAN_KIND_CONSUMER` |

**Note:** Your current traces use string constants. Handle both formats:
```javascript
const normalizeKind = (kind) => {
  if (typeof kind === 'number') {
    return ['UNSPECIFIED','INTERNAL','SERVER','CLIENT','PRODUCER','CONSUMER'][kind] || 'UNKNOWN';
  }
  return kind?.replace('SPAN_KIND_', '') || 'INTERNAL';
};
```

---

## Resource Attributes

Resource attributes identify the service instance:

| Attribute | Description |
|-----------|-------------|
| `service.name` | Service identifier (most important) |
| `service.namespace` | Service grouping |
| `service.version` | Deployment version |
| `telemetry.sdk.language` | go, nodejs, java, python, etc. |
| `telemetry.sdk.name` | Usually "opentelemetry" |
| `telemetry.sdk.version` | SDK version |
| `k8s.cluster.name` | Kubernetes cluster |
| `k8s.namespace.name` | Kubernetes namespace |
| `k8s.pod.name` | Pod name |
| `cloud.provider` | gcp, aws, azure |
| `cloud.platform` | gcp_kubernetes_engine, aws_eks, etc. |
| `host.name` | Host identifier |
| `process.runtime.name` | Runtime (nodejs, go, java) |

---

## Common Span Attribute Patterns

### HTTP Spans

| Attribute | Description |
|-----------|-------------|
| `http.method` | GET, POST, PUT, DELETE |
| `http.route` | URL pattern (`/users/:id`) |
| `http.target` | Full path with query |
| `http.url` | Complete URL |
| `http.status_code` | Response code (200, 404, 500) |
| `http.status_text` | "OK", "Not Found" |
| `http.host` | Target host |
| `http.user_agent` | Client user agent |
| `http.request_content_length` | Request body size |
| `http.response_content_length` | Response body size |
| `net.peer.name` | Remote hostname |
| `net.peer.port` | Remote port |
| `net.peer.ip` | Remote IP |

### Database Spans

| Attribute | Description |
|-----------|-------------|
| `db.system` | mysql, postgresql, redis, mongodb |
| `db.name` | Database name |
| `db.operation` | SELECT, INSERT, UPDATE, DELETE |
| `db.statement` | SQL query (may be sanitized) |
| `db.sql.table` | Table name |
| `db.rows_affected` | Rows modified |
| `db.connection_string` | Connection info (sanitized) |

### gRPC/RPC Spans

| Attribute | Description |
|-----------|-------------|
| `rpc.system` | grpc, jsonrpc |
| `rpc.service` | Service name |
| `rpc.method` | Method name |
| `rpc.grpc.status_code` | gRPC status |

### Messaging Spans

| Attribute | Description |
|-----------|-------------|
| `messaging.system` | kafka, rabbitmq, sqs |
| `messaging.destination` | Queue/topic name |
| `messaging.operation` | send, receive, process |
| `messaging.message_id` | Message identifier |

### Network Spans

| Attribute | Description |
|-----------|-------------|
| `net.transport` | ip_tcp, ip_udp |
| `net.host.name` | Local hostname |
| `net.host.port` | Local port |
| `tls.protocol` | TLSv1.2, TLSv1.3 |
| `tls.cipher.name` | Cipher suite |

### Attribute Resolution (Old vs New Conventions)

OTEL semantic conventions evolved. Traces often contain BOTH old and new attribute names. Use this resolution order:

#### HTTP Attributes
| Canonical | Check First (New) | Fallback (Old) |
|-----------|------------------|----------------|
| Status Code | `http.response.status_code` | `http.status_code` |
| Method | `http.request.method` | `http.method` |
| Body Size | `http.response.body.size` | `http.response_content_length` |
| URL Path | `url.path` | `http.target` |
| URL Scheme | `url.scheme` | `http.scheme` |

#### Network/Peer Attributes
| Canonical | Check First (New) | Fallback (Old) |
|-----------|------------------|----------------|
| Server Address | `server.address` | `net.peer.name` → `http.host` |
| Server Port | `server.port` | `net.peer.port` |
| Client Address | `client.address` | `net.sock.peer.addr` → `net.peer.ip` |

#### Resolution Helper
```javascript
// Get HTTP status code from span attributes
const getHttpStatus = (attrs) => {
  const find = (key) => attrs.find(a => a.key === key)?.value?.intValue;
  return find('http.response.status_code') ?? find('http.status_code');
};

// Get peer/server address
const getPeerAddress = (attrs) => {
  const find = (key) => attrs.find(a => a.key === key)?.value?.stringValue;
  return find('server.address') ?? find('net.peer.name') ?? find('http.host');
};
```

**Analysis tip:** Your traces show mixed conventions (e.g., `http.status_code` alongside `http.response.status_code`). Always check both.

---

## Common Instrumentation Libraries

| Library | Language | Span Patterns |
|---------|----------|---------------|
| `otelhttp` | Go | HTTP client/server spans |
| `@opentelemetry/instrumentation-express` | Node.js | `middleware - *` spans |
| `@opentelemetry/instrumentation-http` | Node.js | HTTP client/server |
| `io.opentelemetry.tomcat-*` | Java | Servlet container spans |
| `io.opentelemetry.jdbc` | Java | Database spans |
| `otelgorm` | Go | GORM database spans |
| `redisotel` | Go | Redis spans |

### Express Middleware Spans (Node.js)

Express instrumentation creates spans for each middleware:
```
middleware - query         (URL parsing)
middleware - expressInit   (Express setup)
middleware - cookieParser  (Cookie handling)
middleware - cors          (CORS)
middleware - jsonParser    (Body parsing)
middleware - <anonymous>   (Custom middleware)
request handler - /path    (Route handler)
```

**Analysis tip:** Middleware spans are typically <1ms. The `request handler` or custom middleware spans contain the actual work.

### Database ORM Spans

ORMs like GORM create spans per query:
```
gorm.Query                 (Generic query)
gorm.Row                   (Single row)
SELECT tablename           (Table-specific)
UPDATE tablename           (Updates)
INSERT tablename           (Inserts)
```

---

## Status Codes and Errors

### Status Code Meanings

| Code | Name | Meaning |
|------|------|---------|
| 0 | UNSET | No explicit status (usually OK) |
| 1 | OK | Explicitly successful |
| 2 | ERROR | Operation failed |

### Exception Events

Errors often include exception events:
```json
{
  "name": "exception",
  "attributes": [
    {"key": "exception.type", "value": {"stringValue": "TimeoutError"}},
    {"key": "exception.message", "value": {"stringValue": "context deadline exceeded"}},
    {"key": "exception.stacktrace", "value": {"stringValue": "..."}}
  ]
}
```

### Common Error Patterns

| Error Message Pattern | Likely Cause |
|----------------------|--------------|
| `context deadline exceeded` | Upstream timeout |
| `context canceled` | Caller canceled request |
| `connection refused` | Target service down |
| `connection reset` / `ECONNRESET` | Connection dropped |
| `no such host` | DNS resolution failed |
| `certificate` errors | TLS/SSL issues |
| `max concurrency` / `circuit open` | Circuit breaker tripped |
| `timeout` | Operation exceeded time limit |
| `rate limit` / `429` | Throttling |
| `not found` / `404` | Resource doesn't exist (may be expected) |

### Error Propagation

Errors propagate up the span tree:
1. **Root cause:** Deepest span with `status.code=2`
2. **Propagated errors:** Parent spans that fail because child failed
3. **Independent errors:** Multiple unrelated failures

**Analysis tip:** Always find the deepest error first — that's usually the root cause.

---

## Analysis Techniques

### Duration Calculation

```javascript
const durationMs = (endTimeUnixNano - startTimeUnixNano) / 1_000_000;
const durationSeconds = durationMs / 1000;
```

### Finding Root Spans

Root spans have empty or missing `parentSpanId`:
```bash
jq '.batches[].instrumentationLibrarySpans[].spans[] |
  select(.parentSpanId == "" or .parentSpanId == null)' trace.json
```

### Building Span Tree

1. Index spans by `spanId`
2. Group children by `parentSpanId`
3. Start from root span, recurse through children

### Critical Path Analysis

The critical path is the chain of spans determining end-to-end latency. The naive algorithm ("pick child with latest end time") can fail with:
- Overlapping parallel spans
- Async spans extending beyond parent
- Clock skew between services

**Correct Algorithm:**

1. **Build span intervals**: For each span, record `[start, end, duration, selfTime]`
2. **Calculate self-time**: `selfTime = duration - sum(overlapping child durations)`
3. **Find critical chain**: Starting from root, at each level pick the child that:
   - Has the latest `endTime` AND
   - Contributes most to parent's duration (not just longest child)
4. **Handle async**: If child ends after parent, note as "async tail" (not blocking)

```javascript
// Improved critical path detection
const findCriticalPath = (spans, rootId) => {
  const byId = new Map(spans.map(s => [s.spanId, s]));
  const children = new Map();

  spans.forEach(s => {
    if (!children.has(s.parentSpanId)) children.set(s.parentSpanId, []);
    children.get(s.parentSpanId).push(s);
  });

  const path = [];
  let current = byId.get(rootId);

  while (current) {
    path.push(current);
    const kids = children.get(current.spanId) || [];

    // Filter out async tails (child ends after parent)
    const blocking = kids.filter(k => k.endTimeUnixNano <= current.endTimeUnixNano);

    // Pick child with latest end time among blocking children
    current = blocking.sort((a, b) =>
      Number(b.endTimeUnixNano - a.endTimeUnixNano)
    )[0];
  }

  return path;
};
```

**Output critical path with timing breakdown:**
```
Critical Path (3.2s total):
  orders-api       [self: 50ms, waiting: 3150ms]
  └─> payments     [self: 100ms, waiting: 2000ms] ← 66% of total
      └─> db.query [self: 15ms] (leaf)
```

### Self-Time Calculation

Self-time = span duration minus children's durations
```
selfTime = duration - sum(child.duration for all children)
```

High self-time indicates work done in that span itself.
Low self-time with high duration indicates waiting for children.

---

## Integrity Checks

### Missing Parent Spans

If `parentSpanId` references a non-existent span:
- Trace is incomplete (sampling artifact)
- Cross-service propagation failed
- Spans from different trace accidentally merged

### Orphan Spans

Spans disconnected from the root:
- Check for multiple root spans (multiple trees)
- Look for broken `parentSpanId` chains

### Timing Anomalies

- Child span starts before parent: Clock skew between services
- Child span ends after parent: Async operation or clock skew
- Zero-duration spans: Instant operations (often middleware)
- Negative duration: Data corruption

### Duplicate Span IDs

If multiple spans share the same `spanId`:
- Bad exporter or collector bug
- Accidental trace merge
- **Action:** Report as data quality issue, analyze each duplicate separately

```bash
# Detect duplicate spanIds
jq -r '[.batches[].instrumentationLibrarySpans[].spans[].spanId] |
  group_by(.) | map(select(length > 1) | .[0])' trace.json
```

### Multiple Trace IDs

If spans have different `traceId` values:
- Accidental file merge
- Collector concatenation bug
- **Action:** Split into separate traces, analyze independently

```bash
# Check for multiple traceIds
jq -r '[.batches[].instrumentationLibrarySpans[].spans[].traceId] | unique' trace.json
```

### Broken Cross-Service Propagation

Signs of propagation failure:
- Service A has CLIENT span calling Service B
- Service B has no corresponding SERVER span with matching parent
- **Cause:** Context propagation headers not forwarded

```bash
# Find CLIENT spans without corresponding SERVER children
jq -r '
  [.batches[].instrumentationLibrarySpans[].spans[]] as $all |
  ($all | map(.spanId) | unique) as $ids |
  $all[] |
  select(.kind == "SPAN_KIND_CLIENT") |
  select([.spanId] as $parent | $all | map(select(.parentSpanId == $parent[0])) | length == 0) |
  {name, spanId, "missing_child": true}
' trace.json
```

### Sampling Artifacts vs Instrumentation Gaps

| Indicator | Likely Sampling | Likely Instrumentation Gap |
|-----------|----------------|---------------------------|
| Random spans missing | Probabilistic sampling | No |
| Entire service missing | Tail sampling excluded | Missing SDK setup |
| First N spans only | Head sampling limit | No |
| Only error spans present | Error-biased sampling | No |
| Internal spans missing but CLIENT/SERVER present | No | Auto-instrumentation only |

**Analysis tip:** Check `telemetry.sdk.*` attributes to identify uninstrumented services.

---

## Analysis Helpers

### jq Commands (Optional)

These commands require `jq` to be installed. They're provided as convenience helpers, not requirements. The analysis logic above should be applied regardless of tooling.

**Note:** These examples use the legacy `batches[].instrumentationLibrarySpans` path. For modern OTLP (`resourceSpans[].scopeSpans`), adapt paths accordingly.

### Basic Stats

```bash
# Total spans
jq '[.batches[].instrumentationLibrarySpans[].spans[]] | length' trace.json

# Unique services
jq -r '.batches[].resource.attributes[] |
  select(.key == "service.name") | .value.stringValue' trace.json | sort -u

# Span kinds distribution
jq -r '.batches[].instrumentationLibrarySpans[].spans[].kind' trace.json |
  sort | uniq -c | sort -rn
```

### Error Analysis

```bash
# All error spans
jq '.batches[].instrumentationLibrarySpans[].spans[] |
  select(.status.code == 2) | {name, message: .status.message}' trace.json

# Exception messages
jq -r '.batches[].instrumentationLibrarySpans[].spans[].events[]? |
  select(.name == "exception") | .attributes[] |
  select(.key == "exception.message") | .value.stringValue' trace.json
```

### Latency Analysis

```bash
# Slowest spans
jq -r '.batches[].instrumentationLibrarySpans[].spans[] |
  "\(.name)|\(((.endTimeUnixNano - .startTimeUnixNano) / 1000000 | floor))ms"' trace.json |
  sort -t'|' -k2 -rn | head -10

# Spans over 1 second
jq '.batches[].instrumentationLibrarySpans[].spans[] |
  select(((.endTimeUnixNano - .startTimeUnixNano) / 1000000) > 1000) |
  {name, duration_ms: ((.endTimeUnixNano - .startTimeUnixNano) / 1000000)}' trace.json
```

### HTTP Analysis

```bash
# HTTP status codes
jq -r '.batches[].instrumentationLibrarySpans[].spans[].attributes[]? |
  select(.key == "http.status_code") | .value.intValue' trace.json |
  sort | uniq -c | sort -rn

# Failed HTTP requests (4xx, 5xx)
jq '.batches[].instrumentationLibrarySpans[].spans[] |
  select(.attributes[]? | select(.key == "http.status_code" and .value.intValue >= 400))' trace.json
```

### Service Dependencies

```bash
# Outbound calls (CLIENT spans with peer info)
jq -r '.batches[].instrumentationLibrarySpans[].spans[] |
  select(.kind == "SPAN_KIND_CLIENT") | .attributes[]? |
  select(.key == "net.peer.name" or .key == "http.host") |
  .value.stringValue' trace.json | sort | uniq -c | sort -rn
```

---

## Output Format

**CRITICAL: All 10 sections below are REQUIRED for Full Analysis. Do NOT skip, summarize, or combine sections.**

---

### Section 1: Scorecard (REQUIRED)

Always include first. Must have ALL fields:

```
┌─────────────────────────────────────────────────┐
│ TRACE SCORECARD                                 │
├─────────────────────────────────────────────────┤
│ Trace ID:    70eca60a2b3a5427...                │
│ Duration:    3.2s                               │
│ Spans:       47 (3 errors)                      │
│ Services:    4 (orders, payments, inventory, db)│
│ Bottleneck:  db.query (2.1s, 66% of total)      │
│ Root Error:  connection refused @ payments      │
│ Completeness: Complete (no orphans)             │
│ Confidence:  HIGH                               │
└─────────────────────────────────────────────────┘
```

**Confidence Levels:**
- **HIGH**: Complete trace, clear root cause, single failure mode
- **MEDIUM**: Minor gaps, multiple possible causes
- **LOW**: Significant sampling, broken chains, ambiguous errors

---

### Section 2: Dependency Summary Table (REQUIRED)

Include for ALL traces with 2+ services:

```
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE DEPENDENCIES                                            │
├──────────────┬──────────────┬───────┬─────────┬────────┬────────┤
│ From         │ To           │ Calls │ p50     │ Max    │ Errors │
├──────────────┼──────────────┼───────┼─────────┼────────┼────────┤
│ orders       │ payments     │ 3     │ 45ms    │ 2100ms │ 1      │
│ orders       │ inventory    │ 1     │ 12ms    │ 12ms   │ 0      │
│ payments     │ db           │ 5     │ 8ms     │ 15ms   │ 0      │
└──────────────┴──────────────┴───────┴─────────┴────────┴────────┘
```

---

### Section 3: Summary (REQUIRED)

2-3 sentences covering:
- Total trace duration and what happened
- Primary bottleneck or issue
- Error status and outcome (did the operation succeed despite errors?)

---

### Section 4: Key Observations (REQUIRED)

Must include ALL of the following with SPECIFIC values (no generalities):

**Span Statistics:**
- Total span count
- Error span count (status.code=2)
- OK span count (status.code=1)

**Span Kind Distribution:**
- SPAN_KIND_CLIENT: X spans
- SPAN_KIND_SERVER: X spans
- SPAN_KIND_INTERNAL: X spans

**HTTP Status Code Distribution:**
| Status | Count |
|--------|-------|
| 200    | X     |
| 4xx    | X     |
| 5xx    | X     |

**Service Span Counts:**
| Service | Spans | Errors |
|---------|-------|--------|
| service-a | X | X |

**Slowest Spans (top 5-10):**
- `span-name`: Xms (service)
- `span-name`: Xms (service)

---

### Section 5: Critical Path (REQUIRED)

Tree diagram with timing breakdown. Include self-time and waiting-time:

```
root-service (total: 3200ms) [self: 50ms, waiting: 3150ms]
  └─> child-service (2100ms) [self: 100ms, waiting: 2000ms] ← ERROR
      └─> db.query (15ms) [self: 15ms] (leaf)
  └─> parallel-service (12ms) [parallel]
```

---

### Section 6: Error Analysis (REQUIRED - ALL 4 categories)

**Root Cause Errors:**
| Span Name | Span ID | Status | Message (verbatim) |
|-----------|---------|--------|-------------------|
| `operation` | abc123 | ERROR | "exact error message" |

**Propagated Errors:**
| Span Name | Span ID | Inherited From |
|-----------|---------|----------------|
| `parent-op` | def456 | `operation` (abc123) |

**Masked Errors (investigate):**
| Span Name | Span ID | Error | Parent Status |
|-----------|---------|-------|---------------|
| `swallowed` | ghi789 | "error msg" | OK |

**Expected Errors (informational):**
| Span Name | Span ID | Message | Why Expected |
|-----------|---------|---------|--------------|
| `lookup` | jkl012 | "404 Not Found" | User lookup, may not exist |

If a category has no entries, explicitly state: "None detected"

---

### Section 7: Timing Anomalies (REQUIRED)

**Async Tails (child outlives parent):**
| Child Span | Parent Span | Outlive Duration |
|------------|-------------|------------------|
| `async-op` (id) | `parent` (id) | Xms |

**Clock Skew:**
| Span | Issue | Delta |
|------|-------|-------|
| `span` | Child starts before parent | Xms |

If none detected, explicitly state: "No timing anomalies detected"

---

### Section 8: Retry Patterns (REQUIRED)

**Detected Retries:**
| Operation | Attempts | Timing (gaps) | Final Outcome |
|-----------|----------|---------------|---------------|
| `operation` | 3 | 100ms, 200ms, 400ms | SUCCESS |

**Retry Analysis:**
- Backoff pattern: exponential / linear / none
- Total retry duration: Xms
- Did retries contribute to critical path?

If no retries detected, explicitly state: "No retry patterns detected"

---

### Section 9: Likely Cause(s) (REQUIRED)

Evidence-backed reasoning. Must include:
- Specific span IDs
- Exact durations
- Verbatim error messages
- Causal chain explanation

Example:
> The root cause is span `abc123` (`getFiservToken`) which took 34,961ms. The parent span `def456` (`payments`) has a 10s timeout, which triggered at 10,004ms while the child was still executing. Evidence: child `endTimeUnixNano` (147290000000) > parent `endTimeUnixNano` (122329000000).

---

### Section 10: Recommended Actions (REQUIRED)

Prioritized with team ownership:

**P0 - Immediate:**
1. Action item with span reference
   - Owner: Team name
   - Evidence: Span ID, duration, error

**P1 - Short Term:**
2. Action item
   - Owner: Team name

**P2 - Medium Term:**
3. Action item

If no actions needed, explain why the trace is healthy.

---

### Appendix: Span References (REQUIRED for complex traces)

| Key Span | Span ID | Service |
|----------|---------|---------|
| Root | abc123 | service-a |
| Error | def456 | service-b |
| Bottleneck | ghi789 | service-c |

---

## Analysis Guardrails

**DO:**
- Calculate actual durations from nanosecond timestamps
- Identify service ownership via `service.name` resource attribute
- Find the deepest error as root cause
- Consider that most spans succeed — errors are notable
- Account for parallel execution when analyzing latency

**DO NOT:**
- Assume all `status.code=2` spans are problems (404 may be expected)
- Ignore the span tree structure
- Make recommendations without evidence from the trace
- Assume single-service architecture
- Treat clock skew as data corruption without checking
- Assume sampling strategy without evidence (head vs tail sampling changes what spans you see)
- Infer vendor-specific behavior from generic OTEL data

---

## Common Failure Patterns

| Pattern | Signature |
|---------|-----------|
| **Timeout cascade** | Parent times out, children show `context canceled` |
| **Retry storm** | Multiple similar spans with increasing start times |
| **Circuit breaker** | `max concurrency` or `circuit open` in error |
| **Downstream failure** | Deepest span errors, parents propagate |
| **Fan-out bottleneck** | Many parallel children, one much slower |
| **Cold start** | First span in service much slower than subsequent |
| **Connection pool exhaustion** | Increasing `tcp.connect` times |
| **DNS issues** | Slow or failed `dns.lookup` spans |
