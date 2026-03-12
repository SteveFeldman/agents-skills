---
name: explain-code
description: "Analyze and explain code sections with multi-level explanations tailored to audience experience level"
---

# Explain Code

Analyze and explain code sections in any programming language with clear, comprehensive explanations tailored to the reader's experience level.

## Instructions

Explain the code specified in **$ARGUMENTS**.

### 1. Determine Audience Level

If the user specifies an audience, tailor depth accordingly:

- **Beginner**: Use analogies, avoid jargon, explain fundamental concepts. Define terms like "callback", "promise", "middleware" when they appear.
- **Intermediate**: Assume familiarity with language basics. Focus on the "why" behind design choices, patterns, and architecture.
- **Experienced**: Skip basics. Focus on subtle behaviors, edge cases, performance implications, and framework-specific conventions.

If no audience is specified, default to **intermediate**.

### 2. Identify Context

- Identify the programming language and framework
- Understand the file's role in the project
- Review imports, dependencies, and related configuration
- Note the problem the code is solving

### 3. High-Level Overview

- Provide a 1-3 sentence summary of what the code does and why
- Describe how it fits into the larger system
- State the main input(s) and output(s)

### 4. Code Structure Breakdown

- Break the code into logical sections
- Identify classes, functions, and key methods
- Map out the data flow and control flow
- Name any design patterns being used (e.g., Observer, Factory, Middleware)

### 5. Detailed Walkthrough

- Explain complex or non-obvious lines
- Describe the logic behind branching, loops, and recursion
- Clarify any framework-specific patterns or conventions
- For beginners: provide line-by-line annotation of tricky sections

### 6. Data Structures and Types

- Explain data types and structures being used
- Describe how data is transformed or processed
- Clarify input and output formats
- Explain object relationships and hierarchies

### 7. Error Handling and Edge Cases

- Explain error handling mechanisms
- Identify edge cases the code handles (or misses)
- Describe validation and defensive programming patterns

### 8. Dependencies and Integrations

- Explain external service integrations
- Describe database operations and queries
- Explain API interactions and protocols
- Clarify third-party library usage and why each is needed

## Output Format Examples

**For Complex Algorithms:**
```
This function implements a depth-first search algorithm:

1. Line 1-3: Initialize a stack with the starting node and a visited set
2. Line 4-8: Main loop - continue until stack is empty
3. Line 9-11: Pop a node and check if it's the target
4. Line 12-15: Add unvisited neighbors to the stack
5. Line 16: Return null if target not found

Time Complexity: O(V + E) where V is vertices and E is edges
Space Complexity: O(V) for the visited set and stack
```

**For API Integration Code:**
```
This code handles user authentication with a third-party service:

1. Extract credentials from request headers
2. Validate credential format and required fields
3. Make API call to authentication service
4. Handle response and extract user data
5. Create session token and set cookies
6. Return user profile or error response

Error Handling: Catches network errors, invalid credentials, and service unavailability
```

**For Database Operations:**
```
This function performs a complex database query with joins:

1. Build base query with primary table
2. Add LEFT JOIN for related user data
3. Apply WHERE conditions for filtering
4. Add ORDER BY for consistent sorting
5. Implement pagination with LIMIT/OFFSET
6. Execute query and handle potential errors
7. Transform raw results into domain objects

Performance Notes: Uses indexes on filtered columns, implements connection pooling
```

## Tips

- Use clear, non-technical language when possible (especially for beginners)
- Provide examples and analogies for complex concepts
- Structure explanations logically from high-level to detailed
- Include visual diagrams or flowcharts when helpful
- For language-specific idioms and patterns, see `references/language-guide.md`
