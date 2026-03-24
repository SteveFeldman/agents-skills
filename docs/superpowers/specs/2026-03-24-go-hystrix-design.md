# go-hystrix Skill Design

## Overview

A skill for auditing, reporting on, and optimizing Hystrix circuit breaker implementations in Go services. Produces tiered output: quick wins with ready-to-apply code fixes and larger recommendations that require team decisions.

## Audiences

- **go-staff-engineer agent** — auto-invoked when hystrix-go usage is detected during code review or architecture assessment
- **Developers** — invoked directly via `/go-hystrix` for tech debt assessment
- **PR reviewers** — scoped audits on changed files during code review

## SKILL.md Frontmatter

```yaml
---
name: go-hystrix
description: Audit and optimize Hystrix circuit breaker implementations in Go services for scaling, performance, and availability
---
```

## Skill Structure

Dimensions are numbered in execution order (most mechanical first, most subjective last):

```
skills/go-hystrix/
├── SKILL.md                              # Main audit workflow + report template
└── references/
    ├── configuration-tuning.md           # Dimension 1: timeouts, concurrency, thresholds, sleep windows
    ├── error-handling.md                 # Dimension 2: error filtering, swallowed errors
    ├── code-patterns.md                  # Dimension 3: hystrix.Go boilerplate, pattern deviations
    ├── observability.md                  # Dimension 4: Prometheus, stream handler, alerting
    ├── naming-conventions.md             # Dimension 5: command naming, traceability
    ├── testing-patterns.md               # Dimension 6: circuit state testing strategies
    └── fallback-patterns.md              # Dimension 7: missing fallbacks, flag + defer guidance
```

## SKILL.md Content Specification

The SKILL.md contains the full executable workflow — everything the agent or human needs to run the audit. It is self-contained for the process; reference files provide the domain knowledge for each dimension.

**SKILL.md contains:**
- Frontmatter (name, description)
- Scope detection logic (how to determine full repo vs scoped audit)
- Phase 1 discovery steps (find imports, map commands, map execution sites, map middleware, identify dependencies)
- Phase 2 dimension audit loop (for each dimension: load reference file, run checklist, classify findings)
- Phase 3 report generation (the full report template with placeholders)
- Tiered output rules (quick wins get code, recommendations get effort sizing)

**Reference files contain:**
- What to look for (audit checklist items for that dimension)
- Broken vs. correct code patterns
- Tuning guidance and benchmarks (where applicable)
- Severity classification rules for that dimension

The split: SKILL.md says **what to do and in what order**. Reference files say **what to look for and how to judge it**.

## Audit Workflow

### Scope Detection

Before the audit begins, the skill determines its operating mode:

- If `$ARGUMENTS` contains a file path or directory: **scoped audit** (review mode on specific files)
- If `$ARGUMENTS` is empty or contains a repo root: **full repo audit**
- If invoked by go-staff-engineer agent: follow the agent's scope directive

For scoped audits, the skill determines the changed files by examining the provided paths. When invoked during a PR review, the calling agent is responsible for passing the relevant file paths as arguments (e.g., files from `git diff`). The skill itself does not parse git state — it operates on whatever paths it receives.

| Aspect | Full Repo Audit | Scoped Review |
|--------|----------------|---------------|
| Discovery | All hystrix commands | Only commands in provided files |
| Command inventory | Complete table | Changed/added commands only |
| Dimension audits | All 7 | Skip dimensions with no relevant findings |
| Report | Full template | Condensed — summary + relevant dimensions only |
| Quick win code | All fixable items | Only items in provided files |

### Phase 1: Discovery

1. **Find hystrix imports** — scan `go.mod` and `*.go` for `hystrix-go` usage
2. **Map commands** — extract all `hystrix.ConfigureCommand()` calls, build a command inventory (name, timeout, concurrency, error threshold)
3. **Map execution sites** — find all `hystrix.Go()` and `hystrix.Do()` calls, link each to its configured command
4. **Map middleware** — identify instrumenting middleware, caching layers, and any custom wrappers using `hystrix.GetCircuit()`
5. **Identify service dependencies** — for each command, determine what external service or endpoint it protects

Output: A **command map table** (command name → config → execution site → protected dependency) used as the foundation for all 7 dimension audits.

### Phase 2: Dimension Audits

Iterate through each dimension in order (1-7), loading the corresponding reference file. For each dimension:

- Run the checklist items against the command map and source code
- Classify each finding by severity (critical / warning / info)
- Tag findings as **quick win** (can produce code fix) or **recommendation** (needs team decision)

**Dimension order:**
1. Configuration Tuning
2. Error Handling
3. Code Patterns
4. Observability
5. Naming Conventions
6. Testing
7. Fallback Patterns

Rationale: starts with the most mechanical/objective checks, ends with the most subjective (fallbacks are flagged but deferred to the team).

### Phase 3: Report Generation

Produce the structured report using the report template below. For dimensions with no findings, include the dimension heading with "No issues found."

## Report Template

```markdown
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
| ... | ... | ... | ... | ... | ... |

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
{deviations from standard hystrix.Go boilerplate}
### Quick Win Code
{normalization diffs}

## Dimension 4: Observability
### Findings
{Prometheus integration, stream handler, alerting gaps}
### Quick Win Code
{missing metrics registration, etc.}

## Dimension 5: Naming Conventions
### Findings
{inconsistent names, non-traceable names}
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
```

## Severity Definitions

- **Critical** — circuit breaker is misconfigured or ineffective (e.g., timeout higher than upstream timeout, circuit never trips)
- **Warning** — suboptimal but functional (e.g., uniform concurrency not tuned, missing sleep window config)
- **Info** — style/consistency issues (e.g., naming inconsistency, boilerplate deviation)

## Effort Sizing for Recommendations

- **S** — isolated change, single file
- **M** — multi-file change, requires testing
- **L** — architectural change, requires team alignment

## Reference File Content Strategy

Each reference file follows a consistent internal structure:

```markdown
# {Dimension Name}

## What To Look For
- Checklist of specific items to audit (bulleted)

## Broken Patterns
{Code examples showing anti-patterns, using generic service/dependency names}

## Correct Patterns
{Code examples showing the right way}

## Tuning Guidance (where applicable)
{Heuristics, benchmarks, decision tables — these are starting-point heuristics and should be validated against actual p99 latencies and traffic patterns}

## Severity Classification
- Critical: {what qualifies}
- Warning: {what qualifies}
- Info: {what qualifies}
```

### Reference File Highlights

**configuration-tuning.md**
- Dependency-type benchmark table (cache: 500-1000ms timeout / 200-400 concurrency, external API: config-driven / 50-200 concurrency, etc.). These are starting-point heuristics — validate against actual p99 latencies and traffic patterns before applying.
- Flags uniform `MaxConcurrentRequests` as a warning when traffic patterns differ across commands
- Calls out missing `SleepWindow` and `RequestVolumeThreshold` (hystrix defaults may not be appropriate)
- Positive example: services that vary concurrency by command based on traffic (100-600 range)

**error-handling.md**
- Validates the 5xx-only filter pattern as correct for most cases
- Flags edge cases: downstream returns 200 with error body, network errors vs HTTP errors
- Checks for swallowed errors in the channel/select pattern

**code-patterns.md**
- Documents the standard `hystrix.Go` boilerplate (channel + select pattern) as the canonical form used across services
- `hystrix.Do()` vs `hystrix.Go()`: both are valid. `hystrix.Do()` is simpler for synchronous calls; `hystrix.Go()` with channel+select is the established team pattern. Flag `hystrix.Do()` as an **info**-level inconsistency (not a bug), noting the team convention. Do not flag it as an error — it is functionally equivalent.
- Flags deviations: missing `output <- true`, different channel buffer sizes, other boilerplate inconsistencies
- Flags inconsistencies between services

**testing-patterns.md**
- Circuit open behavior test template
- Timeout behavior test template
- Concurrency rejection test template
- Uses `hystrix.Flush()` for test isolation

**observability.md**
- Checks for `getCircuitStatus()` helper wired to Prometheus
- Verifies stream handler on expected port
- Checks for circuit-open alerting

**naming-conventions.md**
- Namespace prefixing patterns (e.g., `service:Operation` vs bare `Operation`)
- Consistency between command name and method name
- Traceability from metrics/logs back to code

**fallback-patterns.md**
- Flags `nil` fallbacks without prescribing fixes
- Catalogs fallback strategy options (cached, default, degraded) for team reference
- Notes read vs write distinction for the team's decision-making

## Integration

### go-staff-engineer Agent

The `go-staff-engineer.md` agent definition will be updated to add the following to its expertise areas:

> **Circuit Breaker Auditing:** When reviewing a Go service that imports `github.com/afex/hystrix-go`, invoke the `/go-hystrix` skill to audit the circuit breaker implementation. Pass the relevant file paths as arguments for scoped reviews, or invoke without arguments for a full repo audit.

The trigger condition: the agent detects `hystrix-go` in `go.mod` or in any `*.go` import during its review. This should be added to the agent's "Observability & Operations" expertise area.

### Direct Invocation
- `/go-hystrix` — full repo audit of current working directory
- `/go-hystrix service/` — scoped to a subdirectory

### PR/Code Review
The calling agent (e.g., code-reviewer) passes changed file paths as arguments: `/go-hystrix path/to/changed/file1.go path/to/changed/file2.go`. The skill scopes its audit to those files.

## Constraints

- All code examples use generic service/dependency terminology — no domain-specific language
- Fallback strategy is flagged but never prescribed (product decision)
- Tuning guidance uses heuristics with concrete ranges, not absolute prescriptions — always validate against actual metrics
- Patterns are drawn from real Go service implementations but abstracted for reuse
- Migration away from hystrix-go is out of scope for this skill
