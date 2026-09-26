# CLI output is echoed into xterm, not run inside the shell

GitMastery commands started from the app (`download`, `verify`) still run as a
separate `child_process.spawn`. Their stdout and stderr are painted into the xterm pane so
`INFO` lines stay in scrollback instead of a toast.

## Why not run the command in the interactive PTY

The obvious alternative is `writeCommandToPty('gitmastery verify')` so the learner's shell
owns the output. That was rejected:

- **Structured results still need a clean stdout stream.** Verify parses `INFO  Status:
Completed` / `Incomplete` and comments to patch exercise progress. Mixing that with a
  prompt, user typing, and shell colour would make the parse fragile.
- **The spawn path is load-bearing.** Verify is gated on the tracked cwd, spawned with an
  explicit exercise directory, and reports progress over `gitmastery-task-data`. See
  [exercise-directory-resolution.md](exercise-directory-resolution.md) §9.
- **Running in both places would verify twice.**

Echo is display-only: main sends the same bytes over the existing `pty-data` channel that
shell output already uses. The PTY never sees them.

## What still toasts

One in-place toast per button click. Loading titles (`Verifying...`, `Starting exercise...`)
while the action runs, then a one-line result (`Exercise answer correct` / `incorrect`,
`Could not start exercise`). CLI `INFO` lines and comments stay in the terminal. A successful
Start dismisses the loading toast — the `cd` is already visible in the pane.

## Persistence

Lines live in xterm's session scrollback until the Terminal remounts (reload / PTY respawn).
They are not restored across app restarts.

## Tradeoffs

- The echoed header is not a real shell history entry; up-arrow will not replay
  `gitmastery verify`.
- Display-only writes can desync the cursor if the learner types during a long download.
  Start/end `\x15` + empty Enter reprints a prompt below the log; the PTY is not paused.
- Spawn is not a TTY, so the CLI's `INFO` lines stay uncoloured, as they were in toasts.
