---
name: create-onboarding
description: "Generate codebase-aware onboarding documentation by analyzing the project's tech stack, structure, and workflows"
---

# Create Onboarding Guide

Generate a codebase-aware onboarding guide for new developers by analyzing the actual project, not from generic templates.

## Instructions

### 1. Analyze the Repository

Before writing anything, read the codebase to extract real information:

- Read `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and any existing docs.
- Examine the directory structure to understand project organization.
- Auto-detect the tech stack from configuration files (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `pom.xml`, etc.).
- Identify build commands, test commands, and lint commands from config files and scripts.
- Check for containerization (`Dockerfile`, `docker-compose.yml`) or other environment setup.
- Review `.env.example` or similar files for required environment variables.

### 2. Document Environment Setup

Based on what you found in step 1, write concrete setup instructions:

- List required tools and versions (language runtime, package manager, database, etc.).
- Provide step-by-step installation and configuration commands.
- Document environment variables needed and where to get their values.
- Include a "verify your setup" section with commands to confirm everything works.
- Add troubleshooting tips for common setup issues found in the codebase.

### 3. Explain the Project Structure

- Describe what the project does and its business context (from README and code).
- Map the directory structure with explanations of what each top-level directory contains.
- Identify entry points (main files, route definitions, API handlers).
- Document key modules, their responsibilities, and how they interact.
- List the major dependencies and what each is used for.

### 4. Document Development Workflows

- Describe the branching strategy (examine existing branches and any documented conventions).
- Document how to run the project locally (dev server, watch mode, etc.).
- Explain the testing approach: how to run tests, what test framework is used, where tests live.
- Document the build and deployment process if visible from the repo.
- Describe code review and PR conventions.

### 5. Provide Key Code Patterns

- Show examples of the project's coding patterns (e.g., how a new API endpoint is added, how a new component is created).
- Document any custom abstractions, base classes, or utility functions new developers should know about.
- Point out configuration files and what they control.
- Note any non-obvious conventions or "gotchas" in the codebase.

### 6. Suggest First Tasks

- Identify good first issues or areas where a new developer can start contributing.
- Suggest small, self-contained changes that help learn the codebase (add a test, fix a linting issue, update docs).
- Recommend key files to read first to understand the system.

### 7. Create the FAQ

- Document common questions based on what might confuse a newcomer.
- Include answers to "how do I..." questions for common development tasks.
- Add links to relevant external documentation for the tech stack.

## Output

Produce a single `ONBOARDING.md` file in the repository root containing all sections above. Use concrete commands, real file paths, and actual project details — not placeholders or generic advice.
