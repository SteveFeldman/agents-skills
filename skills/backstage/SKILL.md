---
name: backstage
description: Use when creating or updating catalog-info.yaml files for Backstage, onboarding repositories to the software catalog, or configuring service metadata for developer portal visibility
---

# Backstage Catalog Configuration

## Overview

Generate `catalog-info.yaml` files that register services, APIs, and resources in Backstage's software catalog. This skill provides organization-specific patterns and required annotations.

## When to Use

- Creating a new repository that needs Backstage registration
- Adding `catalog-info.yaml` to an existing repo
- Updating service metadata, dependencies, or ownership
- Connecting APIs, databases, or external resources

## Quick Reference

| Component Type | `spec.type` | Use For |
|----------------|-------------|---------|
| Backend service | `service` | APIs, microservices |
| Frontend app | `website` | MFEs, SPAs, web apps |
| Shared code | `library` | npm packages, shared modules |

| Lifecycle | When to Use |
|-----------|-------------|
| `experimental` | In development, not production-ready |
| `production` | Live, actively maintained |
| `deprecated` | Being phased out |

## Core Template

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: your-service-name
  description: Brief description of what this service does
  tags:
    - api  # or: oc, mfe, library
  annotations:
    # Required annotations
    backstage.io/kubernetes-id: your-service-name
    backstage.io/kubernetes-namespace: your-namespace
    sonarqube.org/project-key: your-service-name
    jenkins.io/job-full-name: digital:org/your-service-name
    backstage.io/techdocs-ref: dir:.
    opsgenie.com/component-selector: 'tag:"app:your-service-name"'
    opsgenie.com/team: 'Digital Developers'
    github.com/project-slug: org/your-service-name
  links:
    - title: QA Logs
      icon: ManageSearch
      url: https://splunk.example.com/en-US/app/search/search?q=search%20index%3D%22gke_staging_logs%22%20cluster_name%3A%3Astaging-digital%20namespace%3D%22YOUR_NAMESPACE%22%20pod%3D%22develop-YOUR_SERVICE-*%22
    - title: UAT Logs
      icon: ManageSearch
      url: https://splunk.example.com/en-US/app/search/search?q=search%20index%3D%22gke_staging_logs%22%20cluster_name%3A%3Astaging-digital%20namespace%3D%22YOUR_NAMESPACE%22%20pod%3D%22YOUR_SERVICE-*%22
    - title: Production Logs
      icon: ManageSearch
      url: https://splunk.example.com/en-US/app/search/search?q=search%20index%3D%22gke_logs%22%20cluster_name%3A%3Aproduction-digital%20namespace%3D%22YOUR_NAMESPACE%22%20pod%3D%22YOUR_SERVICE-*%22
    - title: Service Restart - QA
      icon: RestartAlt
      url: https://admin.staging.example.com/jenkins/job/org/job/job-deployment-restart/job/master/parambuild/?environment=Staging&namespace=YOUR_NAMESPACE&deploymentName=develop-YOUR_SERVICE&clusterType=mos
    - title: Service Restart - UAT
      icon: RestartAlt
      url: https://admin.staging.example.com/jenkins/job/org/job/job-deployment-restart/job/master/parambuild/?environment=Staging&namespace=YOUR_NAMESPACE&deploymentName=YOUR_SERVICE&clusterType=mos
    - title: Service Restart - Prod
      icon: RestartAlt
      url: https://admin.staging.example.com/jenkins/job/org/job/job-deployment-restart/job/master/parambuild/?environment=Production&namespace=YOUR_NAMESPACE&deploymentName=YOUR_SERVICE&clusterType=mos

spec:
  type: service  # or: website, library
  lifecycle: production
  owner: group:default/YOUR_TEAM

  # For services that provide APIs
  providesApis:
    - your-api-name

  # Dependencies on other components/resources
  dependsOn:
    - resource:default/your-database-resource
    - component:default/another-service
```

## Adding an API Definition

For services that expose APIs, add a second document:

```yaml
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: your-api-name
spec:
  type: openapi
  lifecycle: production
  owner: group:default/YOUR_TEAM
  definition:
    $text: https://api-internal.staging.example.com/YOUR_NAMESPACE/develop-YOUR_SERVICE/swagger-ui/swagger.json
```

## Team Ownership

Format: `group:default/team-name`

Common teams:
- `group:default/upfunnel` - Product discovery, search, categories
- Check existing catalog for other team references

## Common Annotations

| Annotation | Purpose |
|------------|---------|
| `backstage.io/kubernetes-id` | Links to K8s deployment |
| `backstage.io/kubernetes-namespace` | K8s namespace |
| `sonarqube.org/project-key` | SonarQube code quality |
| `jenkins.io/job-full-name` | Jenkins pipeline path |
| `backstage.io/techdocs-ref` | TechDocs location (usually `dir:.`) |
| `opsgenie.com/component-selector` | OpsGenie alert routing |
| `opsgenie.com/team` | OpsGenie team |
| `github.com/project-slug` | GitHub repo reference |
| `backstage.io/source-location` | Source code URL (for non-K8s components) |

## Link Icons

| Icon | Use For |
|------|---------|
| `ManageSearch` | Log viewers (Splunk) |
| `RestartAlt` | Service restart actions |
| `DataThresholding` | Grafana dashboards |
| `OpenInBrowserIcon` | External URLs, registries |

## OpenComponent (OC) Pattern

For OpenComponent libraries (not deployed to K8s):

```yaml
metadata:
  tags:
    - oc
  annotations:
    # NO kubernetes-id or kubernetes-namespace
    sonarqube.org/project-key: your-component
    backstage.io/source-location: url:https://github.com/org/your-component
  links:
    - title: QA OpenComponent Registry
      url: https://qa.example.com/registry/your-component/X.X.X/~info
      icon: OpenInBrowserIcon
spec:
  type: website
  # NO providesApis for OC components
```

## MFE (Micro-Frontend) Pattern

```yaml
metadata:
  annotations:
    backstage.io/kubernetes-id: your-mfe
    # Often NO kubernetes-namespace for MFEs
  links:
    - title: Production grafana mfe dashboard
      url: https://grafana.example.com/d/iquxNcS4k/mfe-dashboard?var-app=your-mfe
      icon: DataThresholding
spec:
  type: website
  dependsOn:
    - component:backend-service-it-calls
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `owner` | Always specify `group:default/team-name` |
| Wrong `spec.type` | Use `service` for APIs, `website` for frontends |
| Hardcoded URLs | Use URL-encoded parameters in Splunk links |
| Missing namespace in links | QA uses `develop-*`, UAT/Prod use service name directly |
| Duplicate links | Review for accidental copy-paste duplication |

## Validation

Place `catalog-info.yaml` in repository root. Backstage will auto-discover and validate on commit.
