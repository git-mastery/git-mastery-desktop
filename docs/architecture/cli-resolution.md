# CLI resolution is PATH-only

Spawned Git-Mastery commands (`setup`, `download`, `verify`) and the in-app terminal
resolve `gitmastery` the same way: they inherit `getCliEnvironment()`, whose `PATH`
has `dataDirectory` prepended (and Homebrew prefixes on macOS). There is no
hard-coded absolute path to the binary.

## Why PATH, not an address

Windows and Linux used to spawn `{dataDirectory}/gitmastery[.exe]`. That only
worked for a CLI the app had downloaded itself. A self-install on `PATH` was
invisible, so Verify failed with `ENOENT` while typing `gitmastery verify` in the
terminal succeeded. macOS already spawned the bare name `gitmastery` and looked
it up on `PATH`, which is why the bug did not show up there.

`dataDirectory` is prepended so an app-downloaded copy wins over a pre-existing
install. That keeps the download button's behaviour predictable. The checklist
row shows the resolved path so shadowing is visible rather than inferred from
an error.

Both install routes are supported on purpose. Self-install is must-support
(Homebrew, a `.deb`, or a binary the learner put on `PATH`). The in-app download
stays because Windows ships a bare `.exe` with no installer, winget, or scoop
manifest.

## Rejected alternatives

- **Hard-coded absolute path.** What shipped. Invisible to self-installs, and
  the Verify button and the terminal could run different binaries.
- **Spawn a bare name and let libuv search.** Fewer lines, but no path to
  display and no clean "not installed" answer without a second probe.
- **App-managed install only.** Rejected: learners are allowed (and expected)
  to install the CLI themselves.

## Known limits

- `process.env` is a snapshot from app launch, so a CLI installed while the
  app is running stays invisible until restart (called out in the checklist).
- A binary in `dataDirectory` is on the constructed `PATH` only, so terminals
  outside the app will not see it.
- Windows resolution looks for `gitmastery.exe` only. Shim-based installs
  (`.cmd` / `.bat`) are unsupported; running those needs `shell: true`.
