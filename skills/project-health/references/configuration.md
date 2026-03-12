# Project Health Configuration

## Threshold Configuration

Customize scoring thresholds by creating a `health-check-config.yml` in the project root:

```yaml
# health-check-config.yml
thresholds:
  velocity_variance: 20    # Acceptable % variance between sprints
  test_coverage: 80        # Minimum coverage % for GREEN status
  pr_review_time: 4        # Maximum hours before YELLOW status
  bug_rate: 5              # Maximum % of work items that are bugs
  dependency_age: 90       # Days before a dependency is "outdated"
  complexity_score: 10     # Maximum cyclomatic complexity for GREEN
  code_duplication: 3      # Maximum duplication % for GREEN
```

## Custom Health Metrics

Define additional metrics to include in the health report:

```yaml
custom_metrics:
  - name: "Customer Satisfaction"
    data_source: api        # api | manual | file
    target_value: ">4.5"
    weight: 0.1             # Impact on overall score (0.0 - 1.0)

  - name: "Deployment Frequency"
    data_source: file
    file_path: "./metrics/deployments.json"
    target_value: ">2 per week"
    weight: 0.15
```

## Export Options

The health report can be output in multiple formats:
1. **Markdown** - Default, suitable for GitHub issues or Confluence
2. **JSON** - Raw metrics for dashboards (Grafana, Datadog)
3. **CSV** - For spreadsheet analysis and historical tracking
4. **Action Items** - As Linear tasks or GitHub issues

## Automation

Suggested automation setup:
- Schedule weekly health checks via CI cron job
- Set up alerts when any dimension drops below 50/100
- Auto-create Linear tasks for critical action items
- Generate PR templates that include health check criteria
