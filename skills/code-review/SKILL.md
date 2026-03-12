---
name: code-review
description: "Whole-repository code quality review covering architecture, security, performance, and testing"
---

# Repository Code Review

Perform a comprehensive code quality review of an entire repository, analyzing architecture, security, performance, and testing practices. This is for reviewing a whole codebase — for PR-level reviews, use the `code-review-skill` instead.

## Instructions

### 1. Repository Analysis

- Read `CLAUDE.md`, `README.md`, and `CONTRIBUTING.md` for project context and conventions.
- Examine the repository structure and identify the primary language/framework.
- Check configuration files (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, etc.) to understand the tech stack.
- Identify the project's build system, test framework, and linting setup.

### 2. Code Quality Assessment

- Scan for code smells, anti-patterns, and potential bugs across the codebase.
- Check for consistent coding style and naming conventions.
- Identify unused imports, variables, dead code, or abandoned files.
- Review error handling and logging practices — are errors caught and handled consistently?
- Run the project's linter if available and report violations.

### 3. Security Review

- Check for hardcoded secrets, API keys, or passwords. **Flag as CRITICAL if found.**
- Look for common vulnerabilities: SQL injection, XSS, command injection, path traversal.
- Review authentication and authorization logic for correctness.
- Examine input validation and sanitization at system boundaries.
- Check for insecure dependencies (`npm audit`, `pip audit`, or equivalent).

### 4. Performance Analysis

- Identify potential performance bottlenecks (inefficient algorithms, N+1 queries, missing indexes).
- Review memory usage patterns and potential leaks.
- Check for unnecessary synchronous blocking, missing caching, or excessive network calls.
- Analyze bundle size and dependency weight where applicable.

### 5. Architecture & Design

- Evaluate code organization and separation of concerns.
- Check for proper abstraction and modularity — are responsibilities cleanly divided?
- Review dependency management and coupling between modules.
- Assess scalability: will the current architecture support growth?
- Identify architectural debt and areas needing refactoring.

### 6. Testing Coverage

- Assess existing test coverage: what percentage of critical paths are tested?
- Evaluate test quality — are tests testing behavior or just implementation details?
- Identify areas lacking proper testing (error paths, edge cases, integration points).
- Review test structure and organization for maintainability.

### 7. Documentation Review

- Evaluate code comments and inline documentation — are complex sections explained?
- Check API documentation completeness.
- Review README accuracy: are setup instructions current and correct?
- Identify undocumented public APIs, configuration options, or architectural decisions.

### 8. Findings and Recommendations

Structure the output as follows:

#### Summary
2-3 sentences on overall codebase health and maturity.

#### Findings

Organize by severity:

**CRITICAL** — Security vulnerabilities, exposed secrets, data loss risks. Must address immediately.

**HIGH** — Significant bugs, architectural issues, missing error handling. Should address soon.

**MEDIUM** — Code quality issues, missing tests, design improvements. Address in normal workflow.

**LOW** — Style inconsistencies, minor optimizations, documentation gaps. Address opportunistically.

For each finding, include:
- **Location** — File path(s) and line numbers where applicable
- **Issue** — Clear description of the problem
- **Impact** — Why it matters and what could go wrong
- **Recommendation** — Specific, actionable fix with code example if helpful

#### Strengths
Call out what the codebase does well — good patterns, clean modules, thorough tests.

#### Priority Actions
A ranked list of the top 5-10 improvements that would have the highest impact on codebase quality.
