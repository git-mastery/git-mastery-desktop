# Executing GitMastery Commands

GitMastery is a CLI tool that is invoked as a child process from the Electron main process.
Because it streams output line-by-line rather than returning a single response, the Electron
IPC bridge requires a custom push-based data channel in addition to the normal request/response model.

---

## Architecture Overview

```
Renderer (React UI)
    │
    │  invoke('gitmastery-start-task', { command })       ← ipcRenderer.invoke (request/response)
    ▼
Main Process (ipc/terminal.ts — setupGitmasteryIpc)
    │
    │  spawn(gitmastery, args)                             ← child_process.spawn (no shell: true)
    ▼
GitMastery CLI (child process)
    │
    │  stdout / stderr data events (streamed line-by-line)
    ▼
Main Process
    │
    │  mainWindow.webContents.send('gitmastery-task-data', payload)   ← push channel
    ▼
Renderer (React UI)
    │
    │  ipcRenderer.on('gitmastery-task-data', handler)
    ▼
UI displays progress in real time
```

---

## IPC Channels

### `gitmastery-start-task` (invoke — request/response)

Triggered by the renderer to kick off a GitMastery command.

**Payload sent from renderer:**
```ts
{ command: string }
// e.g. { command: "setup" }
// e.g. { command: "download intro-to-git" }
```

**Valid commands:** `setup`, `download <exercise-name>`

**Returns:** `true` once the command has been dispatched (not completed — completion is pushed via `gitmastery-task-data`).

---

### `gitmastery-task-data` (push — main → renderer)

Used to stream progress data back to the renderer in real time as the CLI produces output.
This channel is fired multiple times per command invocation, once per chunk of stdout data.

**Payload shape:**
```ts
{
  originalCommand: string,        // e.g. "setup" or "download intro-to-git"
  data: {
    success: {
      message: string,            // the raw stdout chunk
      stdout: string,             // full accumulated stdout so far
      stderr: string,             // full accumulated stderr so far
    }
  }
}
```

> **Why a push channel?**
> `ipcRenderer.invoke` is a single-shot request/response. It cannot stream. Since GitMastery
> prints progress as it runs (git checks, directory creation, etc.), we need to push each chunk
> to the renderer as it arrives. The renderer subscribes to `gitmastery-task-data` via
> `ipcRenderer.on(...)` and updates the UI incrementally.

---

# The two commands below were documented by AI and are subject to change.
## Command Lifecycle: `setup`

The `setup` command is the first thing a new user runs. It performs the following checks
before spawning the CLI (see `_setup` in `ipc/terminal.ts`):

### Step 1 — Validate the data directory

`getConfig().dataDirectory` must exist on disk. If not, an error is thrown before anything is spawned.

### Step 2a — Auto-download `gitmastery.exe` (Windows only)

On Windows, the GitMastery executable lives at `<dataDirectory>/gitmastery.exe`.
If that file is missing, it is **automatically downloaded** from the latest GitHub release
before proceeding.

**Implemented in:** `src/electron/utils/win32/downloadExe.ts → downloadGitMasteryExe(destDir)`

How it works:
1. Calls `https://api.github.com/repos/git-mastery/app/releases/latest` to get the latest release metadata.
2. Finds the asset named exactly `gitmastery.exe` in the release's asset list.
3. Follows the GitHub CDN redirect (HTTP 301/302) and streams the binary to `<dataDirectory>/gitmastery.exe`.
4. Uses only Node.js built-ins (`https`, `fs`) — no third-party download library needed.

### Step 2b — macOS: Homebrew check (TODO)

On macOS, GitMastery is expected to be installed via Homebrew (`brew install gitmastery`).
A validation check here is planned but not yet implemented.

### Step 3 — Check if the exercises folder already exists

The CLI creates a `gitmastery-exercises/` subdirectory inside `dataDirectory` on first run.

- **If `gitmastery-exercises/` does not exist:** spawn `gitmastery setup` to create it.
  The CLI will prompt for a directory name; we automatically answer by writing `\n` to stdin
  to accept the default (`gitmastery-exercises`).
- **If `gitmastery-exercises/` already exists:** the setup is considered complete and a
  success message is sent directly on the `gitmastery-task-data` channel without re-running the CLI.

---

## Command Lifecycle: `download <exercise-name>`

Downloads a specific exercise from the GitMastery platform.

**Implemented in:** `_download` in `ipc/terminal.ts`

1. Spawns `gitmastery download <exercise-name>` as a child process in `dataDirectory`.
2. Streams stdout chunks to the renderer via `gitmastery-task-data`.
3. Watches for `INFO cd` in stdout — this signals that the exercise was downloaded and the
   simulated git terminal's working directory should be changed to the exercise folder. *(TODO: CWD change not yet wired up.)*

---

## Executable Resolution (`getGitMasteryExecutable`)

| Platform | Resolved path |
|----------|---------------|
| `win32`  | `<dataDirectory>/gitmastery.exe` (auto-downloaded if missing) |
| `darwin` | `gitmastery` (resolved from `PATH`, expected via Homebrew) |
| `linux`  | TODO |

> **Important — no `shell: true`**
> `child_process.spawn` is called **without** `shell: true`. This is intentional.
> On Windows, passing a path with spaces (e.g. `C:\Coding\gitmastery stuff\gitmastery.exe`)
> through `cmd.exe` causes the path to be truncated at the first space.
> Spawning directly avoids this shell-parsing issue entirely.

---

## Environment (`getEnvironmentWithHomebrew`)

On macOS, Homebrew installs binaries to paths that are not always on the `PATH` inherited by
Electron (e.g. `/opt/homebrew/bin` on Apple Silicon). `getEnvironmentWithHomebrew()` prepends
the common Homebrew binary directories to `process.env.PATH` before the child process is spawned,
ensuring `gitmastery` and its dependencies (like `git`) are resolvable.

On Windows and Linux, the environment is passed through unchanged.

---

## Relevant Files

| File | Purpose |
|------|---------|
| `src/electron/ipc/terminal.ts` | IPC handlers (`setupGitmasteryIpc`, `_setup`, `_download`) and helper utilities |
| `src/electron/utils/win32/downloadExe.ts` | Windows-only: downloads `gitmastery.exe` from GitHub Releases |
| `src/electron/storage.ts` | Persists and retrieves `dataDirectory` and other config values |
