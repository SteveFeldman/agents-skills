# Go Dependency Security — Command Reference

## The Critical Difference: govulncheck is Call-Graph Aware

`govulncheck` only reports a vulnerability if the **vulnerable function is reachable from your code**. A vulnerable package that is installed but whose vulnerable code path is never called will not appear in the output.

This means:
- A Dependabot alert can fire for a package where `govulncheck` is silent → lower real-world risk, but do NOT fully dismiss (future code changes could introduce the call path)
- A `govulncheck` finding is a confirmed reachable vulnerability → treat as full severity, no `scope` downgrade
- Dependabot alerts without a corresponding `govulncheck` finding → add `NOT-REACHABLE` status to scorecard, note in report

---

## Data Gathering

```bash
# Install govulncheck (run once)
go install golang.org/x/vuln/cmd/govulncheck@latest

# Scan for reachable vulnerabilities (call-graph aware)
govulncheck ./...

# Scan in verbose mode — shows which vulnerable symbols are called
govulncheck -v ./...

# Scan a specific package
govulncheck github.com/yourorg/yourrepo/pkg/...

# List all modules with their versions
go list -m all

# Find why a specific module is a dependency (equivalent to npm why)
go mod why github.com/vulnerable/pkg

# Full dependency graph — filter to find who requires a vulnerable package
go mod graph | grep "vulnerable/pkg"

# Check for available upgrades on all direct dependencies
go list -m -u all 2>/dev/null | grep '\['

# Check current version of a specific module
go list -m github.com/vulnerable/pkg

# Check what's installed on the BASE branch
git show origin/BASEBRANCH:go.sum | grep "github.com/vulnerable/pkg"
git show origin/BASEBRANCH:go.mod
```

---

## Direct vs Indirect Classification

In `go.mod`, indirect dependencies are marked explicitly:

```
require (
    github.com/direct/dep v1.2.3          // direct — you import this
    github.com/indirect/dep v4.5.6         // indirect — pulled by a direct dep
)
```

**Direct deps:** You call their APIs. Fix by updating the constraint in `go.mod`.

**Indirect deps:** Your direct dep pulls them. Fix by either:
1. Upgrading the direct parent dep (preferred)
2. Adding an explicit version constraint in `go.mod` (Go's override mechanism — see below)

No `development` scope equivalent exists in standard Go modules. All deps in `go.mod` are treated as production unless isolated with build tags or separate modules.

---

## Short-Term Patch — `replace` Directive

Go's equivalent of npm overrides is the `replace` directive in `go.mod`:

```
// Pin to a specific patched version
replace github.com/vulnerable/pkg v1.2.3 => github.com/vulnerable/pkg v1.2.4

// Replace all versions with a patched version
replace github.com/vulnerable/pkg => github.com/vulnerable/pkg v1.2.4

// Replace with a local fork (temporary patch while upstream PR is open)
replace github.com/vulnerable/pkg => ../local-patched-fork

// Replace with a different module path entirely
replace github.com/vulnerable/pkg => github.com/yourorg/patched-fork v1.2.4-patch
```

**After adding a replace directive:**
```bash
go mod tidy    # Clean up go.mod and go.sum
go build ./... # Confirm it compiles
go test ./...  # Confirm tests pass
```

**Warning:** `go mod tidy` can remove `replace` directives it considers unused. Always re-check after running tidy.

**Explicit version bump for indirect dep (alternative to replace):**
```go
// In go.mod, add an explicit require for the vulnerable transitive dep
require github.com/vulnerable/pkg v1.2.4 // indirect
```
Then run `go mod tidy`. This tells Go "use at least this version" for the indirect dep.

---

## Long-Term Remediation Commands

```bash
# Upgrade a specific direct dependency
go get github.com/pkg/name@vX.Y.Z

# Upgrade all direct dependencies to latest minor/patch
go get -u ./...

# Upgrade only patch releases (safer)
go get -u=patch ./...

# After any go.mod changes, clean up
go mod tidy

# Verify all module checksums are consistent
go mod verify

# If using vendor directory, sync it after changes
go mod vendor
```

---

## Vendor Directory Handling

Some Go projects commit `vendor/` to source control.

```bash
# Check if project uses vendoring
ls vendor/

# After updating go.mod, sync vendor directory
go mod vendor

# Verify vendor is consistent with go.mod
go mod verify
```

If a project uses `vendor/`, the vulnerable package source may be directly in the repo. Changes to `go.mod` alone won't fix it — `go mod vendor` must be run and the updated `vendor/` directory committed.

---

## Post-Patch Verification

```bash
# 1. Confirm module version
go list -m github.com/patched/pkg
# Expected: github.com/patched/pkg vX.Y.Z (patched version)

# 2. Confirm govulncheck no longer reports the CVE
govulncheck ./...
# Expected: No vulnerabilities found (or CVE not listed)

# 3. Regression: build
go build ./...

# 4. Regression: all tests
go test ./...

# 5. Regression: specific package tests for packages using the patched dep
go test ./pkg/that/uses/it/...

# 6. If the dep is in an HTTP handler path: integration test
# Start server locally, send requests through the affected endpoint
# Confirm no panics, no unexpected responses

# 7. For crypto/TLS packages: verify TLS handshake works
# Run your integration test suite that makes HTTPS calls
```

---

## govulncheck Output Interpretation

```
Vulnerability #1: GO-2024-XXXX
    Description: ...
    More info: https://pkg.go.dev/vuln/GO-2024-XXXX
    Module: github.com/vulnerable/pkg
    Found in: github.com/vulnerable/pkg@v1.2.3
    Fixed in: github.com/vulnerable/pkg@v1.2.4
    Example traces found:
      #1: main.go:42:18: yourapp.main calls vulnerable.Function
```

**Key fields:**
- **Found in** → installed version (confirm this matches what `go list -m` returns)
- **Fixed in** → minimum safe version
- **Example traces** → the call path proving reachability; use this to understand blast radius
- No traces listed + no output → not reachable in your build

---

## False Positive Detection (Go)

Go false positives are rarer than npm because `govulncheck` does call-graph analysis, but they can still occur:

1. **Dependabot alert but govulncheck is silent:** Add `NOT-REACHABLE` to scorecard. Do NOT dismiss — document the call graph state and plan to recheck if the dep's usage expands.

2. **Version mismatch:** `go list -m github.com/pkg/name` shows a version outside the vulnerable range. Dismiss the Dependabot alert.

3. **Replaced module:** `go.mod` has a `replace` pointing to a patched fork. Dependabot may not recognize the replacement. Confirm the replacement is actually applied: `go list -m github.com/pkg/name` should show the replace target's version.

---

## Common Go-Specific Pitfalls

| Pitfall | Fix |
|---------|-----|
| `replace` directive added but `go mod tidy` removed it | `go mod tidy` removes replaces it considers unused; re-add and consider pinning with an explicit `require` instead |
| Upgraded indirect dep with `go get` but `go.mod` still shows old version | Run `go mod tidy` to sync; check `go list -m` to confirm |
| Vendor directory out of sync with go.mod | Run `go mod vendor` and commit the result |
| `govulncheck` passes but Dependabot still shows alert | Dependabot does not use call-graph analysis; it alerts on any installed version in range; mark as `NOT-REACHABLE` in report but keep tracking |
| `go get -u ./...` upgrades too aggressively and breaks tests | Use `go get -u=patch ./...` for conservative upgrades, or update specific modules with `go get github.com/pkg@vX.Y.Z` |
