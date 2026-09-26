# The exercises root is one the learner already created

The app stores `exercisesRoot`: the folder `gitmastery setup` created, which is the
folder containing `.gitmastery.json`. It is not the parent, and the app never
creates it.

## Why the app does not run setup

Learners who follow the lessons in order are told not to set Git-Mastery up in
advance. The lessons introduce the CLI and `gitmastery setup` when they are
needed. Running setup from an onboarding screen asked for that work before the
lesson did, and it required the CLI to be installed first.

The first time a learner clicks Start, the app walks through three steps. The
introduction repeats on every Start until they check "Don't show this again".
The other two are checked on every Start, from the main process, so the Start
button in the app and the one in the lesson page behave the same.

1. **Introduction.** A short description of an exercise: a folder of starting
   files, work in the terminal, then Verify. Hands-on practicals are mentioned
   because they have no Verify step. A checkbox opts out of seeing it again.
2. **Tools.** `gitmastery` must be on PATH. On Windows, Git Bash must be
   installed too, because the in-app terminal uses it. Neither check runs the
   CLI. On Windows the step says to restart the app, because PATH is read at
   launch and a retry cannot see a change. On macOS and Linux the step can be
   checked again immediately.
3. **Folder.** The learner picks the exercises folder. It is accepted when it
   contains `.gitmastery.json`. If they pick the parent and exactly one
   subfolder is a root, that subfolder is used. The copy says this step does
   not run setup. "Setup Instructions" in that sentence opens T1L2
   (`/lessons/gitPrep/#installing-the-git-mastery-app`) in the embedded site
   and closes the dialog, because the native view is hidden while a dialog is
   open. An X beside the path forgets the link. It does not delete the folder.

Git, `user.name` and `user.email` are not checked separately. `gitmastery setup`
refuses to finish unless they are in place, and only a finished setup writes
`.gitmastery.json`. A valid root already proves those checks passed. Running
`gitmastery check git` would add several seconds and is skipped. GitHub CLI
requirements are not listed per exercise; `gitmastery download` reports them.

Closing the steps does not show an error. The next Start resumes at whichever
step is still missing. Once every step passes, the exercise starts on its own.

## Why there is no lock

The app owns no files in the root, so pointing Settings at a different one is a
setting change. Progress is read from disk again. Older builds stored the parent
folder and assumed the child was named `gitmastery-exercises`, which broke
learners who accepted setup's offer to rename it. Storing the root itself allows
any name. An existing parent-folder setting is migrated on launch when
`gitmastery-exercises` exists underneath it.

The folder step includes a fixed warning against OneDrive, Dropbox, Google Drive
and iCloud. The path is not inspected: iCloud sync of Desktop and Documents does
not appear in the path, so a check would miss the case the warning exists for.

## Rejected alternatives

- **The app runs `gitmastery setup`.** Needs the CLI first, and repeats a step
  the lesson already asks for. Also forced the folder name and location.
- **Guess the root** by scanning the home folder, or by noticing the terminal is
  inside one. Scanning is slow and can find more than one. Tracking the terminal
  folder depends on parsing `cd`, which misses other ways of moving.
- **Detect cloud-synced folders from the path.** Misses iCloud. A fixed hint is
  shown instead.
