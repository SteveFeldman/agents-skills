# Estimation Models Reference

Code examples and patterns for building estimation models. These are reference implementations to illustrate approaches — adapt them to your specific tooling and data sources.

## Time-Based Historical Estimator

```javascript
class HistoricalEstimator {
  constructor(gitData, linearData) {
    this.gitData = gitData;
    this.linearData = linearData;
    this.authorVelocity = new Map();
    this.fileTypeMultipliers = new Map();
  }

  calculateAuthorVelocity(author) {
    const authorCommits = this.gitData.filter(c => c.author === author);
    const taskCompletions = this.linearData.filter(t =>
      t.assignee === author && t.completedAt
    );

    // Lines of code per day
    const totalLines = authorCommits.reduce((sum, c) =>
      sum + c.additions + c.deletions, 0
    );
    const totalDays = this.calculateWorkDays(authorCommits);
    const linesPerDay = totalLines / totalDays;

    // Story points per sprint
    const pointsCompleted = taskCompletions.reduce((sum, t) =>
      sum + (t.estimate || 0), 0
    );
    const sprintCount = this.countSprints(taskCompletions);
    const pointsPerSprint = pointsCompleted / sprintCount;

    return {
      linesPerDay,
      pointsPerSprint,
      averageTaskDuration: this.calculateAverageTaskDuration(taskCompletions),
      accuracy: this.calculateEstimateAccuracy(taskCompletions)
    };
  }

  estimateTask(description, assignee = null) {
    const features = this.extractFeatures(description);
    const similarTasks = this.findSimilarTasks(features);
    let baseEstimate = this.calculateMedianEstimate(similarTasks);

    const complexityMultiplier = this.calculateComplexityMultiplier(features);
    baseEstimate *= complexityMultiplier;

    if (assignee) {
      const velocity = this.calculateAuthorVelocity(assignee);
      const teamAvgVelocity = this.calculateTeamAverageVelocity();
      const velocityRatio = velocity.pointsPerSprint / teamAvgVelocity;
      baseEstimate *= (2 - velocityRatio);
    }

    const confidence = this.calculateConfidence(similarTasks.length, features);

    return {
      estimate: Math.round(baseEstimate),
      confidence,
      range: {
        min: Math.round(baseEstimate * 0.7),
        max: Math.round(baseEstimate * 1.5)
      },
      basedOn: similarTasks.slice(0, 3),
      factors: this.explainFactors(features, complexityMultiplier)
    };
  }
}
```

## Pattern Recognition / Feature Extraction

```javascript
function extractFeatures(taskDescription) {
  const features = {
    keywords: [],
    fileTypes: [],
    modules: [],
    complexity: 'medium',
    type: 'feature', // feature, bug, refactor, etc.
    hasTests: false,
    hasUI: false,
    hasAPI: false,
    hasDatabase: false
  };

  // Keywords that indicate complexity
  const complexityKeywords = {
    high: ['refactor', 'migrate', 'redesign', 'optimize', 'architecture'],
    medium: ['implement', 'add', 'create', 'update', 'integrate'],
    low: ['fix', 'adjust', 'tweak', 'change', 'modify']
  };

  // Detect task type
  if (taskDescription.match(/bug|fix|repair|broken/i)) {
    features.type = 'bug';
  } else if (taskDescription.match(/refactor|cleanup|optimize/i)) {
    features.type = 'refactor';
  } else if (taskDescription.match(/test|spec|coverage/i)) {
    features.type = 'test';
  }

  // Detect components
  features.hasUI = /UI|frontend|component|view|page/i.test(taskDescription);
  features.hasAPI = /API|endpoint|route|REST|GraphQL/i.test(taskDescription);
  features.hasDatabase = /database|DB|migration|schema|query/i.test(taskDescription);
  features.hasTests = /test|spec|TDD|coverage/i.test(taskDescription);

  // Extract file types mentioned
  const fileTypeMatches = taskDescription.match(/\.(js|ts|jsx|tsx|py|java|go|rb|css|scss)/g);
  if (fileTypeMatches) {
    features.fileTypes = [...new Set(fileTypeMatches)];
  }

  return features;
}
```

## Velocity Tracker

```javascript
class VelocityTracker {
  async analyzeVelocity(timeframe = '3 months') {
    const completedTasks = await this.getCompletedTasks(timeframe);

    const analysis = {
      team: {
        plannedPoints: 0,
        completedPoints: 0,
        averageVelocity: 0,
        velocityTrend: [],
        estimateAccuracy: 0
      },
      individuals: new Map(),
      taskTypes: new Map()
    };

    const tasksBySprint = this.groupBySprint(completedTasks);

    for (const [sprint, tasks] of tasksBySprint) {
      const sprintVelocity = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
      const sprintActual = tasks.reduce((sum, t) => sum + (t.actualPoints || t.estimate || 0), 0);

      analysis.team.velocityTrend.push({
        sprint,
        planned: sprintVelocity,
        actual: sprintActual,
        accuracy: sprintVelocity ? (sprintActual / sprintVelocity) : 1
      });
    }

    const tasksByAssignee = this.groupBy(completedTasks, 'assignee');
    for (const [assignee, tasks] of tasksByAssignee) {
      analysis.individuals.set(assignee, {
        tasksCompleted: tasks.length,
        pointsCompleted: tasks.reduce((sum, t) => sum + (t.estimate || 0), 0),
        averageAccuracy: this.calculateAccuracy(tasks),
        strengths: this.identifyStrengths(tasks)
      });
    }

    return analysis;
  }
}
```

## ML-Based Estimator

```javascript
class MLEstimator {
  trainModel(historicalTasks) {
    const features = historicalTasks.map(task => ({
      titleLength: task.title.length,
      descriptionLength: task.description.length,
      hasAcceptanceCriteria: task.description.includes('Acceptance'),
      filesChanged: task.linkedPR?.filesChanged || 0,
      linesAdded: task.linkedPR?.additions || 0,
      linesDeleted: task.linkedPR?.deletions || 0,
      labels: task.labels.length,
      hasDesignDoc: task.attachments?.some(a => a.title.includes('design')),
      dependencies: task.blockedBy?.length || 0,
      assigneeAvgVelocity: this.getAssigneeVelocity(task.assignee),
      teamLoad: this.getTeamLoad(task.createdAt),
      actualEffort: task.actualPoints || task.estimate
    }));

    return this.fitLinearModel(features);
  }

  predict(taskDescription, context) {
    const features = this.extractTaskFeatures(taskDescription, context);
    const prediction = this.model.predict(features);

    const similarityScore = this.calculateSimilarity(features);
    const uncertainty = 1 - similarityScore;

    return {
      estimate: Math.round(prediction),
      confidence: similarityScore,
      breakdown: this.explainPrediction(features, prediction)
    };
  }
}
```
