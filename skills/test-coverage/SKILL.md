---
name: test-coverage
description: "Analyze test coverage, identify gaps in critical code paths, and produce a prioritized coverage improvement plan"
---

# Test Coverage Analysis

Analyze test coverage to identify gaps in critical code paths and produce a prioritized improvement plan.

> This skill focuses on **analysis only**. To write the missing tests, use `/write-tests`.

## Instructions

1. **Detect Coverage Tool**
   - Auto-detect the project type and identify the appropriate coverage tool:
     - **JavaScript/TypeScript:** Jest (`--coverage`), NYC/Istanbul, c8
     - **Python:** pytest-cov, Coverage.py
     - **Java/Kotlin:** JaCoCo, Cobertura
     - **C#/.NET:** dotCover, Coverlet
     - **Ruby:** SimpleCov
     - **Go:** `go test -cover`
     - **Rust:** cargo-tarpaulin, cargo-llvm-cov
   - Check for existing coverage configuration in project files (`jest.config`, `.coveragerc`, `jacoco.gradle`, etc.)
   - If no coverage tool is configured, recommend one and set it up

2. **Run Coverage**
   - Execute the test suite with coverage enabled:
     ```bash
     # JavaScript/TypeScript
     npx jest --coverage --coverageReporters=text,lcov

     # Python
     pytest --cov=src --cov-report=term --cov-report=html

     # Java (Maven)
     mvn clean test jacoco:report

     # Go
     go test -coverprofile=coverage.out ./...
     go tool cover -func=coverage.out

     # .NET
     dotnet test --collect:"XPlat Code Coverage"
     ```
   - Capture the output for analysis

3. **Analyze Coverage Report**
   - Review overall coverage metrics: line, branch, function, and statement coverage
   - Break down coverage by file and directory
   - Identify files with the lowest coverage percentages
   - Pay special attention to branch coverage gaps (untested conditional paths)

4. **Identify Critical Gaps**
   - Flag uncovered code in business-critical modules (auth, payments, data processing)
   - Identify untested error handling and exception paths
   - Find uncovered public API surfaces and interface methods
   - Note security-sensitive code paths without test coverage
   - Look for untested data validation and input handling

5. **Categorize Uncovered Code**
   - **Must test:** Business logic, security controls, data integrity, public APIs
   - **Should test:** Error handling, edge cases, utility functions
   - **Can skip:** Auto-generated code, trivial getters/setters, third-party wrappers
   - **Consider removing:** Dead code with zero coverage and no references

6. **Prioritize by Risk**
   - Rank gaps by impact: what breaks if this code has a bug?
   - Consider change frequency: files that change often need more coverage
   - Weight by complexity: complex code with many branches is higher risk
   - Factor in user exposure: user-facing code paths are higher priority

7. **Produce Improvement Plan**
   - Create a prioritized list of files/modules that need coverage improvement
   - For each item, specify:
     - Current coverage percentage
     - Target coverage percentage
     - What types of tests are needed (unit, integration)
     - Estimated effort (small, medium, large)
   - Set realistic overall coverage targets based on project maturity
   - Recommend coverage thresholds for CI/CD gating

8. **Configure Coverage Monitoring**
   - Recommend or set up coverage reporting in CI/CD
   - Configure coverage threshold enforcement to prevent regression
   - Set up coverage exclusion rules for generated code and vendor files
   - Document exclusion decisions with rationale

> To write the missing tests identified in this analysis, use `/write-tests`.
