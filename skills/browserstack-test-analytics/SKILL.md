---
name: browserstack-test-analytics
description: "Analyze BrowserStack Test Management plans, runs, cases, execution results, defects, and comments; save a traceable Markdown report."
---

# BrowserStack Test Analytics

Use the BrowserStack MCP to report analytics for one or more BrowserStack Test Management projects. A test plan can contain test runs, a run can contain test cases, and a case can have multiple execution attempts within the same run. Preserve those relationships and repeated attempts in the report.

## Usage

Invoke `/browserstack-test-analytics [PROJECT_ID ...] [report filters]`. If no project ID is supplied, use `PR-104`. Accept one or more project IDs. Use any date range, plan, run, case, or status filters supplied by the user; otherwise analyze the available project data.

## Instructions

1. **Establish scope and available reads**
   - Resolve project IDs from the invocation, defaulting to `PR-104`; deduplicate them and preserve the IDs in the report.
   - Use read-only BrowserStack MCP tools. Never create or update projects, plans, runs, cases, results, or other BrowserStack data as part of reporting.
   - Prefer available direct list/detail tools. If a requested data type is not exposed directly, discover the relevant Test Management capability using the BrowserStack MCP's product and capability discovery flow: list products with the user's request, search within the exact product name returned, describe a matching capability, then invoke it.
   - If product discovery reports an ambiguous product clash, ask the user which product they mean and wait. After the user answers, pass that answer verbatim as `user_words` and the latest `routing_token` to `searchCapability`; do not repeat `listProducts`. Use the product's exact `name` from the product list (not its display title).
   - If a capability search reports a weak match, search again using its suggested vocabulary. Do not invoke a capability until its contract has been described and confirmed to be a read.

2. **Control MCP traffic**
   - BrowserStack MCP calls can be rate-limited. Make at most one BrowserStack MCP call at a time; do not fan out calls in parallel.
   - Prefer paginated or bulk reads over one-call-per-record detail retrieval. Page sequentially, request only fields and records needed for the requested report, and reuse results already fetched during this run.
   - Avoid repeating a query unless its result is incomplete or a specific missing field needs follow-up. On a rate-limit response, stop issuing calls, record the affected query and data, and retry only if the service provides a safe retry indication. Do not loop on errors.

3. **Collect plans and hierarchy**
   - List test plans for each project, requesting the largest supported page size and following the response's pagination metadata. Some APIs use `p` rather than `page`; honor the described contract.
   - Retrieve plan details and linked-run summaries for the discovered plans. If sub-plans are available, list them page by page and retrieve their details as needed; retain each sub-plan's parent relationship.
   - Preserve plan IDs, names, states, dates, linked run IDs, and returned status/case summaries. Do not infer missing links or treat a missing plan as an empty plan.

4. **Collect runs, cases, and executions**
   - List project runs with the requested filters and available pagination. Include closed runs when reporting project-wide totals; some run listings exclude them by default. Reconcile plan-linked runs with the project run list; identify runs not linked to any retrieved plan as unlinked rather than dropping them.
   - For daily plan/run performance requests, discover and use a read-only execution-trend capability when available. Follow its contract for numeric project/plan/run IDs; anchor the trend to the requested end date or the plan's end date when appropriate, and scope to exactly one plan or run.
   - Retrieve run cases in the largest supported page size. Request step definitions only when needed; some APIs lower the page-size ceiling when steps are included. Keep step definitions distinct from recorded step outcomes.
   - Retrieve run-level results and case-level result details using available read tools or verified read capabilities. Prefer bulk result reads; when history is available only per case, prioritize requested or failed/defect-linked cases and clearly report any unqueried remainder. Gather test case metadata for cases present in the requested runs; retrieve the broader project case catalog only when the user asks for it or it is needed to interpret the requested report.
   - Preserve each execution occurrence/attempt, even when the same test case appears multiple times in one run. Report attempt-level status and details, then aggregate by case and run without deduplicating attempts.
   - Retrieve defect associations, step results, step comments, and both test-case comment threads when available. In-run comments and comments on the case itself are separate threads; do not treat one as the other. Use numeric IDs from a field or URL only when the capability contract explicitly identifies that source; never guess or convert a display identifier such as `TP-73` or `TC-22936`. Keep each result attached to its source project, plan/sub-plan, run, case, and attempt or step where the MCP provides those identifiers.
   - Check the response's `success` value as well as HTTP status. Some comment reads return HTTP 200 for permission or plan-entitlement errors. Treat those as unavailable data, not an empty comment list.

5. **Summarize faithfully**
   - Report the statuses and counts returned by BrowserStack. If calculating a rate or total, show its numerator, denominator, included statuses, and treatment of skipped, pending, blocked, or otherwise non-executed items.
   - For trend charts, label date-to-date differences as changes between returned points, not exact execution-attempt counts. Keep omitted dates as “no data point returned,” not zero activity, and preserve the source timezone.
   - Distinguish an empty result from unavailable or unqueried data. Do not infer that defects, comments, steps, attempts, or linked records do not exist merely because a response omits them.
   - Include source IDs and enough provenance to trace findings. Include an associated user's name, username, or account identifier in follow-up items only when BrowserStack returned it and linked it to the affected record; never guess an owner or include unrelated user accounts.

6. **Write the Markdown report**
   - Save the report in `reports/browserstack-test-analytics-YYYY-MM-DD.md` in the current workspace, including the project IDs in the report. Create the `reports/` directory if needed. If that filename already exists, use a timestamped filename instead of overwriting it.
   - Include:
     1. Scope, generation date, project IDs, filters, and data sources queried.
     2. Executive summary and overall status/statistics, with formulas for derived metrics.
     3. Plan and sub-plan inventory with linked runs and plan-level summaries.
     4. Run-level status/results and test case execution details, retaining repeated attempts.
     5. Case metadata, defect associations, step results/comments, and case comments when available.
     6. A **Follow-up / Data unavailable** table with the requested field or record, affected project/plan/run/case/step IDs, what's missing and why, and any source-provided associated user/account identifier.
     7. Data-coverage notes, rate limits or errors, and any interpretation caveats.
   - Mark the report **partial** when requested information could not be retrieved. Write as much verified information as possible and list each gap for follow-up; do not stop the whole report because a subset of data is unavailable.
   - Confirm the report file was written and give the user its path and a concise summary of completeness.

