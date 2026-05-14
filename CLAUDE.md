# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run React dev server (port 5123) + Electron main in parallel
npm run build        # Compile TypeScript + bundle React (required before dist)
npm run lint         # ESLint (flat config, TypeScript plugin)

npm run transpile:electron  # Compile only the Electron main process
npm run dev:react           # Vite dev server only (port 5123)
npm run dev:electron        # Transpile + launch Electron only

npm run dist:mac     # Package for macOS arm64
npm run dist:win     # Package for Windows x64
npm run dist:linux   # Package for Linux x64
```

There is no test suite.

After building a macOS `.dmg`, unsigned builds require removing quarantine flags:
```bash
xattr -rc /Applications/git-mastery.app
```

## Architecture

Git-Mastery Desktop is an Electron app that provides an interactive learning environment for Git exercises from git-mastery.org. It embeds an xterm.js terminal (backed by node-pty) and a sandboxed WebContentsView that loads the git-mastery.org web app.

### Process Model

**Main process** (`src/electron/`): Manages the BrowserWindow, spawns the PTY shell, runs the `gitmastery` CLI as child processes, persists config/progress to JSON files in Electron's `userData`, and registers all IPC handlers.

**Renderer process** (`src/ui/`): React 19 + Mantine v8 app that loads from `http://localhost:5123` in dev or `dist-react/` in prod. Communicates with the main process exclusively via the context bridge exposed as `window.electron`.

**Context bridge** (`src/electron/preload.cts`): Typed API wrapping all IPC channels. The renderer never calls `ipcRenderer` directly. All handler types live in `src/electron/preload.cts` and are referenced from `src/ui/` via `window.electron.*`.

**WebContentsView** (`src/electron/ipc/webContentsView.ts`): Separate sandboxed view (not the main BrowserWindow) for displaying git-mastery.org. Has its own preload (`wcv-preload.cts`). Injected JS replaces download buttons with IPC-driven handlers. The renderer controls its position/size via `window.electron.setContentsViewSize(x, y, w, h)`.

### IPC Patterns

Three communication patterns are used throughout:

- **Request-response** (`ipcMainHandle` / `ipcRenderer.invoke`): async, returns a Promise. Used for config reads, file dialogs, prerequisite checks.
- **Fire-and-forget** (`ipcMainOn` / `ipcRenderer.send`): one-way from renderer to main. Used for PTY writes, navigation, resizing.
- **Streaming subscriptions** (`mainWindow.webContents.send` / `ipcRenderer.on`): main pushes data to renderer. Used for PTY output and `gitmastery-task-data`.

All IPC handlers validate the sender frame URL (localhost:5123 in dev or the signed app file URL in prod) — see `src/electron/utils/util.ts`.

### GitMastery Task Streaming

Running a `gitmastery` command (`setup`, `download <id>`, `verify`) streams structured payloads over `gitmastery-task-data`:

```typescript
{ originalCommand: string, data: { success?, error?, completed?, exerciseIdentifier? } }
```

`GitMasteryTaskContext` (`src/ui/contexts/GitMasteryTaskContext.tsx`) is the single IPC listener for this channel. Components register condition-based callbacks via `useElectronStream` — they receive data only when their filter matches. This decouples streaming from consumers without re-broadcasting via state.

### State & Persistence

- **App config** (`src/electron/storage.ts`): JSON in `userData/config.json`. Stores `dataDirectory` (where exercises are cloned).
- **Exercise progress** (`src/electron/ipc/gitmastery.ts`): JSON in `userData/progressData.json`. Tracks per-exercise status: `not-started → in-progress → correct|incorrect`.
- **Onboarding gate**: `localStorage` key `onboarding-completed`. Must choose a data directory before the main app renders.

### TypeScript Config Layout

The project uses TypeScript project references (composite mode):

| Config | Targets | Notes |
|--------|---------|-------|
| `tsconfig.json` | Root, references all others | |
| `tsconfig.app.json` | `src/ui/`, `src/types/` | Bundler module mode, no emit |
| `tsconfig.node.json` | Vite config, etc. | |
| `src/electron/tsconfig.json` | `src/electron/` only | NodeNext module, emits to `dist-electron/` |

## Critical Build Rule

**Never import files from outside `src/electron/` inside `src/electron/`.** TypeScript recalculates `rootDir` when it detects cross-directory imports, which breaks the output paths in `dist-electron/` and causes the packaged app to fail. If you need a shared constant or utility in both the main process and renderer, duplicate it — do not create a shared import.

This is the reason `src/electron/` has its own `tsconfig.json` and why shared types under `src/types/` are only imported from `src/ui/`.
