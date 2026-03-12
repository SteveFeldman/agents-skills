---
name: debug-error
description: "Systematically debug and resolve errors using structured hypothesis-driven investigation"
---

# Debug Error

Systematically debug and resolve errors using structured, hypothesis-driven investigation.

## Instructions

Follow this methodology to debug: **$ARGUMENTS**

### 1. Read the Error and Source Code

- Read the complete error message, stack trace, and error code.
- Open the file and line where the error originates — read the surrounding code.
- Check recent changes to the failing code: `git log -10 --oneline -- <file>` and `git diff` on relevant files.
- Note the conditions under which the error occurs (timing, inputs, frequency, environment).

### 2. Reproduce the Error

- Run the failing command, test, or request to confirm the error.
- Create a minimal reproduction if the trigger is complex.
- Document the exact steps and inputs that produce the error.

### 3. Analyze the Stack Trace

- Read the stack trace from bottom to top to understand the full call chain.
- Identify the originating error vs. wrapper errors.
- Trace the execution path: what functions were called, in what order, with what arguments.
- Open each file in the stack trace and read the relevant code.

### 4. Form Hypotheses

Based on the evidence, form ranked hypotheses about the root cause. Common causes to consider:

- Null/undefined reference
- Type mismatch or incorrect type coercion
- Race condition or timing issue
- Missing or incorrect configuration/environment variable
- Logic error (off-by-one, wrong conditional, incorrect state transition)
- External dependency failure (network, database, API)
- Resource exhaustion (memory, file handles, connections)

### 5. Investigate Systematically

- Test hypotheses in order of likelihood, one at a time.
- Use binary search to isolate the problem: comment out code, add logging, simplify inputs.
- Verify assumptions about data: print variable values, check types, inspect state at key points.
- Check input data validity, edge cases, and boundary conditions.

### 6. Check Dependencies and Environment

- Verify external dependencies and their versions (`package.json`, `requirements.txt`, lock files).
- Check configuration files and environment variables for correctness.
- Test network connectivity, API availability, and database connections if relevant.
- Look for version mismatches or breaking changes in recently updated dependencies.

### 7. Identify the Root Cause

- Confirm the root cause by explaining why the error occurs, not just where.
- Determine if it is a logic error, design flaw, configuration issue, or external problem.
- Check if similar patterns exist elsewhere in the codebase that might have the same bug.

### 8. Implement the Fix

- Design a fix that addresses the root cause, not just the symptom.
- Consider multiple approaches and choose the one with the best trade-off of correctness, simplicity, and safety.
- Add defensive checks and proper error handling around the fix.
- Avoid introducing new issues — keep the change minimal and focused.

### 9. Verify the Fix

- Run the original reproduction steps to confirm the error is resolved.
- Run the project's full test suite to check for regressions.
- Test edge cases and related scenarios that might be affected.
- If the error was input-dependent, test with varied inputs.

### 10. Prevent Recurrence

- Write a test that reproduces the original error and passes with the fix.
- Improve error handling and logging so similar issues are easier to diagnose in the future.
- Add input validation or defensive checks if the error was caused by unexpected input.
- Update code comments to explain non-obvious logic that contributed to the bug.
