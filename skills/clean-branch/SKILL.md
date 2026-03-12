---
name: clean-branch
description: Safely clean up merged, stale, and unnecessary git branches with dry-run preview
---

# Clean Branches

Safely clean up merged, stale, and unnecessary git branches across any repository.

## Usage

```
/clean-branch                    # Dry-run analysis of all branches
/clean-branch --execute          # Actually delete after confirmation
/clean-branch --stale-days 60    # Consider branches older than 60 days stale
```

## Instructions

Follow this approach to clean up git branches: **$ARGUMENTS**

**Default behavior is dry-run** — show what would be deleted without deleting anything. Only execute deletions when the user explicitly confirms.

### 1. Repository State Analysis

```bash
git status
git branch -a
git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
```

- Check current branch and ensure working directory is clean
- Identify the main/default branch name
- List all local and remote branches

### 2. Categorize Branches

Identify and group branches into categories:

**Merged branches** (safe to delete):
```bash
git branch --merged main | grep -v "main\|master\|develop\|\*"
```

**Stale branches** (no activity in 30+ days):
```bash
git for-each-ref --format='%(refname:short) %(committerdate:relative)' refs/heads/
```

**Protected branches** (never delete):
- `main`, `master`, `develop`, `staging`, `production`

**Active branches** (unmerged, recent activity):
- List for reference but do not suggest deletion

### 3. Present Dry-Run Report

```
## Branch Cleanup Report

### Safe to Delete (merged into main)
- feature/user-auth (merged 3 days ago)
- fix/login-bug (merged 1 week ago)

### Stale (no activity in 30+ days)
- feature/old-experiment (last commit: 45 days ago, NOT merged)
  ⚠️ Has 3 unmerged commits — review before deleting

### Protected (will not touch)
- main, develop

### Active (keeping)
- feature/new-dashboard (last commit: 2 days ago)
```

### 4. Execute Cleanup (only when confirmed)

If the user confirms, proceed:
- Switch to main branch and pull latest
- Delete merged local branches with `git branch -d`
- Prune remote tracking branches with `git remote prune origin`
- For stale unmerged branches, ask individually before using `git branch -D`

### 5. Verify Results

```bash
git branch -a
```

Report what was deleted and confirm protected branches are intact.

**Recovery note**: Deleted branches can be recovered via `git reflog` within the reflog expiry period (default 90 days).
