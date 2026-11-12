---
name: confluence-daily
description: "Publish daily test-cycle reports (derived from BrowserStack Markdown reports) as Confluence child pages under a test-run summary parent page, using the Atlassian MCP."
---

# Confluence Daily Reports

Publish one Confluence page per testing day, plus a parent summary page, from Markdown reports produced by `/browserstack-test-analytics`. Modeled on the `TP-73 Daily Report — 2026-10-*` pages (parent: "Test Run 2 Summary") and reused for TP-59 ("Test Run 1 Summary").

## Usage

`/confluence-daily <PLAN_ID> <PARENT_PAGE_ID> [date ...]`

Inputs:
- Plan ID (e.g. `TP-73`) and project (default `PR-104`).
- Parent page ID or URL (e.g. `7284162564`). Create the parent first if it does not exist.
- Source Markdown: one `tp-<n>-daily-YYYY-MM-DD.md` per day and one `tp-<n>-final-summary-*.md`. If missing, run `/browserstack-test-analytics` first.
- Atlassian MCP enabled. Site `https://totalwine.atlassian.net`, space ID `8192001`.

## Goals

- Each page shows only progress up to that day and what remains as of that day (back-dated reports are allowed; going forward, run the day after a testing day).
- Statistics are easy to validate: show formulas, counts and sources.
- Call out repeated executions (same day) and reruns (later days).
- Include every Jira ticket for that day and a case-ID → title key.
- Pages are compact summaries; line-by-line event/step detail stays in the Markdown source. Say so on the page; never imply completeness.

## Workflow

1. **List existing children** of the parent: `executeRead` with `name: getConfluenceContentDescendants`, `inputs: {contentId, depth: 1, limit: 50}`. Skip or update (never duplicate) pages whose title already exists. Updating needs the `snapshotToken` from a `detail: full` read.
2. **Read one existing page** (`getConfluenceContent`, `content_format: markdown`, `detail: full`) as a style reference.
3. **Build each body** from the day's Markdown, in the section order below. Keep tables as tables; escape `_` in case titles (`State\_Assortment`) to avoid italic artifacts.
4. **Create** with `createConfluenceContent`: `contentType: live_doc`, `parent: {"parentContentId": "<id>"}`, title `<PLAN> Daily Report — YYYY-MM-DD` (em dash). Create sequentially, one call at a time.
5. **Verify**: re-list children (count = number of testing days, no duplicates), read each page's `outline`, spot-check one table against the source Markdown.
6. **Update the parent** from the final summary (section structure below), including the linked-run/day count.
7. Report page IDs and any gaps to the user.

## Daily page structure (in order)

Intro paragraph: "This daily report summarizes execution activity for plan <PLAN> on <date> within <Test Run N> (<TP>). It captures the trend snapshot, notable terminal outcomes recorded on the date, repeat-result indicators, the case title key, and coverage notes from the uploaded report." Then `**Context:**` with run window and case count.

1. `# Progress Summary` — table `Metric | Value | Notes`: Project/Plan, Report date (UTC), Passed, Failed, Blocked, Skipped, Untested, total status counts, pass rate, change from previous point, result records created, step-level records.
   - Pass rate = Passed / (Passed + Failed + Blocked + Skipped); Untested excluded. State the numerator/denominator ("258 of 286").
2. `# Charts` — `## Overall Status Breakdown` (Status | Count | % of total | Fixed visual using █ bars) and `## <MM-DD> Terminal Results by Run` (Run | Passed | Failed | Blocked | In Progress | Total | Visual, with a bold Total row). Add a note that run totals are event counts, not reconciled totals.
3. `# Jira Statistics and Evidence` — a `**Scope:**` line, a Metric | Value | Evidence table (tickets mentioned, included tickets created that day, structured associations, note evidence, current statuses, excluded prior tickets), then:
   - `## Included Jira tickets created from <MM-DD> testing`: Ticket (linked `https://totalwine.atlassian.net/browse/KEY`) | Created (ET) | Summary | Test evidence | Status / priority. Escape `|` in summaries.
   - `## Excluded Jira references created before <MM-DD>`: Ticket | Created | Why excluded.
   - If none, say so and add the caveat that absence is not proof no defect existed.
4. `# Terminal Case Outcomes Recorded on Date` — Run | Case | Current title | Terminal status | Time (UTC) | Observation. For busy days use `# Key Follow-up Outcomes` (Time | Run / Case | Final recorded status | Observation), prioritizing failed/blocked cases linked to Jira.
5. `# Repeat-Result Indicators` — Run | Case | Configuration | Terminal-status records today | Prior-day terminal-status records. Label as "possible same-day repeat" / "possible subsequent-day rerun". Long tails go in a collapsed/expanded list below the table. Note these are evidence for review, not verified attempt counts.
6. `# Case Title Key` — Case ID | Current title | Current run assignee. Include every case ID mentioned on the page, sorted.
7. `# Coverage and Limitations` — Area | Detail | Implication, covering: history retrieval coverage (N of M run/case pairs; list any unavailable and why), historical reconstruction, modified results, chart timestamps (00:00 UTC, start/end-of-day undocumented), count semantics (net changes, not attempts; missing dates ≠ zero activity), defects/comments not reconstructed, source systems. Close with a pointer to the Markdown source for event-level detail.

## Parent summary page structure

`## <Test Run N> summary`, header line (`**Project:** PR-104 | **Plan:** <PLAN> — name | **Compiled:** date`), overall results paragraph, then:
`### Key takeaways` (bullets) · `### Final status breakdown` (Status | Count | Share of classified statuses) · `### Linked run summary` (Run | Name | State | Passed | Failed | Blocked | Skipped) · `### Jira issue summary` plus an "Important caveat" paragraph · `### Data notes` (bullets, including cancelled programs/unavailable histories). Link or list the daily child pages.

## Rules

- Never fabricate data; every number must trace to the Markdown source.
- Result records ≠ attempts. Chart changes are net differences.
- Jira creation dates are local (ET); BrowserStack events are UTC. A Jira link or mention does not prove causation.
- Case titles are current, not historically verified.
- Jira statuses are as of lookup time, not the report date.
- Date/time Confluence macros read back empty in Markdown (lossy); write dates as plain text (`2026-10-28`).
- Do not parallelize Atlassian writes; one create/update at a time.
- Do not bypass TLS or reuse credentials for unrelated access; local files cannot be attached through the MCP.

## QA checklist

- [ ] One page per testing day, titles match `<PLAN> Daily Report — YYYY-MM-DD`, all under the parent, no duplicates
- [ ] Section order matches above; each page's counts sum to the status total
- [ ] Pass-rate formula and denominator stated
- [ ] Every Jira key in the day's source appears (included or excluded)
- [ ] Repeat/rerun call-outs present; case title key covers all cases referenced
- [ ] No unescaped underscores/pipes breaking tables
- [ ] Parent page counts and links updated
