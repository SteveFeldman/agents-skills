---
name: write-tests
description: "Generate comprehensive tests including unit, integration, and edge case coverage with framework-aware conventions"
---

# Write Tests

Generate comprehensive tests for any codebase, covering unit tests, integration tests, edge cases, and mocking strategies with framework-aware conventions.

## Instructions

1. **Detect Framework and Conventions**
   - Identify the testing framework from project config and dependencies:
     - JavaScript/TypeScript: Jest, Vitest, Mocha, Playwright
     - Python: pytest, unittest
     - Ruby: RSpec, Minitest
     - Java/Kotlin: JUnit, TestNG
     - Go: built-in `testing`, testify
     - Rust: built-in `#[test]`, proptest
   - Review existing test files for naming conventions, directory structure, and patterns
   - Check test configuration files (`jest.config`, `pytest.ini`, `.rspec`, etc.)
   - Adopt the project's existing style: if they use `describe/it`, use that; if they use `test_*`, use that

2. **Analyze Target Code**
   - Parse the target file or function from: **$ARGUMENTS**
   - If no target specified, identify the most critical untested code
   - Analyze function signatures, parameters, return types, and side effects
   - Map out dependencies: what does this code call, import, or interact with?
   - Identify all code branches, conditionals, and loop paths
   - Note async operations, error throws, and edge case boundaries

3. **Plan Test Strategy**
   - Determine what types of tests are needed:
     - **Unit tests** for isolated functions and methods
     - **Integration tests** for component interactions, API endpoints, database operations
   - Prioritize: business-critical logic first, then error handling, then edge cases
   - Identify what needs mocking vs. what can be tested directly
   - Estimate test count and organize by test suite

4. **Write Unit Tests**
   - Follow the AAA pattern: Arrange, Act, Assert
   - Use descriptive test names that explain the scenario and expected outcome
   - Cover these categories for each function:
     - **Happy path:** Normal inputs producing expected outputs
     - **Edge cases:** Empty inputs, null/undefined, boundary values, max/min limits
     - **Error cases:** Invalid inputs, missing required fields, type mismatches
     - **State transitions:** Before/after effects, side effects
   - Keep each test focused on a single behavior
   - See `references/framework-examples.md` for framework-specific patterns

5. **Write Integration Tests**
   - Test component interactions and data flow across boundaries
   - Test API endpoints with various request scenarios (valid, invalid, unauthorized)
   - Test database operations: CRUD, transactions, constraint violations
   - Test interactions with external services using realistic scenarios
   - Verify that error propagation works correctly across component boundaries

6. **Handle Mocking and Test Isolation**
   - Mock external dependencies: HTTP clients, databases, file system, third-party APIs
   - Use dependency injection patterns to make code testable
   - Create focused mocks that only simulate what the test needs
   - Avoid over-mocking: if you mock everything, you test nothing
   - Verify mock interactions where behavior (not just return values) matters
   - Set up proper mock cleanup in `afterEach`/`teardown` to prevent test pollution

7. **Generate Test Data**
   - Create test fixtures for complex data structures
   - Use factories or builders for objects with many fields
   - Generate parameterized tests for multiple input combinations
   - Create realistic but deterministic test data (avoid random data unless doing property-based testing)
   - Set up shared fixtures for data reused across tests

8. **Test Async and Error Handling**
   - Test promise resolution and rejection with proper `async/await` patterns
   - Test timeout scenarios and retry logic
   - Verify error messages, error codes, and error types
   - Test error recovery and fallback mechanisms
   - Test validation errors with specific field-level assertions

9. **Verify Tests Pass**
   - Run the full test suite to confirm all new tests pass
   - Fix any failures: distinguish between test bugs and actual code bugs
   - Verify tests fail when the behavior they test is broken (mutation check)
   - Check for flaky tests: run twice to confirm deterministic results
   - Review test output for clarity: can you understand what failed from the test name and message alone?

10. **Review Test Quality**
    - Ensure every test has meaningful assertions (not just "does not throw")
    - Confirm tests are independent: no test depends on another test's side effects
    - Check that tests document behavior: reading the test names should explain what the code does
    - Remove any redundant tests that cover the same behavior
    - Add comments only for non-obvious test logic or complex setup
