---
name: grafana
description: "AI-powered observability with Grafana MCP — translates natural language to metrics, logs, and trace queries to diagnose issues like a senior SRE"
---

# grafana.md
## AI-Powered Observability with Grafana + MCP + GPT-5.3 Codex

---

## TL;DR

We are building an **AI-driven observability layer** on top of Grafana using MCP and GPT-5.3 Codex.

This system:
- Translates natural language to observability queries
- Executes queries via MCP
- Correlates metrics, logs, and traces
- Diagnoses issues like a senior SRE
- Recommends next steps

This is not a dashboard system.  
This is a **diagnostic system**.

---

## The Vision

Turn Grafana into:

> A queryable, reasoning-aware observability platform that behaves like a Staff+ engineer.

Instead of:
- Static dashboards
- Manual query writing
- Human-driven triage

We enable:
- Conversational debugging
- Automated root cause analysis
- Cross-signal correlation
- Real-time performance attribution

---

## Architecture Overview

### Components

- **Grafana**
  - Metrics (Prometheus)
  - Logs (Loki or external sources)
  - Traces (Tempo / OpenTelemetry)
- **MCP (Model Context Protocol)**
  - Tooling interface between LLM and Grafana
  - Executes queries
  - Returns structured data
- **GPT-5.3 Codex**
  - Query generator
  - Analyst
  - Diagnostician
  - Decision support system

---

## Core Interaction Model

### Loop

1. User asks question
2. LLM translates intent to query
3. MCP executes query
4. LLM analyzes results
5. LLM drills deeper if needed
6. LLM provides diagnosis and next steps

---

## System Prompt (Codex)

```text
You are an expert Site Reliability Engineer and Observability Architect.

You are connected to Grafana via MCP and have access to:
- Metrics (Prometheus / Grafana)
- Logs (Loki or external sources)
- Traces (Tempo / OpenTelemetry)

Your job is to:
1. Translate user questions into precise queries (PromQL, LogQL, trace queries).
2. Execute queries via MCP tools.
3. Analyze results using:
   - Percentiles (p50, p90, p95, p99)
   - Error rates
   - Throughput (RPS)
   - Latency distribution
4. Correlate across signals (metrics, logs, traces).
5. Identify:
   - Performance bottlenecks
   - Error patterns
   - Rate limiting or retries
   - Cache effectiveness
6. Provide clear, structured insights:
   - What is happening
   - Why it is happening
   - Where it is happening
   - Recommended next steps

Guidelines:
- Always prefer percentile-based analysis over averages.
- When possible, break down by endpoint, service, or dependency.
- Highlight anomalies and regressions.
- Be concise but precise.
- If data is insufficient, propose the next query to run.

Never stop at raw data. Always interpret it like a senior engineer.
```

---

## Domain-Specific Knowledge (Critical)

### System Context

Product Detail Service depends on external APIs (e.g., Kibo).

Observed issues:
- HTTP 429 rate limiting
- Retry amplification
- Cache inefficiency

### Known Failure Patterns

1. **Rate Limiting**
   - 429 responses
   - Retry loops (up to 10 attempts)
   - 5-second delays per retry
   - Leads to extreme p95 latency
2. **Retry Storms**
   - Multiple retries per request
   - Latency amplification (seconds to tens of seconds)
   - Increased downstream pressure
3. **Cache Miss Amplification**
   - Position cache miss
   - Price cache miss
   - Inventory cache miss
   - Leads to increased dependency calls

### Investigation Heuristics

When analyzing latency, always check:
- p95 latency trends
- Error rates (especially 429)
- Retry patterns
- Cache hit ratios
- Dependency latency (Kibo)

Always attempt:
- Attribution (internal vs external latency)
- Correlation (latency vs errors vs retries)

---

## Standard Query Patterns

### Latency (p95)

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

### Error Rate

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Throughput (RPS)

```promql
sum(rate(http_requests_total[1m]))
```

### Dependency Latency (Kibo)

```promql
histogram_quantile(0.95, sum(rate(dependency_duration_seconds_bucket{dependency="kibo"}[5m])) by (le))
```

---

## Investigation Playbooks

### 1) Latency Spike

Steps:
1. Identify time window of spike
2. Compare baseline vs spike
3. Break down by endpoint, service, dependency
4. Check 429 rates, retries, cache hit rate

### 2) Error Increase

Steps:
1. Identify error type (5xx vs 4xx)
2. Break down by endpoint
3. Correlate with deploys, traffic spikes, dependencies

### 3) Cache Effectiveness

Measure:
- Position cache hit
- Position + Price hit
- Inventory hit
- No cache hit

Goal:
- Percent of total requests by cache type

### 4) Dependency Bottleneck

Focus:
- Kibo latency contribution
- Retry patterns
- Correlation with overall latency

---

## Intent Templates (Reduce Hallucination)

### Latency Spike
- Query p95 latency
- Break down by endpoint
- Correlate with errors + dependencies

### Error Increase
- Query error rate
- Group by status code + endpoint

### Throughput Drop
- Query RPS
- Compare time windows

### Cache Effectiveness
- Count cache hit types
- Calculate percentages

### Dependency Bottleneck
- Query downstream latency
- Compare with total latency

---

## Output Format (Mandatory)

All responses must follow:

### Summary
<1-2 sentence explanation>

### What Changed
- p95 latency increased from X to Y
- Time window: ...

### Likely Cause
- Evidence:
  - metric A
  - metric B

### Supporting Data
- Query results summarized

### Next Steps
1. Run this query
2. Investigate this service
3. Apply mitigation

---

## MCP Tooling Pattern

### Example Flow

**Step 1: Query Generation**  
Generate p95 latency for product-detail service over last 24h.

**Step 2: MCP Execution**

```text
query_range(
  datasource="prometheus",
  query="histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service='product-detail'}[5m])) by (le))",
  time_range="last_24h"
)
```

**Step 3: Interpretation**  
Identify spike, compare baseline, drill deeper.

---

## Advanced Capabilities

### 1) Trace + Metrics Correlation

Goal:
- Attribute latency to internal processing vs external dependencies (Kibo)

### 2) Retry Detection

Detect:
- Multiple attempts per request
- Exponential latency patterns

### 3) Cache Analysis

Answer:
- What percent of requests are served from cache?

### 4) Regression Detection

Compare:
- Current vs previous deploy
- Current vs baseline

---

## Example Investigation Prompt

Investigate a latency spike in the product-detail service over the last 24 hours.

Focus on:
- p95 latency trends
- breakdown by endpoint
- correlation with error rates (especially 429s)
- dependency latency (Kibo)

Determine:
1. When the spike occurred
2. Whether it correlates with retries or rate limiting
3. Whether cache effectiveness changed

Provide a root cause hypothesis and next steps.

---

## Strategic Investment Areas

1. **Cross-Signal Correlation**  
   Metrics + logs + traces together
2. **Retry Awareness**  
   Detect retry storms automatically
3. **Cache Intelligence**  
   Make cache effectiveness visible and actionable
4. **Latency Attribution**  
   Internal vs external breakdown

---

## Final Thought

This system is not about querying Grafana.

It is about:

Building an AI system that thinks in systems, not queries.

When done right, this becomes:
- Faster incident response
- Better root cause analysis
- Reduced cognitive load on engineers
- Scalable operational intelligence

---

## Future Direction

- Dedicated agents:
  - Latency Agent
  - Error Agent
  - Cache Agent
- Playbook-driven automation
- Integration with CI/CD for regression detection
- Proactive anomaly detection
