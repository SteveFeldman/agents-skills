---
name: dependency-audit
description: "Audit all project dependencies for security vulnerabilities, outdated packages, license compliance, and health"
---

# Dependency Audit

Analyze and audit all dependencies in any codebase for security, performance, and maintenance concerns.

## Instructions

Perform a comprehensive dependency audit following these steps:

### 1. Auto-Detect Package Manager

Scan the project root to identify the ecosystem and dependency files:

| File Found | Ecosystem | Audit Command | Outdated Command |
|---|---|---|---|
| `package.json` / `package-lock.json` / `yarn.lock` | Node.js | `npm audit` or `yarn audit` | `npm outdated` |
| `requirements.txt` / `Pipfile` / `pyproject.toml` | Python | `pip-audit` or `safety check` | `pip list --outdated` |
| `go.mod` | Go | `govulncheck ./...` | `go list -m -u all` |
| `Cargo.toml` | Rust | `cargo audit` | `cargo outdated` |
| `pom.xml` / `build.gradle` | Java/Kotlin | `mvn dependency-check:check` or `gradle dependencyCheckAnalyze` | `mvn versions:display-dependency-updates` |
| `Gemfile` | Ruby | `bundle audit check` | `bundle outdated` |
| `composer.json` | PHP | `composer audit` | `composer outdated` |

If multiple ecosystems are present, audit each one separately.

### 2. Dependency Discovery

- Map direct vs transitive dependencies
- Check for lock files and version consistency
- Review development vs production dependency separation
- Identify any vendored or pinned dependencies

### 3. Version Analysis

- Run the appropriate outdated command from step 1
- Identify packages with major version updates available (breaking changes likely)
- Flag packages more than 2 major versions behind
- Review semantic versioning compliance and pinning strategy

### 4. Security Vulnerability Scan

- Run the appropriate audit command from step 1
- Cross-reference with GitHub security advisories when possible
- Classify every finding by severity:

| Severity | Action Required |
|---|---|
| **Critical** | Immediate update or patch required |
| **High** | Update within current sprint |
| **Medium** | Schedule for next release cycle |
| **Low** | Track and update when convenient |

- Note any CVE references for Critical/High findings

### 5. License Compliance

- Review all dependency licenses for compatibility with the project license
- Flag restrictive licenses (GPL, AGPL, SSPL) that may conflict with proprietary use
- Flag any dependencies with missing or unclear license information
- Summarize license obligations

### 6. Dependency Health Assessment

- Check maintenance status: last release date, open issues, commit activity
- Flag packages with no release in the last 12 months as potentially abandoned
- Flag packages marked as deprecated
- Note packages with very few maintainers (bus factor risk)

### 7. Size and Performance Impact

- Identify the largest dependencies by install or bundle size
- Check for duplicate functionality across dependencies
- Suggest lighter alternatives where a large dependency is used for a small feature
- For frontend projects: note tree-shaking compatibility

### 8. Dependency Conflicts

- Check for version conflicts between dependencies
- Identify peer dependency issues
- Review dependency resolution warnings from the package manager
- Flag potential breaking changes in pending updates

### 9. Supply Chain Security

- Check for typosquatting risks (packages with names similar to popular packages)
- Review any packages pulled from non-standard registries
- Flag dependencies with unusually low download counts or recent ownership changes
- Verify lock file integrity

### 10. Update Strategy

- Create a prioritized update plan:
  1. Critical/High security vulnerabilities first
  2. Deprecated packages second
  3. Major version updates with breaking changes third
  4. Minor/patch updates last
- Identify breaking changes and required code modifications for each major update
- Recommend testing approach for each update batch

### 11. Monitoring Recommendations

- Recommend automated scanning setup (Dependabot, Renovate, Snyk, or ecosystem-specific tools)
- Suggest a regular audit cadence (monthly for active projects)
- Note any CI integration opportunities for continuous vulnerability scanning

### 12. Documentation and Reporting

- Create a comprehensive dependency inventory table
- Document all security findings with remediation steps
- Provide update recommendations with priority levels

### 13. Structured Report Output

Present findings in this format:

```markdown
## Dependency Audit Report

**Project:** [name]
**Date:** [date]
**Ecosystem(s):** [detected ecosystems]
**Total Dependencies:** [direct] direct, [transitive] transitive

### Security Findings

| Severity | Package | Current Version | Issue | Remediation |
|---|---|---|---|---|
| Critical | example-pkg | 1.2.3 | CVE-XXXX-YYYY | Upgrade to 1.2.4 |

### Outdated Packages

| Package | Current | Latest | Type (major/minor/patch) | Risk |
|---|---|---|---|---|

### License Summary

| License | Count | Compatible | Notes |
|---|---|---|---|

### Health Concerns

| Package | Issue | Recommendation |
|---|---|---|

### Recommended Actions (Priority Order)

1. [Immediate] ...
2. [This sprint] ...
3. [Next release] ...
4. [When convenient] ...
```

Focus on actionable recommendations with clear risk assessments and specific commands to run for remediation.
