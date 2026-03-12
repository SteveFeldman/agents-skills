---
name: security-hardening
description: "Apply security best practices to reduce attack surface — authentication, input validation, headers, encryption, and dependency updates"
---

# Security Hardening

Apply code-level security best practices to reduce attack surface and improve security posture.

> **Prerequisite:** Consider running `/security-audit` first to identify what needs hardening.

## Instructions

1. **Security Assessment and Baseline**
   - Scan the codebase for existing security controls
   - Identify potential vulnerabilities: hardcoded secrets, missing validation, insecure defaults
   - Review authentication and authorization mechanisms
   - Review data handling and storage practices
   - **Verify:** List all identified vulnerabilities with severity ratings before proceeding

2. **Authentication and Authorization Hardening**
   - Implement strong password hashing (bcrypt, argon2) if not already present
   - Configure secure session management with proper timeouts and rotation
   - Set up role-based access control (RBAC) with least privilege principle
   - Implement JWT security best practices: short expiry, proper signing, refresh token rotation
   - Add brute force protection: rate limiting on login endpoints, account lockout
   - **Verify:** Test login with invalid credentials to confirm lockout/rate limiting works

3. **Input Validation and Sanitization**
   - Implement comprehensive input validation for all user inputs (type, length, format)
   - Use parameterized queries or ORM methods to prevent SQL injection
   - Apply output encoding to prevent XSS (context-aware: HTML, JS, URL, CSS)
   - Implement CSRF protection with tokens and SameSite cookie attribute
   - Add file upload security: type validation, size limits, rename on storage
   - **Verify:** Test each form/endpoint with malicious input samples (e.g., `<script>alert(1)</script>`, `' OR 1=1 --`)

4. **Security Headers Configuration**
   - Set `Content-Security-Policy` header with restrictive directives
   - Set `X-Frame-Options: DENY` (or `SAMEORIGIN` if framing is needed)
   - Set `X-Content-Type-Options: nosniff`
   - Set `Referrer-Policy: strict-origin-when-cross-origin`
   - Set `Permissions-Policy` to disable unused browser features (camera, microphone, geolocation)
   - Configure `Strict-Transport-Security` with `max-age`, `includeSubDomains`
   - **Verify:** Check response headers using `curl -I` or browser dev tools to confirm all headers are present

5. **CORS Policy Hardening**
   - Configure CORS with explicit allowed origins (never use `*` in production)
   - Restrict allowed methods and headers to what is actually needed
   - Set `credentials: true` only when required, with specific origins
   - **Verify:** Test cross-origin requests from unauthorized origins to confirm they are blocked

6. **Secrets and Configuration Security**
   - Move all hardcoded secrets to environment variables or a secrets manager
   - Add secret patterns to `.gitignore` (`.env`, `*.pem`, `*.key`)
   - Rotate any secrets that were previously committed to version control
   - Use different secrets for each environment (dev, staging, production)
   - **Verify:** Search codebase with `grep -r` for common secret patterns (API keys, passwords, tokens)

7. **Data Protection and Encryption**
   - Encrypt sensitive data at rest (PII, payment data, credentials)
   - Use secure key management: never store encryption keys alongside encrypted data
   - Implement proper password hashing with unique salts
   - Sanitize sensitive data from logs, error messages, and API responses
   - **Verify:** Review log output and error responses to confirm no sensitive data leaks

8. **Dependency and Supply Chain Security**
   - Audit all dependencies for known vulnerabilities (`npm audit`, `pip-audit`, `bundle audit`)
   - Update vulnerable dependencies to patched versions
   - Pin dependency versions with lockfiles (`package-lock.json`, `Pipfile.lock`, `Gemfile.lock`)
   - Remove unused dependencies to reduce attack surface
   - **Verify:** Run vulnerability scanner after updates to confirm zero known vulnerabilities

9. **Secure Error Handling**
   - Configure error handling to never expose stack traces, internal paths, or system details to users
   - Return generic error messages to clients; log detailed errors server-side
   - Implement proper logging for security events (failed logins, permission denials, input validation failures)
   - Add structured logging with correlation IDs for incident investigation
   - **Verify:** Trigger errors in each endpoint and confirm responses contain no internal details

10. **Security Testing and Validation**
    - Add security-focused test cases: injection attempts, auth bypass, privilege escalation
    - Integrate SAST tools into the CI/CD pipeline (e.g., Semgrep, Bandit, ESLint security plugins)
    - Configure dependency vulnerability scanning in CI (e.g., Dependabot, Snyk)
    - Create a security checklist for code reviews
    - **Verify:** Run the full test suite and SAST scan to confirm all checks pass
