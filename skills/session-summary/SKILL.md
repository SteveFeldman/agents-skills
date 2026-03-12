---
name: session-summary
description: "Create a detailed session summary capturing actions, decisions, costs, efficiency insights, and next steps"
---

# Session Summary

Create a comprehensive session summary document capturing everything accomplished, decisions made, and what comes next.

## Instructions

1. **Gather Session Context**
   - Review the full conversation history for this session
   - Identify the initial goal or request that started the session
   - Note the total number of conversation turns
   - Note the total cost of the session (if available)

2. **Document Key Actions and Changes**
   - List every meaningful action taken, in chronological order
   - For each action, note what was done and why
   - Run `git diff --stat` to get a summary of files changed
   - Include file paths for all created, modified, or deleted files

3. **Capture Decisions and Rationale**
   - Document every significant decision made during the session
   - Record the reasoning or trade-offs behind each decision
   - Note any alternatives that were considered and rejected

4. **Record Open Questions and Unresolved Items**
   - List any questions that came up but were not answered
   - Note any tasks that were started but not completed
   - Document any issues discovered but not yet addressed
   - Flag any items that need follow-up or clarification

5. **Analyze Efficiency**
   - Note where time was spent well vs. where effort was wasted
   - Identify any repeated work or backtracking
   - Suggest process improvements for future sessions
   - Highlight any tools or techniques that were particularly effective

6. **Define Next Steps**
   - List concrete actions to take in the next session
   - Prioritize by importance and logical order
   - Note any blockers or prerequisites for each next step

7. **Write the Summary File**
   - Generate a slug from the session topic (lowercase, hyphens, no special characters)
   - Create the file as `session_{slug}_{timestamp}.md` where timestamp is `YYYYMMDD_HHMM`
   - Use the following template structure:

## Output Template

```markdown
# Session Summary: {Topic}

**Date:** {date}
**Turns:** {number of conversation turns}
**Cost:** {session cost if available}

## Goal
{What was the objective of this session?}

## Key Actions
- {Action 1}: {brief description}
- {Action 2}: {brief description}
- ...

## Files Changed
{Output of git diff --stat, or manual list}

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| {decision} | {why} |

## Open Questions
- {Question or unresolved item}

## Efficiency Insights
- {What went well}
- {What could improve}

## Next Steps
1. {Most important next action}
2. {Second priority}
3. ...
```
