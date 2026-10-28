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
- **The spawn path is load-bearing.** Verify is gated on the live shell cwd, spawned with an
  explicit exercise directory, and reports progress over `gitmastery-task-data`. See
  [exercise-directory-resolution.md](exercise-directory-resolution.md) §9.
- **Running in both places would verify twice.**

Echo is display-only: main sends the same bytes over the existing `pty-data` channel that
shell output already uses. The PTY never sees them.

## Activity feedback

Download and verification events do not use the global toast stack. Start opens the standard
modal centred within the area left of the work column, so it never covers the terminal. The
left Tours sidebar and lesson area receive the same opaque, dull focus mask. The native lesson
view is suppressed as it is for every modal; the top navbar and work column stay clear and
usable. Its Continue button stays disabled as
`Downloading exercise...` or
`Downloading hands-on...` until Start settles. Closing the modal only dismisses the
presentation; it does not cancel the main-process task.

Verify has no loading modal. Once the command settles, a centered result modal reports correct,
incorrect, complete, or failed while detailed CLI `INFO` lines and comments remain in terminal
scrollback.

Verify clicked while the terminal is not in the exercise folder opens the existing prerequisite
modal telling the learner to click Start Exercise first.

## Persistence

Lines live in xterm's session scrollback until the Terminal remounts (reload / PTY respawn).
They are not restored across app restarts.

## Tradeoffs

- The echoed header is not a real shell history entry; up-arrow will not replay
  `gitmastery verify`.
- Display-only writes can desync the cursor if the learner types during a long download.
  Start/end `\x15` + empty Enter reprints a prompt below the log; the PTY is not paused.
- Spawn is not a TTY, so the CLI's `INFO` lines stay uncoloured, as they were in toasts.
