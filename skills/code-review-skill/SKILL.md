---
name: code-review-skill
description: "PR-focused code review with structured checklist, severity ratings, and actionable feedback"
---

# PR Code Review

Perform a thorough code review for the current changeset (PR, branch diff, or staged changes), following principal-engineer-level best practices.

## Instructions

### 1. Establish Project Context

Before reviewing any code:

- Read `CLAUDE.md`, `.claude/settings.json`, or any project-level conventions file at the repo root.
- Check for `.eslintrc`, `.prettierrc`, `tsconfig.json`, `editorconfig`, or framework-specific config to understand enforced standards.
- Review `README.md` and any `CONTRIBUTING.md` for stated conventions.
- Examine existing code patterns in the areas being changed to understand established norms.
- **All review feedback must respect project-specific standards. Do not flag code that follows documented project conventions.**

### 2. Determine Review Scope

- If a PR URL or number is provided, fetch the diff using `gh pr diff <number>`.
- If no PR is specified, check for an open PR on the current branch: `gh pr view --json number,url`.
- If a branch is specified, diff against the base branch (typically `main` or `develop`).
- If no scope is given, review staged/unstaged changes (`git diff` and `git diff --cached`).
- Identify the primary language/framework from the repository structure.

### 3. Code Review Checklist

Address every item:

1. **Critical eye on the code** — Read every changed line. Don't skim.
2. **Design patterns** — Does the code follow established patterns in this repo?
3. **Refactoring needs** — Are there areas that should be refactored now or extracted into a future ticket?
4. **Clean syntax** — Is the code readable, well-formatted, and consistent with the project's style?
5. **Reusability** — Is the code written in a reusable fashion? Are there opportunities to extract shared logic?
6. **Naming clarity** — Do method names, file names, variables, and classes clearly imply their function?
7. **Linting** — Are there lint violations? Run lint if a lint script is available.
8. **Functional verification** — Can the feature be pulled down and tested? Note any setup steps needed.
9. **Second opinion needed?** — Flag if the change is complex enough to warrant an additional reviewer.
10. **Secrets check (CRITICAL)** — Does the changeset contain any passwords, secrets, API keys, tokens, or other sensitive information? **Flag immediately if found.**

### 4. Design & Architecture Principles

Evaluate the changeset against:

- **SOLID Principles:**
  - **Single Responsibility** — Does each module/class/function have one clear reason to change?
  - **Open/Closed** — Is the code open for extension but closed for modification?
  - **Liskov Substitution** — Can subtypes be used interchangeably with their base types?
  - **Interface Segregation** — Are interfaces focused and minimal?
  - **Dependency Inversion** — Does the code depend on abstractions rather than concrete implementations?
- **Coupling & Cohesion** — Low coupling between modules? High cohesion within?
- **Modularity & Separation of Concerns** — Are responsibilities cleanly divided?
- **Alignment with Existing Architecture** — Does the change fit established patterns? If deviating, is it justified?
- **Scalability & Extensibility** — Will this approach hold up as the feature grows?

### 5. Code Quality Assessment

- Identify code smells, anti-patterns, and potential bugs in the changed code.
- Check for unused imports, variables, or dead code introduced by the changes.
- Review error handling — are errors caught, logged, and handled appropriately?
- Verify consistent coding style and naming conventions with the rest of the codebase.

### 6. Security Review

- Check for common vulnerabilities: SQL injection, XSS, command injection, path traversal (OWASP guidelines).
- Verify input validation and sanitization at system boundaries.
- Review authentication and authorization logic if touched.
- Check for insecure dependencies or known CVEs in newly added packages.
- **Scan for hardcoded secrets, API keys, passwords, or credentials — flag as CRITICAL.**

### 7. Performance Analysis

- **Algorithmic Complexity** — Flag O(n^2) or worse where linear or logarithmic alternatives exist.
- **Data Structure Choices** — Are the right data structures being used?
- **Bottleneck Identification** — Check for inefficient loops, N+1 queries, missing indexes, unnecessary re-renders, or unintended synchronous blocking.
- **Dependency Impact** — Review new dependencies for bundle size and whether lighter alternatives exist.
- **Readability vs. Performance** — When suggesting optimizations, state if they come at the cost of readability. Note when the simpler approach is acceptable.

### 8. Testing & Integration Assessment

- **Test Coverage** — Do the changes include tests? Identify changed logic that lacks coverage.
- **Test Quality** — Are tests meaningful? Do they test behavior and edge cases, not just trivial values?
- **Test Structure** — Do tests follow Arrange-Act-Assert? Are they readable?
- **Missing Scenarios** — Suggest specific test cases: error paths, boundary conditions, concurrent access, empty/null inputs.
- **Integration Impact** — Are there upstream or downstream services, shared state, or event contracts that could break?

### 9. Output Format

Structure the review as follows:

#### Summary
A 2-3 sentence summary of what the changeset does and overall assessment.

#### Findings

Organize by severity:

**CRITICAL** — Must fix before merge (security issues, secrets exposure, data loss risk, breaking bugs)

**HIGH** — Should fix before merge (significant bugs, missing error handling, failing tests)

**MEDIUM** — Recommended improvements (code quality, missing tests, design issues)

**LOW** — Suggestions and nits (style, naming, minor optimizations)

For each finding, include:
- **File and line reference** (e.g., `src/utils/auth.ts:42`)
- **What the issue is** — stated clearly and without judgment
- **Why it matters** — reference relevant principles, patterns, or standards
- **Suggested fix** — concrete recommendation, not vague advice
- **Trade-offs** — when multiple valid approaches exist, describe trade-offs and state your recommendation

#### Checklist Results
Show pass/fail status for each of the 10 checklist items.

#### What Looks Good
Call out things the author did well — good design decisions, clean abstractions, thorough tests, thoughtful naming.

#### Verdict
One of:
- **Approve** — Ready to merge, no blocking issues.
- **Approve with suggestions** — Non-blocking feedback, author's discretion.
- **Request changes** — Blocking issues that must be addressed before merge.

### 10. Tone Guidelines

- **Ask questions, don't make demands.** ("What do you think about naming this `:user_id`?" not "Rename this.")
- **Be explicit and humble.** Assume the author is intelligent and well-meaning.
- **Avoid judgmental language.** No "dumb", "stupid", "obviously wrong."
- **Offer alternatives, don't gatekeep.** ("What do you think about using X here?" not "You must use X.")
- **Communicate conviction level.** Distinguish "I feel strongly that..." from "Nit:" so the author knows the weight.
- **Be educational.** Explain the *why* behind suggestions. A review that teaches is worth more than one that just corrects.
- **Acknowledge trade-offs.** When the author made a reasonable choice among valid options, say so.
- **Be constructive.** Every piece of criticism should come with a path forward.
