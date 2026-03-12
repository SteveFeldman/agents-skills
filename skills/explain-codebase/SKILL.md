---
name: explain-codebase
description: "Scan and explain an entire codebase — structure, entry points, integrations, patterns, and data flow"
---

# Explain Codebase

Scan and explain an entire codebase so you can understand how it functions, how everything is connected, what it integrates with, and what patterns to be aware of.

## Instructions

Analyze the codebase at **$ARGUMENTS** (or the current working directory if not specified) and produce a structured overview.

### 1. Map Directory Structure and Tech Stack

- List the top-level directory structure and identify what each directory contains
- Identify the primary language(s) and framework(s) (check package.json, go.mod, Cargo.toml, pom.xml, requirements.txt, etc.)
- Note the build system and tooling (webpack, vite, make, gradle, etc.)
- Identify configuration files and what they configure (linters, CI, Docker, environment)
- Note the testing framework(s) in use

### 2. Find Entry Points

- Locate the main entry point(s): `main()` functions, `index.ts/js`, server startup files, CLI entry points
- For web apps: find the server setup, routing configuration, and app initialization
- For libraries: find the public API surface (exports, module entry points)
- For CLIs: find the command parser and command registration
- For monorepos: identify each package/service and its individual entry point

### 3. Trace Request / Data Flow

- Follow a typical request or operation through the system end-to-end
- For web services: trace an HTTP request from route handler through middleware, business logic, data access, and response
- For data pipelines: trace data from ingestion through transformation to output
- For event-driven systems: trace an event from producer through broker to consumer
- Document the key layers (e.g., controller -> service -> repository -> database)

### 4. Identify External Integrations

- **Databases**: What databases are used? Where is the connection configured? What ORM or query builder?
- **APIs**: What third-party APIs does the codebase call? Where are clients configured?
- **Message queues**: Any pub/sub, message brokers, or event buses (Kafka, RabbitMQ, SQS)?
- **Third-party services**: Auth providers, payment processors, email services, monitoring, logging
- **File storage**: S3, local filesystem, CDN integrations
- Note where credentials and connection strings are configured (environment variables, config files)

### 5. Document Key Patterns and Conventions

- Identify architectural patterns: MVC, Clean Architecture, Hexagonal, Event Sourcing, CQRS
- Note code organization conventions: file naming, folder structure rules, module boundaries
- Identify common patterns: dependency injection, middleware chains, decorator patterns, factory patterns
- Document error handling approach: custom error classes, error codes, global error handlers
- Note logging and observability patterns: structured logging, tracing, metrics

### 6. Map Internal Module Dependencies

- Identify how major modules/packages depend on each other
- Note any circular dependencies or tightly coupled components
- Describe the dependency direction (which modules know about which)
- Identify shared utilities, common libraries, or core modules used across the codebase
- For monorepos: document inter-package dependencies

### 7. Produce Structured Overview

Present the findings as a well-organized markdown document with these sections:

```markdown
## Codebase Overview: [Project Name]

### Summary
[1-3 sentences: what this project does and the core technology]

### Tech Stack
- **Language:** [e.g., TypeScript 5.x]
- **Framework:** [e.g., Next.js 14]
- **Database:** [e.g., PostgreSQL via Prisma]
- **Testing:** [e.g., Jest + Playwright]
- **Build/Deploy:** [e.g., Docker + GitHub Actions]

### Directory Structure
[Annotated top-level tree with purpose of each directory]

### Entry Points
[List of entry points and what each one starts]

### Request/Data Flow
[Step-by-step trace of a typical operation through the system]

### External Integrations
[Table or list of all external services, where they connect, and how]

### Key Patterns
[List of architectural and code patterns with brief explanations]

### Module Dependencies
[Description or diagram of how internal modules relate to each other]

### Things to Watch Out For
[Non-obvious behaviors, gotchas, tech debt, or areas of complexity]
```

## Tips

- Start broad (directory listing, config files) and narrow down into specific modules
- Read README, CONTRIBUTING, and CLAUDE.md files first if they exist — they often contain valuable context
- Check CI configuration to understand the build, test, and deploy pipeline
- Look at the most recently changed files to understand current areas of active development
- For very large codebases, focus on the most important modules first and note areas for deeper investigation
