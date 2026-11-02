---
name: git-mastery-ui-testing
description: >-
  Navigate and visually validate Git-Mastery Desktop after renderer UI changes.
  Use after changing layouts, styles, components, modals, menus, walkthroughs,
  or other visible interactions. Captures temporary screenshots, checks the
  result against the request, and removes all review artifacts.
---

# Git-Mastery UI testing

UI work is not complete until the changed flow has been exercised and visually reviewed.

## Required workflow

1. Inspect the diff and list the changed surfaces, entry points, interactions, and important states. Test those states rather than taking only a launch screenshot.
2. Read the `git-mastery-design` skill when the change affects renderer design.
3. Read and follow the `git-mastery-electron-automation` skill. Use an isolated profile and the temporary screenshot retention policy.
4. Navigate through the changed flow using role, label, and text locators. Exercise the interactions needed to reach every changed state, including relevant open, close, selected, disabled, error, empty, or theme states.
5. Assert that expected controls and text are visible before capturing screenshots.
6. Save screenshots only under a unique `/tmp/git-mastery-ui-review-*` directory.
7. Read every screenshot and compare it with the user's request and the house design. Check layout, clipping, overlap, spacing, hierarchy, copy, colours, focus state, and whether native content is incorrectly covering DOM UI.
8. If the result is wrong, fix the implementation and repeat the navigation and review. Do not report success based only on the click script exiting successfully.
9. Close Electron, stop servers started for the review, remove the temporary user-data directory, scripts, Playwright installation if created for the task, and all screenshots.
10. Confirm `git status` contains no review artifacts. Report the flows tested and the visual result without claiming broader coverage.

## Completion criteria

- Every changed user-facing state was reached through the app.
- Screenshots were inspected, not merely produced.
- The UI matches the request and no visible regression was found, or defects were fixed and rechecked.
- Temporary screenshots and automation artifacts were deleted.
