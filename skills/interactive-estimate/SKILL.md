---
name: software-estimation
description: Produce data-driven software delivery estimates by analyzing historical JIRA tickets, git activity, and engineer track records, then matching the new work against the most similar past tickets. Use this skill whenever the user asks "how long will this take", wants to estimate a piece of work, scope an epic, plan a sprint, or estimate delivery for JIRA stories or a Figma design. Also use whenever the user wants developer-to-work assignment recommendations based on history, wants to optimize an estimate by adding or reallocating engineers, or asks "what's the fastest way to ship this" or "who should work on this". Especially trigger when the user provides JIRA ticket IDs, JIRA story links, or Figma designs together with any indication of a team that will execute the work.
---

# Software Estimation

This skill produces evidence-based delivery estimates by mining historical team performance from JIRA and git, matching the new work against similar past tickets, and recommending who should work on what. It also evaluates optimization scenarios — adding engineers, reallocating focus — to find faster delivery paths.

Estimates are always presented as ranges with explicit assumptions, never single-point predictions. Internal estimates are planning tools, not contracts.

## When to use

Trigger this skill any time the user wants an estimate for new work, particularly when they provide:
- One or more JIRA stories/epics (by key, link, or description), or
- A Figma design (URL, screenshots, or description)

…together with any indication of a team that will execute the work.

## Workflow

The skill runs in four phases:

1. **Collect inputs** — interactive Q&A for team, time window, repos, work type, testing tier.
2. **Gather historical signal** — JIRA history and git activity for the named engineers and repos.
3. **Build the estimate** — match scope against similar past tickets, compute a range, detect parallel streams.
4. **Optimize and report** — recommend developer assignments and surface scenarios that shorten delivery.

---

## Phase 1: Collect inputs

The scope should be in the initial prompt — either JIRA ticket IDs/links or a Figma design (URL or attached screenshots). If scope is missing, ask for it before doing anything else; the skill cannot produce a useful estimate without knowing what's being built.

Once scope is present, collect the remaining inputs in one structured ask. Prefer `ask_user_input_v0` for the multi-choice questions (work type, testing tier); for free-text fields, ask in a single numbered list and wait for a combined reply.

**Required inputs:**

1. **Engineers in scope** — comma-separated list of identifiers (JIRA usernames, GitHub handles, or display names). These are the people who will do the work and whose history feeds the estimate.

2. **Historical window** — how far back to analyze. Default: last 6 months. Shorter windows are noisier (small samples); longer windows pull in stale velocity from before tooling/process changes.

3. **Repositories** — list of repo names to include. Used both for historical analysis and for identifying which services the new work touches.

4. **Engineer count** — how many of the listed engineers are concurrently allocated to this work (integer ≤ length of the engineer list).

5. **Work type** — one of: new feature, refactor, bug, migration, mixed. Similar-ticket matching filters on this; velocity differs meaningfully across types and mixing them produces misleading averages.

6. **Testing requirements** — one of: unit only, unit + integration, + Playwright E2E, + BrowserStack matrix, + UAT with stakeholders. Each tier adds calendar overhead the estimate must account for.

After collecting inputs, echo them back as a confirmed summary before moving on. A 10-second confirmation prevents a regeneration.

---

## Phase 2: Gather historical signal

Run these in parallel where possible.

### Pull JIRA history

The Atlassian tools are deferred — call `tool_search` with a query like "jira issues" to load them before use. Do not guess JQL parameter names; the tool schemas are the source of truth.

For each engineer in the input list, query their resolved tickets in the historical window:

```
assignee = "<user>" AND resolved >= -<N>d AND project in (<keys>) ORDER BY resolved DESC
```

Capture per ticket: key, type, components, story points (if any), created/resolved timestamps (for cycle time), summary, labels.

If JIRA project keys aren't obvious from the repo list, ask the user once for the list of project keys. Don't guess.

### Pull git activity (recommended)

If repo access is available, capture per-engineer commit counts and PR cycle times per repo in the window. This is the strongest signal for repo familiarity, which drives developer-to-work matching.

If git access isn't available, fall back to JIRA components as a proxy for repo familiarity — in most teams components map roughly to services/repos.

### Find similar past tickets

For the new scope:
- **JIRA stories provided:** pull each ticket's full body, extract components, labels, and key nouns from summary/description.
- **Figma design provided:** ask the user once for a hint about which services/microfrontends are in scope. Without this, similar-ticket matching becomes pure guesswork.

Then search JIRA for the 5–10 most similar resolved tickets in the historical window using JQL with matching components + work type + key terms. These are the strongest empirical signal for the estimate — they outweigh team-wide velocity averages because they capture the actual cost of work in this specific codebase.

---

## Phase 3: Build the estimate

### Compute the base estimate

Combine three signals in this order of weight:

1. **Similar-ticket cycle time (highest weight).** Take the median and p80 cycle time of the similar past tickets. If the new scope decomposes to roughly N tickets-equivalent, the base range is `N × median` (optimistic) to `N × p80` (conservative). When decomposing the new scope into ticket-equivalents, lean on the granularity of the matched historical tickets — if past similar tickets averaged 2–3 days each, decompose the new scope to similarly-sized chunks.

2. **Engineer throughput (sanity check).** Compute average tickets-per-week or story-points-per-week for the assigned engineers in the window. Cross-check against the similar-ticket math: if they disagree by more than 2×, **surface the disagreement in the report rather than averaging**. The user needs to know which assumption is wrong.

3. **Testing tier multiplier.** Apply on top of the base:
   - Unit only: 1.0×
   - + Integration: 1.15×
   - + Playwright E2E: 1.3×
   - + BrowserStack matrix: 1.45×
   - + UAT with stakeholders: 1.6× (UAT adds calendar time waiting on stakeholders, not engineering time — flag this distinction)

These multipliers are rules of thumb. State them explicitly in the report so they can be adjusted.

### Detect parallelism

Build a dependency graph:
- From JIRA "blocks/blocked by" links between the input stories.
- From service/component overlap (work in the same service usually serializes; work in different services usually parallelizes).
- From Figma input: infer from the service hints the user provided.

The shape of this graph determines how the estimate scales with engineer count. Two engineers on one sequential chain is barely faster than one; two engineers on two parallel streams is roughly 2× faster minus coordination overhead.

### Cross-stack inference (default ON)

By default, infer the "other side" of the scope and include it in the estimate:
- JIRA backend stories → estimate also covers the UI work needed to expose the feature (or explicitly note "no UI work assumed" if the stories make that clear).
- Figma design → estimate also covers new backend endpoints, schema changes, and integrations the screens imply (e.g., a checkout screen implies payment integration work).

Every inferred item must appear explicitly in the "Scope as understood" section of the report so the user can correct false inferences before treating the number as real.

---

## Phase 4: Optimize and report

### Developer-to-work matching

For each work segment (usually one per service touched), rank the input engineers by a combined score:
- **Familiarity:** JIRA tickets resolved in that component plus commits in that repo within the window.
- **Velocity:** their median cycle time on similar past tickets (lower is better).

Output a recommended assignment per segment with a one-line rationale grounded in the data. Good rationale looks like: "Alice → `cart-service`: 23 tickets resolved there in the window, median cycle time 1.8 days vs. team median 2.4 days." Bad rationale looks like: "Alice is a good fit." If you can't tie it to a number, don't include the assignment.

### Estimate optimizer

Starting from the base estimate with the user-specified engineer count, evaluate scenarios:
- For each engineer in the input list who isn't already assigned, simulate adding them at 0.25, 0.5, 0.75, and 1.0 FTE on each parallel stream.
- For each scenario, recompute the calendar estimate, accounting for:
  - **Brooks's Law overhead:** adding to an established stream costs ~10–20% in coordination; reflect this in the model.
  - **Onboarding cost:** if the added engineer has low familiarity in the target repo, deduct their first 1–2 weeks of effective output.
  - **Review capacity:** more parallel streams need more senior reviewer time. If the team has only one senior, parallelism stalls on review.

**Surface only scenarios that yield ≥15% reduction off the base estimate.** Drop scenarios where overhead cancels the parallelism gain. If no scenario qualifies, say so explicitly — "the current team composition is already near-optimal for this scope" — rather than padding the report with marginal options.

Cap headcount suggestions at the size of the input engineer list. If analysis suggests external expertise would unlock more parallelism (e.g., "this would benefit from someone with deep `payment-service` experience, but no one in the input list has it"), surface this as a separate **team composition observation**, not as a numeric scenario.

### Output format

Produce a Markdown report with this structure (lead with the summary so the answer is on the first screen):

```markdown
# Estimate: <scope summary>

## Summary
- **Base estimate:** <X–Y> engineer-weeks, <A–B> calendar weeks with <N> engineers
- **Confidence:** <Low / Medium / High> — based on <similar-ticket sample size, signal agreement, scope clarity>
- **Top risk:** <single biggest uncertainty>

## Scope as understood
- Explicit from input: <bulleted list>
- Inferred (please confirm or correct):
  - <inferred item> — <why this was inferred>

## How this estimate was built
- Similar past tickets (n=<count>): <list with keys, cycle times, median, p80>
- Engineer throughput sanity check: <number> — <agrees with / disagrees with> similar-ticket math
- Testing tier multiplier: <value> for <tier>
- Parallelism: <serial / N parallel streams identified from <source>>

## Recommended assignments
- <Engineer> → <service/segment>: <data-grounded rationale>
- ...

## Optimization scenarios
- **Scenario 1:** <description> → <new estimate>, savings: <delta and %>
- **Scenario 2:** ...
- (If none qualify) No optimization scenarios yield ≥15% improvement with the current team. <Team composition observation, if any.>

## Assumptions
- <every assumption made: inferred scope items, multiplier values, parallelism interpretation, any signal that was missing>
```

---

## Important behaviors

- **Always show the work.** Every number in the report must trace to inputs or historical data. If a signal is missing, say so — don't fill the gap with a plausible-looking guess.
- **Estimates are ranges, never single points.** A single number invites being held to it.
- **Surface signal disagreements.** If similar-ticket math says 3 weeks and team throughput says 8 weeks, the report says both and asks the user which assumption to trust. Do not split the difference silently.
- **No invisible padding.** Every multiplier is explicit and labeled in the report.
- **Confirm scope before generating the estimate.** Echo back the understood scope and inferred items, get a yes/correction, then produce the report.
- **Graceful degradation.** If the Atlassian MCP isn't connected or git access isn't available, run with what's available and clearly flag in the "Confidence" line that the estimate is operating on partial signal.
