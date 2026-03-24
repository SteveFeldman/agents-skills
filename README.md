# Agents & Skills

A curated collection of custom agents, skills, and reference documentation for Claude, Copilot or any AI-assisted software engineering.

This repository captures reusable prompt engineering assets that extend Claude Code with specialized capabilities: structured code reviews, architecture analysis, test generation, debugging workflows, and more.

## Quick Start

### Install everything

Copy the directories into your agentic configuration:

```bash
# Clone the repo
git clone <repo-url> agents-skills
cd agents-skills

# Copy agents (available globally across all projects)
cp -r agents/ ~/.copilot/agents/

# Copy skills (available globally across all projects)
cp -r skills/ ~/.copilot/skills/

# Copy reference docs
cp -r docs/ ~/.copilot/docs/
```

### Install selectively

Pick only what you need:

```bash
# Just the code review skill
cp -r skills/code-review-skill/ ~/.copilot/skills/code-review-skill/

# Just the Go agent
cp agents/go-staff-engineer.md ~/.copilot/agents/
```

### Use in a specific project

To scope assets to a single project, copy them into the project's `.copilot/` directory instead:

```bash
cp -r skills/write-tests/ /path/to/project/.copilot/skills/write-tests/
```

---

## Directory Structure

```
agents-skills/
├── agents/          # 12 specialized agent definitions
├── skills/          # 34 skill packages (slash commands)
└── docs/            # Reference documentation (Go, JS, OTEL, general)
```

---

## Agents

Agents are specialized personas that Claude Code can adopt for specific types of work. Each agent has defined expertise, tools access, and behavioral guidelines.

Place agent files in `~/.copilot/agents/` to make them available globally.

| Agent | Purpose |
|---|---|
| `accessibility-expert` | WCAG compliance, ARIA attributes, keyboard navigation, screen reader testing |
| `code-refactorer` | Improve code structure, reduce duplication, simplify logic without changing behavior |
| `content-writer` | Create compelling articles, blog posts, and technical content |
| `debug-specialist` | Diagnose runtime errors, test failures, and unexpected behavior |
| `frontend-test-specialist` | React/Redux unit testing, coverage analysis, and test quality improvements |
| `go-staff-engineer` | Expert Go development — architecture, performance, testing, production patterns |
| `principal-engineer-reviewer` | Senior-level code review focusing on quality, performance, architecture, security |
| `project-planner` | Create comprehensive development task lists from PRDs |
| `runbook-writer` | Operational runbooks for production systems and incident response |
| `security-auditer` | Comprehensive security audits with vulnerability identification and remediation |
| `sonarqube-code-quality` | Code quality analysis aligned with SonarQube rules and metrics |
| `vibe-coding-coach` | Build apps through conversation — translate ideas and vibes into working code |

---

## Skills

Skills are structured prompts that guide Claude Code through specific workflows. Each skill lives in its own directory with a `SKILL.md` file and optional `references/` for supporting material.

Place skill directories in `~/.copilot/skills/` to make them available as slash commands.

### Code Review & Quality

| Skill | Description |
|---|---|
| `code-review-skill` | PR-focused code review with structured checklist, severity ratings, and actionable feedback |
| `code-review` | Whole-repository code quality review covering architecture, security, performance, and testing |
| `find-missing-tests` | Review code and produce a prioritized list of missing test cases formatted as GitHub issues |

### Testing

| Skill | Description |
|---|---|
| `write-tests` | Generate comprehensive tests including unit, integration, and edge case coverage with framework-aware conventions |
| `test-coverage` | Analyze test coverage, identify gaps in critical code paths, and produce a prioritized coverage improvement plan |
| `e2e-setup` | Set up end-to-end testing infrastructure with Playwright, including page objects, CI integration, and test data management |

### Architecture & Documentation

| Skill | Description |
|---|---|
| `architecture-review` | Analyze codebase architecture and design patterns to assess maintainability, scalability, and adherence to best practices |
| `create-arch-docs` | Generate architecture documentation with C4 diagrams, ADRs, and system context maps from codebase analysis |
| `mermaid` | Create Mermaid diagrams (activity, deployment, sequence, architecture) from text descriptions or source code |
| `directory-deepdive` | Investigate a directory's architecture and create/update a CLAUDE.md file capturing implementation knowledge |
| `explain-code` | Analyze and explain code sections with multi-level explanations tailored to audience experience level |
| `explain-codebase` | Scan and explain an entire codebase — structure, entry points, integrations, patterns, and data flow |

### Security

| Skill | Description |
|---|---|
| `security-audit` | Identify security vulnerabilities across dependencies, auth, input validation, data protection, secrets, and infrastructure |
| `security-hardening` | Apply security best practices to reduce attack surface — authentication, input validation, headers, encryption, and dependency updates |

### Performance & Health

| Skill | Description |
|---|---|
| `performance-audit` | Analyze codebase for performance bottlenecks across code, database, frontend, network, and async operations |
| `project-health` | Multi-dimensional project health dashboard with scoring across delivery, quality, debt, team, and dependency metrics |
| `dependency-audit` | Audit all project dependencies for security vulnerabilities, outdated packages, license compliance, and health |
| `k6` | Write and execute k6 load tests, performance checks, and validation scripts |

### Development Workflow

| Skill | Description |
|---|---|
| `create-feature` | Plan and implement new features with structured workflow from requirements through testing and PR creation |
| `debug-error` | Systematically debug and resolve errors using structured hypothesis-driven investigation |
| `clean-branch` | Safely clean up merged, stale, and unnecessary git branches with dry-run preview |
| `migration-guide` | Create step-by-step migration guides for upgrading dependencies, frameworks, or architectural changes |
| `estimate-assistant` | Provide data-driven task estimates using git history, code complexity analysis, and similar past work |

### Operations & Observability

| Skill | Description |
|---|---|
| `troubleshooting` | Generate codebase-aware troubleshooting documentation with diagnostic procedures, error references, and recovery steps |
| `go-logging` | Audit and improve Go service logging for Splunk/Datadog — ensures structured logs with TraceID, SpanID, timing, and request details |
| `otel-trace-analysis` | Analyze OpenTelemetry traces for latency issues, error diagnosis, retry patterns, and dependency bottlenecks |
| `backstage` | Create or update catalog-info.yaml files for Backstage developer portal onboarding |

### Browser & Accessibility Testing

| Skill | Description |
|---|---|
| `playwright-dev` | Write and execute Playwright browser checks and API checks with auto-detection and universal executor |
| `core-web-vitals` | Measure and assert Core Web Vitals (LCP, INP, CLS) in Playwright scripts with HTML/Markdown reporting |
| `evinced-web-sdk` | Add accessibility scanning to Playwright checks via Evinced SDK for WCAG compliance |

### Utilities

| Skill | Description |
|---|---|
| `ultra-think` | Engage deep multi-perspective analysis for complex architectural decisions and strategic problem-solving |
| `search-web` | Search the web, evaluate sources, and synthesize findings with citations |
| `session-summary` | Create a detailed session summary capturing actions, decisions, costs, efficiency insights, and next steps |
| `create-onboarding` | Generate codebase-aware onboarding documentation by analyzing the project's tech stack, structure, and workflows |

---

## Docs

Reference documentation that provides Claude Code with domain-specific knowledge. Place in `~/.copilot/docs/` to make available globally.

### General

| Doc | Purpose |
|---|---|
| `best-of-the-best.md` | Curated best practices across engineering disciplines |
| `comprehensive.md` | Comprehensive engineering guidelines |
| `cwv.md` | Core Web Vitals optimization reference |
| `informal.md` | Informal engineering notes and patterns |
| `mcp-notes.md` | Model Context Protocol implementation notes |

### Go

Complete Go engineering reference covering architecture, patterns, performance, scalability, security, style, and testing. Includes RichRelevance integration patterns.

### JavaScript / TypeScript

Complete JS/TS engineering reference covering architecture, caching, patterns, performance, scalability, security, style, testing, and TypeScript component patterns.

### OpenTelemetry

Agent notes for working with OpenTelemetry traces and distributed system observability.

---

## Skill Anatomy

Each skill follows a consistent structure:

```
skills/example-skill/
├── SKILL.md              # Main skill definition (required)
└── references/           # Supporting material (optional)
    ├── patterns.md
    └── examples.md
```

### SKILL.md Format

```markdown
---
name: example-skill
description: One-line description of what this skill does
---

# Skill Title

Brief description of purpose.

## Usage

How to invoke: `/example-skill [arguments]`

## Instructions

Step-by-step workflow...
```

The `name` field determines the slash command name. The `description` field is used for skill discovery and matching.

---

## Contributing

### Adding a new skill

1. Create a directory under `skills/` with a kebab-case name
2. Add a `SKILL.md` with YAML frontmatter (`name`, `description`)
3. Keep the core workflow to 6-10 actionable steps
4. Extract verbose examples and templates into `references/`
5. Include an output format section so results are consistent

### Adding a new agent

1. Add a `.md` file under `agents/` with a descriptive name
2. Define the agent's expertise, persona, and behavioral guidelines
3. Specify which tools the agent should use

### Guidelines

- Keep skills focused — one clear purpose per skill
- Include `$ARGUMENTS` for user-provided input where applicable
- Specify output format so results are structured and consistent
- No company-specific references, API keys, or credentials
- Test your skill by invoking it in Claude Code before submitting
