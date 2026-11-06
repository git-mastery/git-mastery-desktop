# Exercise directory resolution and the Start Exercise flow

How the desktop app decides which directory a learner should work in, and when it should
download an exercise versus simply resume one.

## 1. Problem

Verification runs in whatever directory the terminal is sitting in, so getting the learner into
the right directory is load-bearing rather than cosmetic. A wrong `cd` does not fail visibly —
it surfaces later as a confusing `gitmastery verify` failure that appears to blame the learner.

The shared Start flow addresses two defects in the former implementation:

1. **The app guessed the working directory** from the shape of the folder on disk, even though
   the CLI writes the answer to a manifest at download time.
2. **Embedded "Start Exercise" always downloaded**, with no check for an existing folder. On the evaluated
   CLI that deletes the learner's work.

Both are fixed by the same change: resolve the working directory from the manifest, and have
Start check the filesystem _before_ deciding whether to download.

## 2. Background — the three exercise layouts

What a downloaded exercise looks like on disk is driven by `exercise_repo.repo_type` in the
CLI's per-exercise manifest, a closed set of four values (`app/configs/exercise_config.py:15`):

| `repo_type`    | Folder created                                        | Work happens in   |
| -------------- | ----------------------------------------------------- | ----------------- |
| `local`        | `<root>/<repo_name>`, `git init`-ed when `init: true` | the subfolder     |
| `local-ignore` | `<root>/<repo_name>`                                  | the subfolder     |
| `remote`       | `<root>/<repo_name>` cloned (or forked then cloned)   | the subfolder     |
| `ignore`       | none — `repo_name` is the placeholder `"ignore-me"`   | the exercise root |

Observed state of all 11 downloaded exercises on a real machine. This table is the evidence for
everything below:

| Exercise             | `repo_type`  | `repo_name`   | Subdirs on disk | Has `.git` |
| -------------------- | ------------ | ------------- | --------------- | ---------- |
| branch-bender        | local        | webapp        | `webapp`        | yes        |
| conflict-mediator    | local        | conflict      | `conflict`      | yes        |
| fetch-and-pull       | remote       | gm-shapes     | `gm-shapes`     | yes        |
| fork-repo            | ignore       | ignore-me     | —               | —          |
| grocery-shopping     | local        | shopping-list | `shopping-list` | yes        |
| remote-control       | ignore       | ignore-me     | —               | —          |
| stage-fright         | local        | attendance    | `attendance`    | yes        |
| staging-intervention | local        | intervention  | `intervention`  | yes        |
| under-control        | local        | control-me    | `control-me`    | **no**     |
| undo-init            | local-ignore | my-notes      | `my-notes`      | yes        |
| view-commits         | remote       | duty-roster   | `duty-roster`   | yes        |

Note `under-control`: `init: false`, because running `git init` _is_ the exercise. Any resolver
keyed on the presence of `.git` is structurally wrong for that class of exercise.

## 3. Current behaviour

Embedded Start, app-side Start, and the legacy download IPC command all call
`startExercise()` in `src/electron/ipc/gitmastery.ts`. After the
[Start prerequisites](exercises-root.md) pass, it resolves the exercise with
`resolveExerciseCwd()` in `src/electron/exerciseManifest.ts`.

A ready exercise is resumed with a terminal `cd` and no CLI invocation. An absent
exercise is downloaded, resolved again, and then entered. An existing corrupt or
incomplete folder produces an error without overwriting work. Section 6 defines
the manifest rules and shared flow in detail.

## 4. Why folder-shape heuristics were removed

The old resolver chose a sole subdirectory, or guessed from `.git` and an
`<identifier>-repo` naming convention when several directories existed.
Real exercises use unrelated names such as `webapp`, `shopping-list`, and
`control-me`. An exercise can intentionally have no `.git`, and a learner's
extra `scratch` directory can change the apparent layout.

The CLI already records the intended directory in the manifest. Using that
record avoids silently entering the wrong folder. Normal exercises have no
heuristic fallback; hands-on practicals have a separate layout contract (§11).

## 5. Why Start must not download unconditionally

Behaviour of `gitmastery download <exercise>` when the folder already exists:

| CLI                                                         | Behaviour                                                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **v7.8.2** (evaluated release)                              | `warn("You already have ...")`, then `rmtree` and re-download. `--force` does not exist. **The learner's work is destroyed.** |
| `feat/download-command-fixes` (evaluated branch, `b972f58`) | `error(...)` → exit 1, nothing downloaded. Recommends `gitmastery progress reset`, or `download <exercise> --force`.          |

The former embedded Start button called `_download` unconditionally, so on CLI v7.8.2 clicking
Start on an in-progress exercise deleted it. Checking the filesystem in the app first makes the
app correct on **both** CLI versions with no version gate: it simply never issues a download
for a folder that already exists.

### The two guards are independent, and both are wanted

The CLI-side guard is **not** made redundant by this change, and this change is not a
workaround for its absence. They protect different users and earn their place for different
reasons:

- **The CLI guard protects people using `gitmastery` directly in a terminal**, which is a
  first-class way to use the tool. The desktop app cannot help them. Silently deleting a
  learner's work is the wrong default for that audience no matter what any GUI does, so the CLI
  change stands on its own merit and should ship regardless.
- **The app guard buys two things the CLI guard cannot**, because by the time the CLI can
  answer, the cost has already been paid:
  - **One button instead of two.** "Download" and "Resume" collapse into a single "Start
    Exercise" that does the right thing from either state. The learner never has to know which
    state they are in, and the app never has to render a different control depending on local
    disk state.
  - **No pointless CLI round-trip.** Every `gitmastery` invocation pays a fixed startup cost
    before dispatching to _any_ subcommand: the `cli` group callback calls
    `fetch_latest_release_version()` (`app/cli.py`), a network request to GitHub, on top of
    frozen-binary startup. Measured on a dev machine: **~6–8.6s**, including for a command that
    fails at its very first hook. The newer CLI's already-exists guard is early — before any
    exercise download work — so it refuses _correctly_, but the learner still waits ~6s to be
    told "you already have this", and then has to do something else to actually resume. A
    resume that only needs a `cd` should be instant. The app answers from one `fs.existsSync`
    plus a small JSON read, with no subprocess at all.

The layering is deliberate: the app avoids issuing a call it knows will be refused, and the CLI
refuses correctly if anything ever does issue it.

## 6. Manifest contract and shared Start implementation

### Resolver

Callers reject the exercise identifier unless it is a single path segment (not `.`, `..`,
absolute, or containing `/` or `\`) **before** `path.join` onto the exercises directory. That
keeps `../hp-foo` and absolute paths from escaping the exercises root. Verify uses the same
check: an identifier that fails it never joins, never spawns, and asks the learner to click
Start Exercise.

`resolveExerciseCwd(exerciseRoot)` then returns a discriminated result. No heuristics. Paths
must be directories, not merely exist:

| Condition                                                 | Result                                  |
| --------------------------------------------------------- | --------------------------------------- |
| `exerciseRoot` does not exist                             | `{ state: "not-downloaded" }`           |
| `exerciseRoot` exists but is not a directory              | `{ state: "corrupt", exerciseRoot }`    |
| Identifier starts with `hp-` and the directory is empty   | `{ state: "incomplete", exerciseRoot }` |
| Identifier starts with `hp-` and one non-dot subdirectory | `{ state: "ready", cwd: that subdir }`  |
| Identifier starts with `hp-` otherwise                    | `{ state: "ready", cwd: exerciseRoot }` |
| Manifest missing, unparseable, or missing `exercise_repo` | `{ state: "corrupt", exerciseRoot }`    |
| `repo_type === "ignore"`                                  | `{ state: "ready", cwd: exerciseRoot }` |
| `repo_name` is not a single path segment                  | `{ state: "corrupt", exerciseRoot }`    |
| otherwise, `<root>/<repo_name>` missing                   | `{ state: "incomplete", exerciseRoot }` |
| otherwise, `<root>/<repo_name>` exists but is not a dir   | `{ state: "corrupt", exerciseRoot }`    |
| otherwise, `<root>/<repo_name>` is a directory            | `{ state: "ready", cwd }`               |

Hands-on practices (`gitmastery download hp-<name>`) are set up by a Python `download` function
rather than from a manifest (`_download_hands_on` in `app/commands/download.py`), so no
`.gitmastery-exercise.json` is ever written for them. Without the prefix check they would all
resolve as `corrupt`. An empty leftover from a failed hands-on download is `incomplete` so
Start will not silently `cd` into it and skip retry.

The sandbox repo is almost always the single subdirectory (`hp-init-repo/things`,
`hp-view-commits/things`, a clone). That is the same role as an exercise's `repo_name`, and
the lessons tell the learner to `cd hp-…/things`. Start therefore `cd`s into that subdirectory
when there is exactly one. Zero or several non-dot subdirectories stay at the exercise root.

`repo_name` is read off disk and joined onto the exercise root, so it is rejected unless it is a
single path segment — the resolved cwd is `cd`-ed into by Start and, once the terminal is
already there, used as verify's spawn cwd. Neither should be able to escape the exercise root.

The `ready` rule is a direct transcription of how the CLI computes the `cd` hint it prints
(`app/commands/download.py`):

```python
if config.exercise_repo.repo_type != "ignore":
    info(f"cd {exercise}/{config.exercise_repo.repo_name}")
else:
    info(f"cd {exercise}")
```

Verified against all 11 exercises in the table above.

This is safe because `setup_exercise_folder` writes the manifest at the exercise root _before_
creating or cloning the repo folder, and the `ignore` branch writes it explicitly. After any
successful download the manifest exists. The `incomplete` state exists precisely _because_ the
manifest is written first — a download that failed mid-clone leaves a manifest with no repo
folder.

**No heuristic fallback is retained.** A missing manifest means the folder is not a valid
exercise download. Guessing a directory there is worse than reporting it, because the guess is
then fed to `verify`, which fails confusingly. `corrupt` and `incomplete` produce an actionable
message instead.

### Start Exercise

One shared `startExercise(mainWindow, exerciseIdentifier)` in the main process:

1. Reject an identifier that is not a single path segment. Do not `path.join`.
2. Resolve.
3. `ready` → `changeDirectory(cwd)` if this Start is still the latest, return
   `{ ok: true, cwd, downloaded: false }`. **Exit early — no download is issued.** This is the
   fix for both the data loss on v7.8.2 and the spurious error on the newer CLI.
4. `not-downloaded` → run `_download`; on success, re-resolve, `cd` if still latest, and return
   `{ ok: true, cwd, downloaded: true }`. On failure, return `{ ok: false }` and broadcast
   `start-exercise-result` so the Start modal can settle to a one-line failure.
   CLI download errors are already in the terminal.
5. `corrupt` / `incomplete` → do **not** download. Return
   `{ ok: false, error, needsRestart: true }`; the renderer tells the learner to clear the
   folder out, since Restart is not built yet (§8).

Starts are deduplicated by identifier while one is in flight, so a second click — or a click on
both the app-side and embedded buttons — cannot issue two downloads. A monotonic generation
ensures only the latest Start may `cd`: starting B while A is still downloading must not let
A's completion steal the terminal.

The outcome is broadcast on `start-exercise-result` as well as returned, because the embedded
button dispatches through `wcv-start-exercise` and has no return value to inspect. A
`start-exercise-started` event fires when the click is accepted (not already in flight) so the
renderer can show the Start modal immediately. Success enables Continue; failures, including a
failed download, settle the same modal with an explanation. Dismissing the modal does not alter
the in-flight map or child process.

### Current entry points

| Trigger                            | Path                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| Embedded "Start Exercise"          | `wcv-start-exercise` → `startExercise()` (no longer `_download`) |
| Embedded "Start Hands-on"          | `wcv-start-exercise` → `startExercise()` with `hp-*`             |
| App-side Start                     | `gitmastery-start-exercise` → `startExercise()`                  |
| `gitmastery-start-task` `download` | `startExercise()`, so the guard cannot be bypassed               |
| Restart (deferred, see §8)         | `gitmastery download <id> --force`, then `cd`                    |

## 7. Behaviour change summary

| Scenario                                  | Before                                                                                           | After                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Start an exercise never downloaded        | Embedded: downloads, no `cd`. App-side: fails.                                                   | Downloads, then `cd`s                           |
| Start an in-progress exercise, CLI v7.8.2 | **Work silently deleted**, after a full re-download                                              | `cd` only; nothing downloaded                   |
| Start an in-progress exercise, newer CLI  | ~6s wait, then a "You already have..." error, and the learner still has to resume some other way | `cd` only; nothing downloaded                   |
| Resume latency                            | ≥6s (fixed CLI startup + GitHub release check on every invocation)                               | No subprocess; one `existsSync` + one JSON read |
| `under-control` (no `.git`)               | Correct only while it has a sole subdirectory                                                    | Right by construction                           |
| `fork-repo` (`ignore`)                    | Correct by accident because there are no subdirectories                                          | Right by construction                           |
| Learner has a stray folder                | Wrong, silently                                                                                  | Right                                           |
| Partial or failed download                | Guessed directory, later verify failure                                                          | `incomplete`, actionable message                |

## 8. Deferred: Restart Exercise

`gitmastery download <id> --force` deletes the exercise folder and any work in it, then
re-downloads. Blocked on the flag shipping — it does not exist in v7.8.2. When picked up it
needs:

- a minimum CLI version gate (the app no longer reads the CLI version; that would need a new probe)
- a destructive-action confirmation, since it deletes the learner's work
- a fallback for older CLIs: hide the button rather than shell out to a flag that errors

Worth evaluating first: **`gitmastery progress reset`** already ships in v7.8.2, and is what the
newer CLI's own error message recommends ahead of `--force`. It resets progress while keeping
the folder, which is closer to what "restart" usually means to a learner. Decide between the
two when this is picked up.

## 9. The `verify` working directory

Verify uses the same resolver as Start (`resolveExerciseCwd`) to know which directory the
learner should be in. It then compares that to the shell process cwd (`getCwd()` reads it
from the pty via `lsof` / `/proc`; it does not parse typed `cd`). If the live cwd cannot
be read, verify is blocked. Only an exact match (case-insensitive on Windows) is accepted.

The current probe supports macOS (`lsof`) and Linux (`/proc/<pid>/cwd`).
Windows returns `null`, so successful Verify is blocked there until a Windows
cwd probe is implemented. Download/resume does not require this probe.

If the identifier is invalid, the exercise is not `ready`, or the terminal is somewhere else,
`gitmastery verify` is **not** spawned. The renderer shows a small modal: the learner is not
in the exercise folder and should click Start Exercise, which downloads if needed and `cd`s.
Spawning anyway from a synthetic cwd hid the fact that the learner was not in the exercise
folder, and made Start look optional.

When the check passes, verify still spawns with `cwd` set to the resolved exercise directory —
the same path Start would `cd` into — rather than using `getCwd()` as the subprocess cwd.
The gate is the live shell directory so a typed `cd` away from the exercise blocks verify.

The CLI itself is tolerant of where inside the exercise it runs: `verify` is decorated
`@in_exercise_root()` with `must=False` (`app/commands/verify.py`) and `find_root` walks
_upward_ (`app/configs/utils.py`). The gate still requires the Start directory, not a nested
folder, so a stray `cd` into a subdirectory is sent back through Start.

## 10. Process spawn failures

`_download` and `_verify` each listen for `'error'` on the child process. A spawn that
never starts — GitMastery missing from `PATH`, exercise folder gone — emits `'error'` and then
usually `'close'` with `code === null`. Without an `error` listener Node raises this as an
uncaught exception in the main process. `_download` must still settle its promise on both
events: `close` logs `String(code)` (never `code!`), skips a second `completed` payload if
`error` already settled, and `settle`s in a `finally` so Start cannot hang with a poisoned
in-flight map.

## 11. Hands-on practicals

Hands-on practicals (`gitmastery download hp-<name>`) are not in `exercises.json`. The website
declares them in each lesson's `text.md` as `show_hop_prep('hp-…')`, with no `ex-verify-info-*`
hook. The app therefore:

- **Discovers** them by fetching those `text.md` files (cached like other remote catalogs) and
  listing each unique `hp-*` identifier in lesson source order in the left nav.
- **Starts** them through the same `startExercise()` path as exercises: resolve, download only
  if the folder is missing, then `cd`. The in-page control is **Start Hands-on** only — it
  replaces the hop-prep "Create a fresh sandbox" / "Manually set up a sandbox" option panels
  rather than sitting beside them. Verify is not offered.
- **Tracks progress** as downloaded vs absent. A folder named `hp-*` is always recorded as
  `downloaded`; CLI `progress.json` is ignored, and verify must not promote them to
  in-progress or completed.
