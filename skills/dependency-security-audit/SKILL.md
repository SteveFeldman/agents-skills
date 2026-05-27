---
name: dependency-security-audit
description: Use when reviewing Dependabot alerts, npm audit findings, govulncheck output, or CVE reports on a JavaScript/Node.js or Go project — especially when triaging multiple alerts across direct and transitive dependencies to assess real-world risk and produce a remediation plan.
---

# Dependency Security Audit

## Overview

Turns raw Dependabot/audit alerts into an actionable report: per-CVE risk scoring, short-term patches, long-term remediation, and functional test guidance.

**Supported ecosystems:** JavaScript/Node.js (npm) · Go

**Critical insight:** Dependabot scans the **base branch lock file**, not your working branch. Always verify what's installed on the base branch before assessing status — a pending PR may have already fixed several alerts, or may have missed ones that look resolved locally.

For language-specific commands, see:
- `npm-guide.md` — npm data gathering, overrides, version verification
- `go-guide.md` — govulncheck, replace directives, `go get`, module tracing

---

## Phase 1 — Data Gathering

**Step 1 — Fetch all open alerts (same for both ecosystems):**
```bash
gh api 'repos/ORG/REPO/dependabot/alerts?per_page=50&state=open' | jq '[.[] | {
  number: .number,
  severity: .security_vulnerability.severity,
  ecosystem: .security_vulnerability.package.ecosystem,
  package: .security_vulnerability.package.name,
  vulnerable_range: .security_vulnerability.vulnerable_version_range,
  patched: .security_vulnerability.first_patched_version.identifier,
  scope: .dependency.scope,
  cve: .security_advisory.cve_id,
  summary: .security_advisory.summary
}]'
```

**Step 2 — Check what's actually installed on the BASE branch:**
This is Dependabot's source of truth. See language guides for commands.

**Step 3 — Trace every flagged package's origin:**
Determines whether it's direct or transitive, and who owns the fix. See language guides.

**Step 4 — Check existing patches/overrides:**
See language guides for how to inspect current override/replace state.

---

## Phase 2 — Classification

Answer these four questions for every alert before scoring risk:

| Question | Why it matters |
|----------|----------------|
| Is installed version in the vulnerable range? | If not → false positive; dismiss, no code change needed |
| Scope: runtime or dev/test-only? | Dev-only drops adjusted risk 2 levels |
| App type: browser-only, SSR/server, CLI, or library? | Determines which CVE attack vectors are reachable |
| Direct dep or transitive? Who is the parent? | Determines the correct remediation owner and path |

**Go-specific classification note:** `govulncheck` is call-graph aware — it only reports a vulnerability if the vulnerable function is actually reachable from your code. An installed vulnerable package that is never called through to the vulnerable code path will not appear in `govulncheck ./...`. This fundamentally changes triage: a govulncheck finding is harder to dismiss than a Dependabot alert.

**npm-specific classification note:** `npm audit` reports any installed version in the vulnerable range regardless of whether the vulnerable code path is called. Always check `dependency.scope` in the Dependabot API response — `development` scope is dev/test toolchain only.

**Attack surface by CVE type and app context:**

| CVE type | Browser-only SPA | SSR/Node server | Go server/service | CLI tool |
|----------|-----------------|-----------------|-------------------|----------|
| XSS/HTML injection | Full severity | Lower (server controls output) | N/A | N/A |
| DoS (process crash) | Low (no persistent process) | Full severity | Full severity | Low |
| Memory disclosure | Low | Full severity | Full severity | Low |
| Path traversal | Low | Full severity | Full severity | Medium |
| Arbitrary code execution | Full | Full | Full | Full |

---

## Phase 3 — Risk Scoring

Produce an **Adjusted Risk** for each alert:

| Factor | Modifier |
|--------|----------|
| CVSS CRITICAL | Base: CRITICAL |
| CVSS HIGH | Base: HIGH |
| CVSS MEDIUM | Base: MEDIUM |
| CVSS LOW | Base: LOW |
| Scope: dev/test-only (npm) | −2 levels |
| CVE not reachable in app context | −1 level |
| govulncheck does NOT report it (Go) | −1 level (but do not dismiss entirely) |
| No known public exploit | −1 level |
| Fix requires breaking major version jump | flag as +complexity (not a risk modifier) |

**Status values for the scorecard:**
`FIXED-IN-PR` · `NEEDS-PATCH` · `NEEDS-PARENT-UPGRADE` · `BLOCKED-ON-TEAM` · `FALSE-POSITIVE` · `NOT-REACHABLE`

---

## Phase 4 — Short-Term Patch

Both ecosystems support a "patch without fixing the root cause" approach. **Neither is a substitute for long-term remediation — every patch applied must be documented with a Patch Assessment block and an expiry condition.**

**npm:** `"overrides"` block in `package.json`. See `npm-guide.md`.

**Go:** `replace` directive in `go.mod`. See `go-guide.md`.

### Required: Patch Assessment Block

Every finding that applies a patch must include this block in the report:

```
Patch type:         npm override / Go replace / explicit require pin
Version jump:       X.Y.Z → X.Y.Z+1  (patch / minor / major)
Jump risk:          Low / Medium / High
What could break:   [specific APIs, behaviors, or downstream consumers at risk]
Patch regression:   [the one command that proves the patch didn't break anything]
Expiry condition:   Remove when [owning package] releases [version] natively
```

The **expiry condition** is mandatory. A patch without one will be forgotten and accumulate as technical debt that obscures future vulnerability tracking.

### Version Jump Risk (applies to both ecosystems)

| Jump type | Risk | Rule |
|-----------|------|------|
| Patch (1.2.3 → 1.2.4) | 🟢 Low | Apply directly |
| Minor (1.2.x → 1.3.x) | 🟢 Usually low | Skim changelog for removed APIs |
| Major, dev/test-only | 🟡 Medium | Check how parent calls the patched API; run test suite |
| Major, runtime/server | 🔴 High | Verify API compatibility before applying; document call sites in Appendix |
| Widely-shared package (uuid, semver, encoding/json wrappers) | 🔴 High | Scope the override to the parent; global override can silently break many consumers |

---

## Phase 5 — Long-Term Remediation

| Origin type | Correct fix |
|-------------|-------------|
| Direct dep | Bump version constraint directly in `package.json` / `go.mod` |
| Transitive from internal team package | File issue with owning team; use patch as bridge |
| Transitive from external OSS | Open issue/PR upstream; patch until merged |
| Exact-pinned transitive | Upgrade the pinning parent; coordinate with owner |
| Dev/test-only dep | Lower urgency; track in backlog |

---

## Phase 6 — Testing Guidance

### Pre-patch (prove exploitability)
Only attempt for runtime CVEs with a documented trigger. Skip for dev-only scope or when app architecture makes the vector impossible.

- **DoS:** Attempt the documented crash trigger against a local server instance
- **XSS:** Send the payload through the input path in a test environment
- **Path traversal:** Attempt the traversal sequence against a local endpoint

### Post-patch (always required)

**Step 1 — confirm patched version is installed.** See language guides for commands.

**Step 2 — functional test by package role:**

| Package role | What to test |
|-------------|--------------|
| HTML sanitizer | Render user/CMS content; no XSS passthrough, no over-stripping |
| Query string / URL parser | Serialize → parse roundtrip with nested and array params |
| WebSocket / connection lib | Run test suite exercising WS connections or HTTP proxy |
| UUID / ID generator | Render components using it; aria attributes populated |
| Temp file utility | Run e2e test suite that writes test artifacts |
| Glob / pattern matcher | Run lint and build end-to-end |
| gRPC / proto serializer | Start server; verify telemetry spans export without errors |
| Tracing / metrics SDK | Server starts; healthcheck responds; trace appears in collector |
| HTTP client / transport | Integration test that makes an outbound request |
| Crypto / TLS library | Run any test that exercises TLS handshake or signature verification |
| JSON / YAML parser | Parse valid and edge-case documents without panic or data loss |
| Auth / JWT library | Run auth integration tests; tokens must validate correctly |

**Step 3 — regression check.** See language guides for exact commands.

---

## Common Mistakes

| Mistake | Reality |
|---------|---------|
| Verifying version in local files before reinstalling dependencies | Lock file may have changed; always reinstall first |
| Adding a patch for a false positive | Check installed version vs vulnerable range first; dismiss in GitHub if outside range |
| Global major-version override of a widely-shared package | Can silently break multiple consumers; scope the override to the parent |
| Treating `scope: development` as zero risk | Dev-only DoS can kill CI; test tooling XSS can leak env vars |
| Patching without checking a pending PR | The PR branch lock file may already resolve several alerts |
| (Go) Dismissing a Dependabot alert because govulncheck doesn't flag it | govulncheck reflects current call graph; future code changes could make it reachable |
| (Go) Running `go mod tidy` after a `replace` without verifying the replace still applies | `go mod tidy` can remove replace directives it considers unused |

---

## Report Output

Use `report-template.md` in this directory.

Minimum viable report sections:
1. **Executive summary** — counts by severity and status per ecosystem
2. **Risk scorecard** — one row per alert with adjusted risk and status
3. **Detailed findings** — per-alert: purpose, origin chain, CVE, adjusted risk, short-term patch, long-term fix, test guidance
4. **Remediation plan** — short-term (patch checklist) and long-term (owner + action + blocker)
5. **Appendix** — override/replace safety justifications for major-version jumps
