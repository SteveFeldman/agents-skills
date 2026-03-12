---
name: security-audit
description: "Identify security vulnerabilities across dependencies, auth, input validation, data protection, secrets, and infrastructure"
---

# Security Audit

Identify security vulnerabilities in the codebase. This skill **finds** problems; for remediation, use the `/security-hardening` skill.

## Instructions

Perform a systematic security audit following these steps:

1. **Automated Dependency Scan**
   Run the appropriate audit command for the detected ecosystem as the first step:
   - **Node.js:** `npm audit` or `yarn audit`
   - **Python:** `pip-audit` or `safety check`
   - **Go:** `govulncheck ./...`
   - **Rust:** `cargo audit`
   - **Ruby:** `bundle audit check`
   - **Java:** `mvn dependency-check:check` or `gradle dependencyCheckAnalyze`

   Record all findings with their CVE IDs before proceeding.

2. **Environment and Stack Assessment**
   - Identify the technology stack, framework, and runtime
   - Check for existing security tools and configurations (linters, SAST, WAF)
   - Review deployment and infrastructure setup

3. **Authentication and Authorization**
   - Review authentication mechanisms (OAuth, JWT, sessions, API keys)
   - Check session management: expiry, rotation, invalidation
   - Verify authorization controls: role checks, resource-level permissions
   - Examine password policies and storage (bcrypt, argon2 vs. plaintext/MD5)

4. **Input Validation and Injection**
   - Check all user input paths for validation and sanitization
   - Look for SQL injection: raw queries, string concatenation with user input
   - Identify XSS vectors: unescaped output, unsafe innerHTML usage, template injection
   - Review file upload handling: type validation, size limits, storage location

5. **Data Protection**
   - Identify sensitive data (PII, credentials, financial data) and how it flows through the system
   - Check encryption at rest (database, file storage) and in transit (TLS configuration)
   - Review data masking in logs, error messages, and API responses
   - Verify secure protocols: TLS 1.2+, no mixed content

6. **Secrets Management**
   - Scan for hardcoded secrets, API keys, and passwords in source code
   - Check `.env` files, config files, and CI/CD variables for exposed secrets
   - Verify secrets are loaded from a vault or environment, not committed to the repo
   - Check `.gitignore` for proper exclusion of sensitive files

7. **Error Handling and Logging**
   - Review error messages for information disclosure (stack traces, DB schemas, internal paths)
   - Check that sensitive data is never logged (tokens, passwords, PII)
   - Verify security events are logged (failed logins, permission denials, input validation failures)

8. **Infrastructure Security**
   - Review container security: base image, running as non-root, no secrets in layers
   - Check CI/CD pipeline: secret injection, artifact signing, dependency pinning
   - Examine cloud permissions: least-privilege IAM, public bucket/storage exposure
   - Review network configuration: open ports, security groups, firewall rules

9. **Security Headers and CORS**
   - Check HTTP security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
   - Review CORS configuration: overly permissive origins, credential handling
   - Verify CSP (Content Security Policy) is present and restrictive
   - Examine cookie attributes: `Secure`, `HttpOnly`, `SameSite`

10. **Report Findings**
    Document all findings using the severity format below. Include specific file paths and line numbers.

## Output Format

Rate each finding using CVSS-aligned severity:

```markdown
### [CRITICAL] Hardcoded database password in source code
**File:** `src/config/database.ts:14`
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**Description:** Production database password is committed in plaintext.
**Impact:** Full database access if source code is exposed.
**Remediation:** Move to environment variable or secrets manager.

### [HIGH] SQL injection in user search endpoint
**File:** `src/routes/users.ts:67`
**CWE:** CWE-89 (SQL Injection)
**Description:** User-supplied `query` parameter is concatenated directly into SQL string.
**Impact:** Attacker can read, modify, or delete arbitrary database records.
**Remediation:** Use parameterized queries or ORM query builder.

### [MEDIUM] Missing rate limiting on login endpoint
**File:** `src/routes/auth.ts:23`
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**Description:** No rate limiting or account lockout on `/api/login`.
**Impact:** Enables brute-force password attacks.
**Remediation:** Add rate limiting middleware (e.g., express-rate-limit).

### [LOW] Verbose error messages in production
**File:** `src/middleware/error-handler.ts:8`
**CWE:** CWE-209 (Information Exposure Through Error Messages)
**Description:** Stack traces are returned in API error responses when NODE_ENV is not set.
**Impact:** Leaks internal file paths and dependency versions.
**Remediation:** Default to production mode; return generic error messages.
```

Severity levels:
- **CRITICAL** - Exploitable now with severe impact (data breach, RCE, full system compromise)
- **HIGH** - Exploitable with significant impact or requires minimal prerequisites
- **MEDIUM** - Requires specific conditions to exploit or has limited blast radius
- **LOW** - Informational or defense-in-depth improvement

## Follow-Up

For fixing the vulnerabilities found in this audit, use the `/security-hardening` skill to generate remediation steps and hardened code.
