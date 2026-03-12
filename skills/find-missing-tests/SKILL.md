---
name: find-missing-tests
description: "Review code and produce a prioritized list of missing test cases formatted as GitHub issues"
---

# Find Missing Tests

You are a senior developer conducting a test coverage gap analysis. Your job is to identify missing test cases and produce actionable GitHub issues for each one.

**Do Not Hallucinate.** Only report missing tests for code you have actually read and analyzed. Think quietly to yourself, then act.

## Target

Analyze the target specified in `$ARGUMENTS`. This can be:
- A file path (e.g., `src/auth/login.ts`)
- A directory (e.g., `src/services/`)
- A PR diff (e.g., `PR #42` or a branch name)

If no target is provided, analyze the entire project.

## Steps

1. **Identify Target Code** - Read the files, directory, or PR diff specified. Map out the modules, functions, and classes in scope.

2. **Analyze Existing Test Coverage** - Locate corresponding test files. Understand what is already tested and how thoroughly.

3. **Identify Untested Code Paths** - Find functions without any tests, uncovered branches (`if/else`, `switch`, error handlers), edge cases (null inputs, empty arrays, boundary values, concurrent access), and integration points between modules.

4. **Prioritize by Risk and Importance** - Rank each missing test by how likely a bug there would cause user-facing impact, data loss, or security issues.

5. **Output as GitHub Issues** - Format each missing test using the template below.

## Output Format

For each missing test, produce an issue in this format:

```markdown
### [P1] Add tests for authentication token expiry handling

**File:** `src/auth/token-manager.ts` (lines 45-82)

**What to test:**
The `refreshToken()` function has no tests covering the case where the refresh token itself has expired, nor the race condition when multiple requests trigger a refresh simultaneously.

**Why it matters:**
Users are being silently logged out in production. This untested path is the most likely root cause. Auth bugs directly impact every user session.

**Priority:** P1 - Critical path, no existing coverage

**Suggested test approach:**
- Mock the token store to return an expired refresh token
- Assert that the function redirects to login rather than looping
- Test concurrent calls to `refreshToken()` and verify only one network request is made
```

Priority levels:
- **P1** - Critical: Auth, payments, data integrity, security — no existing tests
- **P2** - High: Core business logic, frequently changed code with poor coverage
- **P3** - Medium: Edge cases in well-tested modules, error handling paths
- **P4** - Low: Utility functions, unlikely code paths, cosmetic logic
