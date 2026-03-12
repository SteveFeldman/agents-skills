---
name: estimate-assistant
description: "Provide data-driven task estimates using git history, code complexity analysis, and similar past work"
---

# Estimate Assistant

Provide data-driven task estimation based on historical git data, code complexity, and similar past work.

## Instructions

Analyze the task described in **$ARGUMENTS** and produce a data-backed estimate.

### 1. Gather Git History

Collect relevant historical data from the repository:

```bash
# Get commit history with timestamps and authors (last 6 months)
git log --pretty=format:"%h|%an|%ad|%s" --date=iso --since="6 months ago"

# Analyze PR completion times (if gh CLI is available)
gh pr list --state closed --limit 50 --json number,title,createdAt,closedAt,additions,deletions,files

# Get file change frequency to identify hot spots
git log --pretty=format: --name-only --since="6 months ago" | sort | uniq -c | sort -rn | head -20

# Analyze commit patterns by author
git shortlog -sn --since="6 months ago"
```

### 2. Analyze Code Complexity

For the files and modules relevant to the task:

- Count lines of code in the affected area
- Estimate cyclomatic complexity (number of branches, loops, conditions)
- Count dependencies and imports
- Identify how many files will likely need changes
- Check test coverage in the affected area

### 3. Find Similar Past Work

Search the git history for similar completed tasks:

- Look for PRs or commits with related keywords (e.g., if the task is "add OAuth", search for past auth-related PRs)
- Note the time span from first commit to merge for similar work
- Note the number of files changed and lines modified
- Record the actual effort those similar tasks required

### 4. Assess Complexity Factors

Evaluate factors that increase or decrease effort:

| Factor | Impact | Notes |
|---|---|---|
| New code vs refactoring | Refactoring typically 1.3x | Existing code has hidden dependencies |
| External API integration | +20-40% | API docs, auth, error handling |
| Database changes | +15-30% | Migrations, backwards compatibility |
| UI work | +20-30% | Cross-browser, responsive, accessibility |
| Security-sensitive | +20-40% | Review, testing, edge cases |
| Existing test coverage | -10-20% | Safety net for changes |
| Well-documented area | -10-15% | Faster ramp-up |

### 5. Calculate the Estimate

Combine the data:

1. Start with the median duration of similar past tasks
2. Adjust for complexity factors identified in step 4
3. Apply a confidence level based on how much historical data was available
4. Produce optimistic / realistic / pessimistic range

### 6. Produce the Estimate Report

Present findings in this format:

```markdown
## Task Estimation Report

**Task:** [description]
**Date:** [date]

### Estimate: [X] story points (or [X] hours/days)
**Confidence:** [Low/Medium/High] ([percentage]%)
**Range:** [optimistic] - [pessimistic]

### Similar Completed Tasks
1. "[PR/commit title]" - [duration], [files changed], [lines changed]
2. "[PR/commit title]" - [duration], [files changed], [lines changed]
3. "[PR/commit title]" - [duration], [files changed], [lines changed]

### Complexity Factors
- **[Factor]** ([+/- impact]): [explanation]
- **[Factor]** ([+/- impact]): [explanation]

### Affected Areas
- [file/module]: [what changes are needed]
- [file/module]: [what changes are needed]

### Risk Factors
- [risk]: [mitigation]
- [risk]: [mitigation]

### Recommendations
1. [actionable suggestion]
2. [actionable suggestion]

### Breakdown (if applicable)
1. [subtask] - [estimate]
2. [subtask] - [estimate]
3. [subtask] - [estimate]
```

## Tips

- If fewer than 5 similar tasks are found, note that confidence is lower
- Always present a range, not a single number
- Track actual vs estimated for continuous improvement
- Consider external factors (holidays, team changes, on-call rotations)
- For large tasks, break down into subtasks and estimate each

See `references/estimation-models.md` for detailed estimation model examples and pattern recognition approaches.
