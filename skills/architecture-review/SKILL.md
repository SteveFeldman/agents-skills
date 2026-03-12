---
name: architecture-review
description: Analyze codebase architecture and design patterns to assess maintainability, scalability, and adherence to best practices
---

# Architecture Review

Analyze the overall architecture and design patterns of any codebase to assess maintainability, scalability, and adherence to best practices.

## Usage

```
/architecture-review                          # Full review of current codebase
/architecture-review data-flow                # Focus on data flow only
/architecture-review security,scalability     # Multiple focus areas
```

## Instructions

Review the codebase architecture with the following scope: **$ARGUMENTS**

If `$ARGUMENTS` specifies a focus area, limit the review to the relevant sections below. If no focus is given, perform a full review but keep each section concise — breadth over depth.

### 1. Discovery

Before analyzing, establish context:
- Identify the tech stack, frameworks, and runtime environment
- Read project config files (`package.json`, `go.mod`, `requirements.txt`, etc.)
- Map the directory structure and identify architectural boundaries
- Check for existing architecture docs, ADRs, or CLAUDE.md files

### 2. Structural Analysis

- **Patterns**: Identify architectural patterns in use (MVC, Clean Architecture, hexagonal, event-driven, etc.)
- **Module boundaries**: Review separation of concerns and layer structure
- **Dependencies**: Analyze coupling between modules, check for circular dependencies, assess dependency direction
- **Component design**: Check single responsibility adherence, interface design, and abstraction levels

### 3. Data Flow & State

- Trace data flow through the application end-to-end
- Review state management patterns and implementation
- Analyze data persistence, storage strategies, and caching layers
- Check for proper data validation and transformation at boundaries

### 4. Resilience & Operations

- **Error handling**: Review strategy consistency, propagation, and recovery patterns
- **Scalability**: Assess horizontal/vertical scaling capabilities, stateless design, bottlenecks
- **Observability**: Review logging, monitoring, and alerting integration
- **Configuration**: Check separation of config from code, environment management, feature flags

### 5. Security Architecture

- Review security boundaries and trust zones
- Check authentication and authorization architecture
- Analyze data protection and encryption practices
- Assess input validation at system boundaries

### 6. Testability & Quality

- Review test structure and organization across architectural layers
- Check for testability in design (dependency injection, interface-based design)
- Assess test coverage distribution and identify undertested layers
- Review mocking and dependency isolation strategies

### 7. Evolution & Debt

- Assess the architecture's ability to accommodate change
- Identify technical debt and modernization opportunities
- Review technology stack alignment with current requirements
- Check for proper versioning and backward compatibility

### 8. Recommendations

Produce a scored report:

```
## Architecture Review Report

### Overall Score: [X]/100

| Dimension           | Score | Status |
|---------------------|-------|--------|
| Structure & Patterns| X/100 | 🟢/🟡/🔴 |
| Data Flow & State   | X/100 | 🟢/🟡/🔴 |
| Resilience & Ops    | X/100 | 🟢/🟡/🔴 |
| Security            | X/100 | 🟢/🟡/🔴 |
| Testability         | X/100 | 🟢/🟡/🔴 |
| Evolution & Debt    | X/100 | 🟢/🟡/🔴 |

### Key Strengths
- [Top 3 things done well]

### Critical Issues
- [Issues requiring immediate attention]

### Recommended Improvements
1. [Highest impact, with specific file/module references]
2. [...]
3. [...]

### Architecture Evolution Roadmap
- Short-term: [Quick wins]
- Medium-term: [Structural improvements]
- Long-term: [Strategic changes]
```

Focus on actionable insights with specific file paths and code references. Every recommendation should include *why* it matters and *what* to do about it.
