---
name: troubleshooting
description: "Generate codebase-aware troubleshooting documentation with diagnostic procedures, error references, and recovery steps"
---

# Troubleshooting Guide Generator

Create troubleshooting documentation that is grounded in the actual codebase, covering real failure modes, error codes, and recovery procedures.

## Instructions

1. **Analyze the Application**
   - Read the project structure, entry points, and configuration files
   - Identify the tech stack, frameworks, and external dependencies
   - Map critical paths: authentication flow, data processing pipeline, API endpoints
   - Identify integration points: databases, caches, message queues, third-party APIs
   - Review existing error handling patterns and logging setup

2. **Identify Failure Modes**
   - Trace each critical path and identify where it can fail
   - Review error classes, exception handlers, and error codes defined in the codebase
   - Check for common issues: missing environment variables, connection timeouts, permission errors
   - Identify failure modes specific to the tech stack (e.g., ORM connection pool exhaustion, event loop blocking)
   - Note any known issues from comments, TODOs, or issue trackers

3. **Define Severity Levels**
   - Establish severity classifications for the project:

   | Severity | Definition | Response Time | Escalation |
   |----------|-----------|---------------|------------|
   | **P1 - Critical** | System down, data loss, security breach | Immediate | On-call lead, management |
   | **P2 - High** | Major feature broken, significant user impact | Within 2 hours | Senior engineer |
   | **P3 - Medium** | Minor feature issue, workaround available | Within 8 hours | Assigned engineer |
   | **P4 - Low** | Cosmetic issue, minor inconvenience | Next sprint | Backlog |

4. **Create Diagnostic Procedures**
   - For each identified failure mode, write a diagnostic procedure:
     - **Symptoms:** What the user or monitoring system observes
     - **Diagnostic steps:** Specific commands or checks to run, in order
     - **Root cause indicators:** What to look for in logs, metrics, or state
   - Use actual log file paths, service names, and config locations from the codebase
   - Reference the project's specific diagnostic commands (see `references/diagnostic-commands.md` for generic examples)

5. **Document Error Codes and Messages**
   - Catalog all custom error codes and error messages from the codebase
   - For each error code, document:
     - What triggers it (the code path)
     - What it means for the user
     - How to resolve it
   - Include relevant HTTP status codes returned by the application's API endpoints

6. **Write Recovery Procedures**
   - For each failure mode, document step-by-step recovery:
     - Immediate mitigation (stop the bleeding)
     - Root cause fix
     - Verification that the fix worked
     - Post-recovery cleanup
   - Include rollback procedures for deployments
   - Document data recovery steps where applicable

7. **Define Escalation Paths**
   - Map escalation paths based on severity and component ownership
   - Document what information to include when escalating:
     - Error messages and stack traces
     - Timeline of events
     - Steps already attempted
     - Impact assessment (users affected, data at risk)
   - Include communication templates for incident notifications

8. **Document Environment-Specific Issues**
   - Cover common development environment setup problems
   - Document staging vs. production differences that cause issues
   - Include solutions for local development pitfalls (port conflicts, missing env vars, dependency issues)
   - Note any environment-specific configuration that frequently causes problems

9. **Create Preventive Checklist**
   - Pre-deployment verification steps specific to this codebase
   - Health check endpoints and how to verify them
   - Configuration validation procedures
   - Dependency health checks (database connectivity, API availability)

10. **Compile the Troubleshooting Guide**
    - Organize all content into a searchable document structure
    - Use consistent formatting: Symptom, Diagnosis, Resolution, Prevention
    - Include a quick-reference table of common issues and solutions
    - Add links to relevant code files, config locations, and log paths
    - Write for the audience: assume the reader has access to the codebase but may not know it deeply
