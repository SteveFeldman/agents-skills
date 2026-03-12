---
name: create-arch-docs
description: "Generate architecture documentation with C4 diagrams, ADRs, and system context maps from codebase analysis"
---

# Create Architecture Documentation

Generate architecture documentation by analyzing the codebase, then producing C4 diagrams, Architecture Decision Records, and system context documentation.

## Instructions

### 1. Codebase Discovery

Before documenting anything, read the codebase to understand the architecture:

- Read `CLAUDE.md`, `README.md`, and any existing architecture docs.
- Examine the directory structure, entry points, and module organization.
- Identify the tech stack: languages, frameworks, databases, message brokers, external services.
- Trace key request/data flows through the system.
- Read configuration files to understand deployment targets and infrastructure.
- Identify architectural patterns in use (MVC, microservices, event-driven, monolith, etc.).

### 2. System Context Documentation

Create a high-level system context diagram and description:

- Document what the system does and who uses it (users, external systems, APIs).
- Define system boundaries — what is in scope vs. external.
- Map external integrations and dependencies.
- Use the `mermaid` skill to generate a C4 Context diagram.

### 3. Container and Service Architecture

Document the major deployable units:

- Map containers/services, their responsibilities, and communication patterns (REST, gRPC, events, etc.).
- Document deployment architecture and infrastructure (cloud services, containers, serverless).
- Define API contracts between services.
- Document data persistence: databases, caches, file storage, and what each stores.
- Use the `mermaid` skill to generate a C4 Container diagram.

### 4. Component and Module Documentation

Document internal structure of key containers:

- Create component diagrams for the most important modules.
- Document internal module relationships and dependency direction.
- Describe design patterns used and why (repository pattern, CQRS, pub/sub, etc.).
- Document the package/folder organization and its rationale.
- Use the `mermaid` skill to generate component-level diagrams.

### 5. Data Architecture

- Document data models and key database schemas.
- Create data flow diagrams showing how data moves through the system.
- Document data storage strategies (relational, document, key-value, etc.) and why each was chosen.
- Note any data synchronization, replication, or migration patterns.

### 6. Architecture Decision Records (ADRs)

Create ADRs for significant architectural decisions found in the codebase:

- Use the format: Title, Status, Context, Decision, Consequences.
- Document trade-offs and alternatives that were likely considered.
- Cover decisions like: framework choice, database selection, API style, authentication approach, deployment strategy.
- Place ADRs in `docs/adr/` with sequential numbering (e.g., `0001-use-postgresql.md`).

### 7. Quality Attributes and Cross-Cutting Concerns

Document how the system handles:

- **Performance** — Caching strategies, query optimization, scaling approach.
- **Security** — Authentication/authorization flows, trust boundaries, data protection.
- **Reliability** — Error handling patterns, retry logic, circuit breakers.
- **Observability** — Logging, monitoring, health checks, tracing.

## Output

Produce the following files:

- `docs/architecture/README.md` — Overview and index linking to all architecture docs.
- `docs/architecture/system-context.md` — System context with C4 Level 1 diagram.
- `docs/architecture/containers.md` — Container architecture with C4 Level 2 diagram.
- `docs/architecture/components.md` — Component details with C4 Level 3 diagrams.
- `docs/architecture/data-architecture.md` — Data models, flows, and storage.
- `docs/architecture/quality-attributes.md` — Cross-cutting concerns.
- `docs/adr/0001-*.md` (one per decision) — Architecture Decision Records.

All diagrams should use Mermaid syntax for version-control-friendly, renderable documentation.
