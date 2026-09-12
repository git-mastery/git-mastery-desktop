---
name: git-mastery-pr
description: >-
  Create Git-Mastery Desktop pull requests with a short title, Overview,
  Solution bullets, and checkbox Test cases. Use when opening a PR, creating a
  pull request, drafting a PR description, or the user asks to ship/push a PR.
---

# git-mastery-pr

## Overview

Open PRs with `gh`. Keep the description as concise as possible — to the point, no filler, no restated file lists. This body template overrides the default Summary / Test plan format.

## Solution

- Inspect in parallel: `git status`, `git diff`, remote tracking, `git log` and `git diff [base]...HEAD`
- Do not update git config, skip hooks, force-push to main/master, or commit unless asked
- Push with `-u` if the branch has no upstream
- Create the PR with `gh pr create`; return the URL when done
- Title: short conventional (`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`). Why, not a file dump
- Body — every section short. Cut anything a reviewer can see in the diff

```
## Overview
<1–2 sentences: what changed and why>

## Solution
- <how it was done; key approach only>

## Test cases
- [ ] <manual check a reviewer can run>
```

## Test cases

- [ ] Title is conventional and short
- [ ] Body has only Overview, Solution, Test cases
- [ ] Description is terse — no filler, no file inventory, no unused screenshots
- [ ] Test cases are `[]` checkboxes a human can actually run
