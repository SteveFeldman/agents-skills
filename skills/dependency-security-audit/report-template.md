# Dependency Security Findings Report

| | |
|---|---|
| **Repo** | `ORG/REPO` |
| **Date** | YYYY-MM-DD |
| **Base branch** | `BRANCHNAME` |
| **Ecosystems** | npm · Go _(remove inapplicable)_ |
| **Pending PR** | #NNN (`BRANCHNAME`) — fixes N of N alerts on merge |

---

## Executive Summary

| Severity | npm | Go | Fixed by PR | Needs Work | False Positive / Not Reachable |
|----------|-----|----|-------------|------------|-------------------------------|
| 🔴 Critical | 0 | 0 | 0 | 0 | 0 |
| 🟠 High     | 0 | 0 | 0 | 0 | 0 |
| 🟡 Medium   | 0 | 0 | 0 | 0 | 0 |
| 🔵 Low      | 0 | 0 | 0 | 0 | 0 |
| **Total**   | | | | | |

> **Adjusted risk** = CVSS modified by scope (npm dev-only: −2 levels), app context (unexploitable vector: −1 level), and reachability (govulncheck silent: −1 level → `NOT-REACHABLE`).

> ⚠️ **Patches ≠ remediation.** Every override or `replace` directive in this report is a temporary measure. The root cause remains until the owning package ships the fix natively. Each finding documents an expiry condition for its patch.

---

## Risk Scorecard

| Alert | Eco | Package | CVE | CVSS | Scope | Adjusted Risk | Patch Applied | Status |
|-------|-----|---------|-----|------|-------|---------------|---------------|--------|
| #NNN | npm | `sanitize-html` | CVE-XXXX | 🔴 CRITICAL | runtime | 🔴 CRITICAL | `2.17.3 → 2.17.4` | `✅ FIXED-IN-PR` |
| #NNN | npm | `tmp`           | CVE-XXXX | 🟠 HIGH     | dev     | 🟡 MEDIUM    | `0.2.3 → 0.2.6`   | `⚠️ NEEDS-PATCH`  |
| #NNN | go  | `golang.org/x/net` | CVE-XXXX | 🟠 HIGH  | runtime | 🟠 HIGH      | `replace → vX.Y.Z` | `⚠️ NEEDS-PATCH` |
| #NNN | go  | `github.com/lib/pq` | CVE-XXXX | 🟡 MEDIUM | runtime | 🔵 LOW     | —                  | `👁 NOT-REACHABLE` |
| #NNN | npm | `diff`          | CVE-XXXX | 🔵 LOW      | dev     | —            | —                  | `❌ FALSE-POSITIVE` |

**Status key:**

| Status | Meaning |
|--------|---------|
| `✅ FIXED-IN-PR`         | Resolved in pending PR lock file; closes on merge |
| `⚠️ NEEDS-PATCH`         | Temporary patch applied or required; long-term fix tracked below |
| `🔄 NEEDS-PARENT-UPGRADE` | Fix requires a parent package to release an update first |
| `🚧 BLOCKED-ON-TEAM`     | Requires coordination with another team before proceeding |
| `👁 NOT-REACHABLE`       | govulncheck confirms vulnerable function not in call graph (Go only); monitor |
| `❌ FALSE-POSITIVE`      | Installed version is outside the vulnerable range; dismiss in GitHub UI |

---

## Detailed Findings

---

### 🔴 [#NNN] `package-name` · CVE-XXXX-XXXXX · CRITICAL → CRITICAL · `✅ FIXED-IN-PR`

**Purpose:** One sentence on what this package does in this project.

#### Origin

| | |
|---|---|
| **Type**                 | Transitive |
| **Chain**                | `root-dep@version` → `intermediate@version` → `package-name@VULNERABLE` |
| **Scope**                | runtime |
| **Base branch version**  | `X.Y.Z` _(vulnerable)_ |
| **First patched version**| `X.Y.Z+1` |

#### govulncheck _(Go only)_

- [ ] 🔴 Reachable — call trace: `main.go:NNN → pkg.VulnerableFunction`
- [ ] 🟢 Not reachable — no call path found in current build

#### Vulnerability

What the CVE enables. What input triggers it. Which code path in this app is exposed.

#### Risk Assessment

| | |
|---|---|
| **CVSS severity**   | CRITICAL |
| **Adjusted risk**   | CRITICAL |
| **Rationale**       | Runtime; attack vector reaches browser/server; no mitigating controls |
| **Exploitable here**| Yes — [specific reason] |

#### Patch Assessment

> ⚠️ **Temporary patch — not full remediation**
>
> This override suppresses the vulnerability but does not fix the root cause.
> `parent-name` still declares the vulnerable version. **Removing this patch
> before the long-term fix lands will re-expose the vulnerability.**

| | |
|---|---|
| **Patch type**           | npm override / Go replace directive / explicit require pin |
| **Version jump**         | `X.Y.Z → X.Y.Z+1` (patch / minor / major) |
| **Jump risk**            | 🟢 Low / 🟡 Medium / 🔴 High |
| **What could break**     | [specific APIs, behaviors, or downstream consumers at risk] |
| **Patch regression test**| [the one command that proves the patch didn't break anything] |
| **Expiry condition**     | Remove when `[owning package]` releases `[version]` natively |

_npm override:_

```json
"overrides": {
  "package-name": "PATCHED_VERSION"
}
```

_Go replace directive:_

```
replace github.com/vulnerable/pkg => github.com/vulnerable/pkg vPATCHED_VERSION
```

#### Long-term Remediation

| | |
|---|---|
| **Owner**   | internal team / upstream OSS |
| **Action**  | [what needs to happen — e.g., "upgrade parent dep to vX" or "upstream PR #NNN"] |
| **Blocker** | none / waiting for release / cross-team coordination |
| **Timeline**| this sprint / next sprint / upstream-dependent |

#### Testing

_Pre-patch — prove exploitability (skip for dev-only or not-reachable):_

```bash
# Attempt the documented trigger in a safe environment
```

_Post-patch — confirm fix and regression:_

```bash
# Version check (npm)
node -e "require('./node_modules/package-name/package.json').version"

# Version check (Go)
go list -m github.com/vulnerable/pkg

# govulncheck must be silent (Go)
govulncheck ./...

# Functional regression — specific to what this package does
[command]
```

> **Expected:** [what correct behavior looks like — e.g., "returns 2.17.4" or "server starts and healthcheck returns 200"]

---

### 🟠 [#NNN] `package-name` · CVE-XXXX-XXXXX · HIGH → MEDIUM · `⚠️ NEEDS-PATCH`

_(repeat the full block above — change severity emoji, status badge, and content per finding)_

---

### ❌ [#NNN] `diff` · CVE-XXXX-XXXXX · LOW · `FALSE-POSITIVE`

**Purpose:** One sentence.

#### Why False Positive

Installed version `8.0.4` is outside the vulnerable range (`≥6.0.0, <8.0.3`). Dependabot flagged a lock file entry that resolved to a safe version.

#### Action

Dismiss alert #NNN in GitHub UI → **Dismiss → Inaccurate / tolerable risk**. No code change needed.

```bash
# Confirm installed version is outside the vulnerable range
node -e "require('./node_modules/diff/package.json').version"
# Expected: 8.0.4  (above the patched floor of 8.0.3)
```

---

## Remediation Plan

### ⚡ Short-term — Patches (this sprint)

> These changes suppress vulnerabilities but are **not permanent fixes**.
> Each patch has an expiry condition documented in the finding above.
> Track removal in the long-term table below.

_npm — add to `package.json` overrides:_

```json
"overrides": {
  "pkg-a": "X.Y.Z",
  "pkg-b": {
    "nested-dep": "X.Y.Z"
  }
}
```

_Go — add to `go.mod`:_

```
replace github.com/pkg/a => github.com/pkg/a vX.Y.Z
require github.com/pkg/b vX.Y.Z // indirect
```

**Checklist:**

- [ ] Add npm overrides → run `npm install` → commit updated `package-lock.json`
- [ ] Add Go directives → run `go mod tidy` → commit updated `go.mod` + `go.sum`
- [ ] Verify npm versions:
  ```bash
  node -e "['pkg-a','pkg-b'].forEach(p => console.log(p, require('./node_modules/'+p+'/package.json').version))"
  ```
- [ ] Verify Go versions:
  ```bash
  go list -m all | grep -E "pkg-a|pkg-b"
  ```
- [ ] `npm test` passes
- [ ] `go test ./...` passes
- [ ] `npm run lint` passes
- [ ] `go build ./...` passes
- [ ] `govulncheck ./...` is clean
- [ ] Smoke test: `[app-specific command]`
- [ ] Dismiss false positive alerts in GitHub UI: #NNN, #NNN

---

### 🔧 Long-term — Proper Remediation

> These are the fixes that allow patches to be **removed**. Until these land, the patches in the table above must stay.

| Package | Eco | Correct fix | Owner | Blocker | Target | Patch to remove |
|---------|-----|-------------|-------|---------|--------|-----------------|
| `pkg-name` | npm | Upgrade `@parent/pkg` to vX      | Team A           | None              | Next sprint       | `"pkg-name": "X.Y.Z"` override |
| `pkg-name` | npm | Component team bumps `uuid`      | TW components    | Cross-team        | Q3                | `"uuid": "^11"` override        |
| `pkg-name` | go  | Upgrade `github.com/direct/dep`  | This team        | None              | Next sprint       | `replace` directive             |
| `pkg-name` | go  | Upstream OSS releases patch      | OSS maintainers  | Awaiting release  | Upstream-dependent| explicit `require` pin          |

---

## Appendix: Patch Safety Justifications

> Required for every major-version patch. Minor/patch-level bumps may be summarized inline in the finding.

---

### npm: `@package/name` — vX.x → vY.0.0

**How the parent package calls it:**

```javascript
import once from '@tootallnate/once';
await once(socket, 'connect');  // only usage in http-proxy-agent@4.x
```

**Breaking changes in vY:**

- [List from changelog — or "none affecting this call site"]

**Patch risk:** 🟢 Low / 🟡 Medium / 🔴 High

**Verdict:** [One sentence — e.g., "Safe — v2 adds TypeScript types and abort signal support; the `once(emitter, event)` call pattern is identical."]

---

### Go: `github.com/pkg/name` — vX.x → vY.0.0

**How the codebase calls it:**

```go
import "github.com/pkg/name"
result := name.DoSomething(ctx, args)
```

**Breaking changes between vX and vY:**

- [Interface changes, import path changes if module v2+, removed functions]

**govulncheck after replace:**

```
govulncheck ./...
→ No vulnerabilities found.
```

**Patch risk:** 🟢 Low / 🟡 Medium / 🔴 High

**Verdict:** [One sentence.]

---

## Notes

- Findings reflect lock file / `go.mod` on `BASEBRANCH` as of YYYY-MM-DD
- Dependabot alert status may lag 24–48h after changes merge to base branch
- `NOT-REACHABLE` findings must be re-evaluated when the affected module's usage expands
- Patches must be removed once the owning package ships the fix natively — stale patches obscure future vulnerability tracking
