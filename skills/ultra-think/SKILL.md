---
name: ultra-think
description: "Engage deep multi-perspective analysis for complex architectural decisions, trade-offs, and strategic problem-solving"
---

# Ultra Think

Engage in deep, systematic analysis for complex problems that require exploring trade-offs, architectural decisions, and strategic thinking across multiple perspectives.

## Instructions

1. **Initialize Deep Analysis**
   - Acknowledge the request for enhanced analytical depth
   - Set context for thorough, multi-perspective reasoning
   - Parse the core challenge from: **$ARGUMENTS**

2. **Decompose the Problem**
   - Extract the core challenge and constraints
   - Identify all stakeholders affected
   - Recognize implicit requirements and hidden complexities
   - Question assumptions and surface unknowns
   - Define what success looks like

3. **Multi-Dimensional Analysis**
   Approach the problem from four perspectives:

   ### Technical Perspective
   - Analyze feasibility, scalability, performance, and maintainability
   - Evaluate security implications
   - Assess technical debt and future-proofing

   ### Business Perspective
   - Understand business value and ROI
   - Consider time-to-market pressures
   - Assess risk vs. reward trade-offs

   ### User Perspective
   - Analyze user needs and pain points
   - Consider usability and accessibility
   - Think about edge cases in user journeys

   ### System Perspective
   - Consider system-wide impacts and integration points
   - Evaluate dependencies and coupling
   - Think about emergent behaviors and failure modes

4. **Generate Multiple Solutions**
   - Produce at least 3 distinct approaches
   - For each approach, evaluate:
     - Pros and cons
     - Implementation complexity and resource requirements
     - Risks and mitigation strategies
     - Long-term implications
   - Include both conventional and creative solutions
   - Consider hybrid approaches

5. **Deep Dive on Top Candidates**
   - For the most promising solutions:
     - Sketch a detailed implementation plan
     - Identify potential pitfalls and mitigation strategies
     - Analyze second and third-order effects
     - Think through failure modes and recovery
     - Consider phased rollout or MVP approach

6. **Challenge and Stress-Test**
   - Play devil's advocate with each solution
   - Identify weaknesses and blind spots
   - Run "what if" scenarios (scale 10x, team changes, requirements shift)
   - Stress-test core assumptions
   - Look for unintended consequences

7. **Synthesize and Recommend**
   Present findings in this structure:

   ```
   ## Problem Analysis
   - Core challenge
   - Key constraints
   - Critical success factors

   ## Solution Options
   ### Option 1: [Name]
   - Description
   - Pros/Cons
   - Implementation approach
   - Risk assessment
   - Confidence: [Low/Medium/High]

   ### Option 2: [Name]
   [Same structure]

   ## Recommendation
   - Recommended approach and rationale
   - Confidence: [Low/Medium/High]
   - Implementation roadmap
   - Success metrics
   - Risk mitigation plan

   ## Open Questions
   - Areas of uncertainty
   - Additional expertise or data needed
   - Contrarian considerations
   ```

   **Include a confidence level (Low/Medium/High) for each recommendation**, with a brief explanation of what drives the confidence rating.

8. **Meta-Reflection**
   - Identify areas of remaining uncertainty
   - Acknowledge biases or limitations in the analysis
   - Suggest what additional information would increase confidence
   - Note where the analysis could be wrong

## Key Principles

- **First Principles Thinking**: Break down to fundamental truths, don't reason by analogy alone
- **Systems Thinking**: Consider interconnections, feedback loops, and emergent behavior
- **Probabilistic Thinking**: Work with uncertainties and ranges, not false precision
- **Inversion**: Consider what to avoid, not just what to pursue
- **Second-Order Thinking**: Trace the consequences of consequences

## Usage Examples

```bash
# Architectural decision
/ultra-think Should we migrate to microservices or improve our monolith?

# Complex trade-off
/ultra-think How do we scale to 10x traffic while reducing costs?

# Strategic choice
/ultra-think What technology stack should we choose for our next-gen platform?

# Design challenge
/ultra-think How can we improve our API ergonomics while maintaining backward compatibility?
```

## Output Expectations

- Comprehensive analysis (typically 2-4 pages)
- Multiple viable solutions with honest trade-offs
- Clear reasoning chains with confidence levels
- Acknowledgment of uncertainties
- Actionable recommendations with concrete next steps
