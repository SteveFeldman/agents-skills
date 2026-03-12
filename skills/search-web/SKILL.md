---
name: search-web
description: "Search the web, evaluate sources, and synthesize findings with citations"
---

# Search Web

Search the web and synthesize an answer for: **$ARGUMENTS**

## Steps

1. **Parse the Query** - Extract the core question or topic from `$ARGUMENTS`. Identify keywords and intent.

2. **Search** - Use the WebSearch tool to find relevant results. Run multiple searches with varied keywords if the first set of results is insufficient.

3. **Evaluate Sources** - Prioritize official documentation, peer-reviewed sources, and well-known technical references. Discard results that are outdated, low-quality, or irrelevant.

4. **Fetch Key Pages** - Use WebFetch on the most promising URLs to get full content when search snippets are not enough.

5. **Synthesize Findings** - Combine information from multiple sources into a clear, direct answer. Resolve conflicting information by noting the disagreement and which source is more authoritative.

6. **Cite Sources** - Include URLs for every claim so the user can verify.

## Output Format

```markdown
## Answer

[Clear, direct answer to the query in 1-3 paragraphs]

## Sources

1. [Source title](URL) - [one-line summary of what this source contributed]
2. [Source title](URL) - [one-line summary]
3. [Source title](URL) - [one-line summary]
```
