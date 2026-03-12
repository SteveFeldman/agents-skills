---
name: directory-deepdive
description: "Investigate a directory's architecture and create/update a CLAUDE.md file capturing implementation knowledge"
---

# Directory Deep Dive

Investigate and document directory architecture to build context from code when starting work in a new area.

## Instructions

1. **Target Directory**
   - Focus on the specified directory `$ARGUMENTS` or the current working directory

2. **Check for Existing Documentation**
   - If a CLAUDE.md already exists in the target directory, read it first
   - Note what is already documented so you can update rather than overwrite
   - Preserve any existing information that is still accurate

3. **Investigate Architecture**
   - Analyze the implementation principles and architecture of the code in this directory and its subdirectories
   - Look for:
     - Design patterns being used
     - Dependencies and their purposes
     - Key abstractions and interfaces
     - Naming conventions and code organization

4. **Create or Update Documentation**
   - If no CLAUDE.md exists, create one capturing the knowledge discovered
   - If one already exists, update it with newly discovered information while preserving existing accurate content
   - Include:
     - Purpose and responsibility of this module
     - Key architectural decisions
     - Important implementation details
     - Common patterns used throughout the code
     - Any gotchas or non-obvious behaviors

5. **Ensure Proper Placement**
   - Place the CLAUDE.md file in the directory being analyzed
   - This ensures the context is loaded when working in that specific area

## Credit

This command is based on the work of Thomas Landgraf: https://thomaslandgraf.substack.com/p/claude-codes-memory-working-with
