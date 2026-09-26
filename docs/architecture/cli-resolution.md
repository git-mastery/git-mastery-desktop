# CLI resolution is the learner's PATH

Spawned Git-Mastery commands (`download`, `verify`) and the in-app terminal resolve
`gitmastery` the same way: they inherit `getCliEnvironment()`. That is the PATH the
app was launched with, plus Homebrew prefixes on macOS. The app does not install
the CLI and does not add any other directory.

## Why the app does not install the CLI

Windows and Linux used to download a binary into the learner's save folder and
prepend that folder to PATH. That made a self-install invisible to Verify, and it
put a learner-chosen folder (often Downloads or Documents) ahead of system tools,
so a stray executable there could shadow `git`. macOS installed through Homebrew
instead, so the app had two install models that failed in different ways.

The lessons already tell learners to install the CLI and run `gitmastery setup`.
The app follows that and only checks that the result is visible.

## Known limits

- `process.env` is a snapshot from app launch. On Windows, a CLI added to PATH
  while the app is running stays invisible until restart. macOS and Linux installs
  land in directories already on the launch PATH (Homebrew prefixes are added by
  the app; apt installs into `/usr/bin`), so they show up without a restart.
- A binary an older build downloaded into the save folder is no longer on PATH.
  Those learners install the CLI the way the lessons describe.
- Windows resolution looks for `gitmastery.exe` only. Shim-based installs
  (`.cmd` / `.bat`) are unsupported; running those needs `shell: true`.
