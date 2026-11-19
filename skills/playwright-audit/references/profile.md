# Project profile: `.pw-audit.json`

Optional file at the repo root. It tells the audit what is intentional in this project so it grades against the project's conventions rather than generic ones.

```json
{
  "testIdAttribute": "data-qa",
  "acceptedDeviations": ["PW406", "PW302"],
  "allowedCredentials": [
    { "path": "^playwright_tests/test-data/accounts\\.", "reason": "Shared QA persona logins on the non-production environment" }
  ],
  "ignore": ["^playwright_tests/legacy/"]
}
```

| Key | Meaning |
|---|---|
| `testIdAttribute` | Custom attribute accepted as a first-class locator. Auto-detected from `testIdAttribute` in config or the most common `[data-*=...]` in locators when omitted |
| `acceptedDeviations` | Rule IDs not counted as findings (reported in `acceptedDeviations` output). Each must have a reason in the report |
| `allowedCredentials` | Scopes PW205 only. Each entry has a `path` regex (repo-relative) and a required `reason`. Matching files are not flagged, and the count suppressed per entry is reported in the output as `allowedCredentials` so the exception stays visible |
| `ignore` | Regex list on repo-relative paths excluded from the scan |

## Guidance

- Add an accepted deviation only with a reason, ideally as a comment in the PR that adds it. A profile that accepts everything defeats the audit.
- Good candidates: PW302 for suites that only target a shared live environment, PW406 when `baseURL` comes from a helper rather than a literal in the config.
- Prefer inline `// pw-audit-ignore PWxxx reason` for one-off cases so the justification sits next to the code.
- Use `allowedCredentials` for files that hold expected, non-production test accounts. Scope it to those files, not the whole tree, so a real secret elsewhere is still caught. A credential for a service or admin console (not a user persona) should be moved to an environment variable instead of allowed.
