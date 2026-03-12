---
name: migration-guide
description: "Create step-by-step migration guides for upgrading dependencies, frameworks, or architectural changes"
---

# Migration Guide Generator

Create a comprehensive, actionable migration guide for: **$ARGUMENTS**

## Steps

1. **Scope the Migration**
   - Identify what is being migrated (framework, library, database, architecture)
   - Determine source and target versions or technologies
   - List all affected systems, services, and components

2. **Assess Impact**
   - Catalog breaking changes between source and target
   - Identify deprecated features and removed APIs
   - Evaluate performance, security, and compatibility implications

3. **Document Prerequisites**
   - System and tooling requirements for the target
   - Minimum dependency versions and compatibility matrix
   - Infrastructure or environment changes needed

4. **Create Step-by-Step Migration Plan**
   - Order steps so the project builds and passes tests after each one
   - Include specific commands to run at each step
   - Call out steps that are reversible vs. point-of-no-return

5. **Document Breaking Changes with Before/After Comparisons**

   Use this format for every breaking change:

   ```markdown
   ### Changed: `createRoot` replaces `ReactDOM.render`
   **Before:**
   ```js
   ReactDOM.render(<App />, document.getElementById('root'));
   ```

   **After:**
   ```js
   const root = createRoot(document.getElementById('root'));
   root.render(<App />);
   ```

   **Why:** Enables concurrent rendering features.
   ```

6. **Define Testing Strategy**
   - Update existing tests for new APIs
   - Add migration-specific regression tests
   - Run integration and E2E suites at each phase
   - Include performance benchmarks before and after

7. **Plan Rollback Procedures**
   - Document how to revert each step
   - Identify data migration steps that require special rollback handling
   - Define go/no-go criteria for proceeding vs. rolling back

8. **Common Issues and Troubleshooting**
   - List known migration pitfalls with symptoms and solutions
   - Include error messages developers are likely to encounter

9. **Deployment Strategy**
   - Plan phased rollout (blue-green, canary, or incremental)
   - Set up monitoring and health checks for the new version
   - Define success criteria for each deployment phase

10. **Post-Migration Cleanup**
    - Remove deprecated code, shims, and compatibility layers
    - Update documentation and onboarding materials
    - Conduct a retrospective and capture lessons learned

## References

See `references/migration-patterns.md` for type-specific guidance on framework upgrades, database migrations, cloud migrations, and monolith-to-microservices transitions.
