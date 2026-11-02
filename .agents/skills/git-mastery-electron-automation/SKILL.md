---
name: git-mastery-electron-automation
description: >-
  Launch, navigate, and capture Git-Mastery Desktop through Playwright Electron
  and native window screenshots. Use when interacting with the running app,
  collecting documentation figures, or visually testing renderer UI changes.
---

# Git-Mastery Electron automation

## Setup

1. Run `npm run transpile:electron`.
2. Start `npm run dev:vite` as a background process and confirm that port 5123 is ready.
3. Prefer Playwright's Electron support for stable role, label, and text locators.
4. Do not add Playwright to the repository solely for ad hoc automation. If unavailable, install it temporarily:

```bash
npm install --prefix /tmp/git-mastery-playwright playwright@latest --ignore-scripts
```

5. Launch the repository's Electron executable with:
   - `NODE_ENV=development`;
   - `cwd` set to the repository root;
   - app argument `"."`; and
   - `--user-data-dir=<temporary-directory>` for an isolated profile.

Use an isolated profile by default. A fresh profile starts at onboarding, so navigate through it when the target lies beyond it. Use existing user data only when the requested state depends on it and doing so will not alter or expose personal data.

## Navigate

- Obtain the renderer with `electronApp.firstWindow()`.
- Use accessible locators and real clicks. Wait for the expected control or state after each action.
- Navigate through the app as a user would; do not force React state or bypass the interaction being tested.
- Interact with embedded lesson content through its Electron `webContents` when possible. Use coordinate automation only as a last resort and confirm its effect with a fresh screenshot.
- Never enter or expose real credentials, API keys, usernames, or unrelated local data.

## Capture

The caller chooses the destination and retention policy:

- UI review: a unique `/tmp/git-mastery-ui-review-*` directory that will be deleted.
- Documentation: the requested durable `docs/images/<document-name>/` directory.

For DOM-only views, modals, or full-window flows that suppress the lesson site, use `page.screenshot()`.

Playwright page screenshots do not include the native lesson `WebContentsView`. When its visible relationship with the desktop chrome matters:

1. Identify the Electron main-process PID belonging to this repository.
2. Use CoreGraphics window information to find its on-screen, layer-zero window.
3. Capture that window:

```bash
screencapture -x -l <window-id> <output.png>
```

Inspect every capture before accepting it. Retake images that are loading, blank, clipped, obscured, sensitive, or not representative of the intended state.

## Cleanup

1. Close Electron and stop only the development processes started for this task.
2. Delete temporary profiles, scripts, and the temporary Playwright installation when created.
3. Apply the caller's screenshot retention policy: delete review captures; retain requested documentation figures.
4. Confirm `git status` contains no automation artifacts or unintended package changes.
