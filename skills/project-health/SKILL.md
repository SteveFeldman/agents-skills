---
name: project-health
description: "Multi-dimensional project health dashboard with scoring across delivery, quality, debt, team, and dependency metrics"
---

# Project Health Check

Assess project health with scored metrics across delivery, code quality, technical debt, team performance, and dependencies.

## Instructions

### 1. Gather Data

Collect metrics from available sources. Gracefully skip any tool or data source that is unavailable.

#### Git and Code Metrics
```bash
# Code churn — most frequently changed files
git log --format=format: --name-only --since="30 days ago" | sort | uniq -c | sort -rg

# Contributor activity
git shortlog -sn --since="30 days ago"

# Stale branches
git for-each-ref --format='%(refname:short) %(committerdate:relative)' refs/heads/ | grep -E "(months|years) ago"

# Lines of code (if cloc is available)
cloc . --json --exclude-dir=node_modules,dist,build

# Test coverage
npm test -- --coverage --json 2>/dev/null || echo "Coverage command not available"
```

#### Dependency Health
```bash
# Outdated packages and security vulnerabilities
npm outdated --json 2>/dev/null || pip list --outdated --format=json 2>/dev/null || echo "No package manager detected"
npm audit --json 2>/dev/null || pip-audit --format=json 2>/dev/null || echo "Audit not available"
```

#### Task Management (if Linear/GitHub Projects available)
- Sprint velocity trends
- Cycle time analysis
- Bug vs. feature ratio
- Backlog growth rate

If Linear MCP is not connected, note it and proceed with git/GitHub data only.

### 2. Analyze

- Score each dimension 0-100 based on the data collected
- Identify trends (improving, stable, declining) by comparing to prior periods
- Flag items that cross critical thresholds
- Assess risk by combining likelihood and impact

### 3. Produce Scored Report

Use the template below. Fill in every field you have data for. Mark fields without data as "N/A - [reason]".

```markdown
# Project Health Report - [Project Name]
Generated: [Date]

## Executive Summary
Overall Health Score: [Score]/100 [GREEN Healthy | YELLOW Needs Attention | RED Critical]

### Key Findings
- Strengths: [Top 3 positive indicators]
- Concerns: [Top 3 areas needing attention]
- Critical Issues: [Immediate action items]

## Detailed Health Metrics

1. **Delivery Health** (Score: [X]/100)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Sprint Velocity | [X] pts | [Y] pts | GREEN |
| On-time Delivery | [X]% | 90% | YELLOW |
| Cycle Time | [X] days | [Y] days | GREEN |
| Defect Rate | [X]% | <5% | RED |

2. **Code Quality** (Score: [X]/100)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Test Coverage | [X]% | 80% | YELLOW |
| Code Duplication | [X]% | <3% | GREEN |
| Complexity Score | [X] | <10 | YELLOW |
| Security Issues | [X] | 0 | RED |

3. **Technical Debt** (Score: [X]/100)
- Total Debt Items: [Count]
- Debt Growth Rate: [+/-X% per sprint]
- Estimated Debt Work: [X days]
- Debt Impact: [Description]

4. **Team Health** (Score: [X]/100)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| PR Review Time | [X] hrs | <4 hrs | GREEN |
| Knowledge Silos | [X] | 0 | YELLOW |
| Work Balance | [Score] | >0.8 | GREEN |
| Burnout Risk | [Level] | Low | YELLOW |

5. **Dependency Health** (Score: [X]/100)
- Outdated Dependencies: [X]/[Total]
- Security Vulnerabilities: [Critical: X, High: Y]
- License Issues: [Count]

## Trend Analysis

### Velocity Trend (Last 6 Sprints)
Sprint 1: ████████████ 40 pts
Sprint 2: ██████████████ 45 pts
Sprint 3: ████████████████ 50 pts
Sprint 4: ██████████████ 45 pts
Sprint 5: ████████████ 38 pts
Sprint 6: ██████████ 35 pts -- Declining

### Bug Discovery Rate
Week 1: ██ 2 bugs
Week 2: ████ 4 bugs
Week 3: ██████ 6 bugs -- Increasing
Week 4: ████████ 8 bugs -- Action needed

## Risk Assessment

### High Priority Risks
1. **[Risk Name]**
   - Impact: [Critical/High/Medium/Low]
   - Likelihood: [Confirmed/Likely/Possible]
   - Mitigation: [Specific action]

## Actionable Recommendations

### Immediate (This Week)
1. [Most urgent action]

### Short-term (This Sprint)
1. [Important improvement]

### Long-term (This Quarter)
1. [Strategic initiative]

## Comparison with Previous Health Check
| Category | Last Check | Current | Trend |
|----------|------------|---------|-------|
| Overall Score | [X]/100 | [Y]/100 | [arrow] |
| Delivery | [X]/100 | [Y]/100 | [arrow] |
| Code Quality | [X]/100 | [Y]/100 | [arrow] |
| Technical Debt | [X]/100 | [Y]/100 | [arrow] |
| Team Health | [X]/100 | [Y]/100 | [arrow] |
```

### 4. Graceful Degradation

When tools or data sources are unavailable:
- **No Linear/task tracker:** Skip delivery velocity metrics; estimate from git commit frequency instead
- **No test runner:** Skip coverage metrics; note as "manual assessment needed"
- **No `cloc`/`npm`:** Use git-based heuristics for code metrics
- Always state which data sources were available and which were not, so the reader knows the confidence level of each score

## Configuration

See `references/configuration.md` for threshold customization and custom metric definitions.
