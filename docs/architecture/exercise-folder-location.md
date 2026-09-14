# Exercise folder location is locked after first setup

GitMastery writes exercise files under `{dataDirectory}/gitmastery-exercises`. The learner
picks `dataDirectory` once, during onboarding (or from Settings if they skipped that step).
Changing it afterwards is deferred.

## Why lock it

The folder is not just a preference. The GitMastery CLI (on Windows and Linux) is downloaded
into the same parent, progress is keyed off paths under it, and in-progress work lives on
disk there. Relocating after that is a migration, not a settings edit — and migration is not
built.

The lock is keyed on `check-exercise-folder`'s `ready` flag (the `gitmastery-exercises`
directory exists), not merely on `dataDirectory` being set. A chosen-but-uninitialised path
can still be changed; once Setup has created the folder, the picker is read-only.

## Rejected alternatives

- **Hardcoded default, no picker.** Would skip a real first-run choice (Documents vs Desktop
  vs a dedicated drive), and would hide the path from the learner.
- **Allow changes with a migration.** The right long-term shape, but it needs copying work,
  re-pointing the CLI binary, and resetting progress cache. Deferred rather than half-done.
