---
name: performance-audit
description: "Analyze codebase for performance bottlenecks across code, database, frontend, network, and async operations"
---

# Performance Audit

Analyze the codebase for performance bottlenecks and optimization opportunities.

## Instructions

Conduct a comprehensive performance audit following these steps:

1. **Technology Stack Analysis**
   - Identify the primary language, framework, and runtime
   - Review build tools and optimization configurations
   - Check for existing performance monitoring (APM, profilers, dashboards)

2. **Code Performance Analysis**
   - Identify inefficient algorithms and data structures (especially O(n^2) or worse)
   - Look for unnecessary computations, redundant operations, and hot loops
   - Review memory allocation patterns and potential leaks
   - Run stack-specific profiling:
     - **Node.js:** `node --prof app.js` then `node --prof-process`
     - **Python:** `python -m cProfile -o output.prof script.py`
     - **Go:** `go tool pprof http://localhost:6060/debug/pprof/profile`
     - **Rust:** `cargo flamegraph`
     - **Java:** `jcmd <pid> JFR.start duration=60s filename=profile.jfr`

3. **Database Performance**
   - Analyze queries for efficiency. Run `EXPLAIN ANALYZE` on slow or suspicious queries
   - Check for missing indexes: look at `WHERE`, `JOIN`, and `ORDER BY` columns
   - Identify N+1 query problems and excessive round-trips
   - Review connection pooling settings and pool utilization
   - Check for table locks, deadlocks, and long-running transactions

4. **Frontend Performance (if applicable)**
   - Run `npx lighthouse --output=json --output-path=./report.json <url>` to audit Core Web Vitals
   - Analyze bundle size: `npx webpack-bundle-analyzer stats.json` or `npx vite-bundle-visualizer`
   - Check for unused code and heavy dependencies (`npx depcheck`)
   - Review render performance: unnecessary re-renders, missing memoization, layout thrashing
   - Check image optimization and lazy loading

5. **Network Performance**
   - Review API call patterns and identify redundant or waterfall requests
   - Check caching strategy: HTTP cache headers, CDN configuration, application-level caching
   - Analyze payload sizes and verify compression (gzip/brotli) is enabled
   - Look for missing pagination on large data sets

6. **Asynchronous Operations**
   - Review async/await usage for accidental serialization of independent operations
   - Check for blocking operations on the main thread or event loop
   - Identify opportunities for parallel execution (`Promise.all`, goroutine fan-out, etc.)
   - Analyze task queue and background job performance

7. **Memory Usage**
   - Check for memory leaks: growing heap over time, unclosed resources, listener accumulation
   - Review garbage collection pressure and large object allocation
   - Identify excessive data retention (caches without TTL, unbounded buffers)
   - Profile with: `node --inspect` (Chrome DevTools), `valgrind`, `go tool pprof /heap`

8. **Build and Deployment Performance**
   - Measure build times and identify slow steps
   - Check tree shaking, code splitting, and dead code elimination
   - Verify dev vs. production optimization flags
   - Review Docker image sizes and layer caching

9. **Performance Monitoring**
   - Check existing metrics and alerting coverage
   - Identify key KPIs: p50/p95/p99 latency, throughput, error rate, saturation
   - Suggest missing instrumentation points

10. **Benchmarking and Profiling**
    - Create benchmarks for critical code paths
    - Measure before and after for any proposed optimization
    - Document performance baselines for future comparison

11. **Optimization Recommendations**
    - Prioritize by impact and effort using the severity format below
    - Provide specific code changes, not just descriptions
    - Suggest architectural improvements for long-term scalability

## Output Format

Rate each finding by severity:

```markdown
### [CRITICAL] N+1 query in OrderService.getAll()
**File:** `src/services/order-service.ts:45`
**Impact:** ~200ms added per request; 2000 extra DB queries under load
**Fix:** Eager-load line items with a JOIN or `include` clause
**Effort:** Low (1-2 hours)

### [HIGH] Uncompressed API responses
**File:** `src/server.ts` (missing middleware)
**Impact:** 3x larger payloads, ~150ms extra on mobile
**Fix:** Add `compression()` middleware
**Effort:** Low (15 minutes)

### [MEDIUM] Synchronous file reads at startup
**File:** `src/config/loader.ts:12`
**Impact:** Adds 400ms to cold start
**Fix:** Switch to async reads or cache after first load
**Effort:** Low (30 minutes)
```

Severity levels:
- **CRITICAL** - Causes outages, timeouts, or order-of-magnitude slowdowns under real load
- **HIGH** - Noticeable user-facing latency or significant resource waste
- **MEDIUM** - Measurable but tolerable; worth fixing in normal development
- **LOW** - Minor inefficiency; fix opportunistically

## Follow-Up

For load testing and validating fixes under realistic traffic, use the `/k6` skill to generate and run load test scripts.
