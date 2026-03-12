---
name: create-feature
description: "Plan and implement new features with structured workflow from requirements through testing and PR creation"
---

# Create Feature

Implement a new feature following a structured workflow from planning through PR creation.

## Instructions

Follow this approach to create the feature: **$ARGUMENTS**

### 1. Understand Requirements

- Clarify the feature requirements and acceptance criteria. Ask the user if anything is ambiguous.
- Identify affected components and potential impact areas in the codebase.
- Review existing code patterns and conventions (`CLAUDE.md`, `README.md`, `CONTRIBUTING.md`).

### 2. Plan the Implementation

- Break the feature into smaller, ordered tasks.
- Design the API/interface contracts before writing implementation code.
- Plan database schema changes or migrations if needed.
- Identify external dependencies or libraries required.

### 3. Create a Feature Branch

- Create a branch: `git checkout -b feature/$ARGUMENTS`
- Install any new dependencies required.

### 4. Implement the Feature

- Start with core functionality and build incrementally.
- Follow the project's coding standards, patterns, and existing conventions.
- Implement proper error handling and input validation.
- Handle database migrations, API endpoints, and frontend changes as applicable.
- Keep security in mind: validate inputs, check authorization, avoid hardcoded secrets.

### 5. Write Tests

- Write unit tests for core business logic.
- Create integration tests for API endpoints or cross-module interactions.
- Test error scenarios, edge cases, and boundary conditions.
- Run the full test suite to ensure no regressions: use the project's test command.

### 6. Verify Quality

- Run linting and formatting tools (use the project's configured tools).
- Perform a self-review of all changes: `git diff`.
- Check for unused imports, dead code, or debugging artifacts left behind.
- Verify the feature works end-to-end against the acceptance criteria.

### 7. Add Documentation

- Add inline code documentation for complex logic.
- Update API documentation if endpoints were added or changed.
- Update `README.md` if setup steps or configuration changed.

### 8. Commit Changes

- Create atomic commits with descriptive messages.
- Follow conventional commit format if the project uses it.
- Separate refactoring commits from feature commits where possible.

### 9. Push and Create PR

- Push the feature branch: `git push -u origin feature/$ARGUMENTS`
- Create a PR with `gh pr create` including:
  - Clear description of what the feature does and why.
  - Summary of the implementation approach.
  - Testing instructions or screenshots if applicable.
  - Links to related issues or specifications.

### 10. Address Review Feedback

- Respond to code review comments with fixes or explanations.
- Push additional commits for review feedback (don't force-push during review).
- Re-run tests after making changes.
