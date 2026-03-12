# Migration Patterns Reference

Type-specific considerations for common migration scenarios.

## Framework Migration (e.g., React 17 to 18)

- Update framework and related packages (e.g., ReactDOM) together
- Replace deprecated lifecycle methods or APIs incrementally
- Handle new features (concurrent rendering, Suspense) behind feature flags initially
- Update testing library methods to match new APIs
- Run codemods when available (e.g., `npx react-codemod rename-unsafe-lifecycles`)

## Database Migration (e.g., MySQL to PostgreSQL)

- Convert SQL syntax differences (e.g., `AUTO_INCREMENT` to `SERIAL`, backticks to double quotes)
- Map data types: `TINYINT(1)` to `BOOLEAN`, `DATETIME` to `TIMESTAMP`, etc.
- Rewrite stored procedures as PostgreSQL functions
- Update ORM configurations and connection strings
- Run dual-write during transition to validate data consistency
- Use `pgLoader` or similar tools for bulk data transfer

## Cloud Migration (e.g., On-Premise to AWS)

- Containerize applications before migrating
- Update CI/CD pipelines for cloud deployment targets
- Replace local file storage with cloud object storage (S3, GCS)
- Configure IAM roles, security groups, and network policies
- Implement infrastructure as code (Terraform, CloudFormation)
- Set up cloud-native monitoring and logging (CloudWatch, Datadog)

## Architecture Migration (e.g., Monolith to Microservices)

- Identify service boundaries using domain-driven design
- Extract services incrementally, starting with the least coupled modules
- Implement inter-service communication (REST, gRPC, message queues)
- Set up service discovery and load balancing
- Plan data consistency strategies (saga pattern, eventual consistency)
- Add distributed tracing and centralized logging from the start

## Timeline Template

```markdown
### Phase 1: Preparation (Week 1-2)
- [ ] Environment setup and tooling updates
- [ ] Team training on target technology
- [ ] Development branch migration

### Phase 2: Implementation (Week 3-6)
- [ ] Core application migration
- [ ] Testing and validation
- [ ] Performance benchmarking

### Phase 3: Deployment (Week 7-8)
- [ ] Staging deployment and soak testing
- [ ] Production rollout (phased)
- [ ] Monitoring and incident response
```

## Risk Mitigation

- Always maintain a rollback path for at least 2 weeks post-migration
- Run the old and new systems in parallel when feasible
- Communicate progress and blockers to stakeholders weekly
- Document every issue encountered for future migration efforts
