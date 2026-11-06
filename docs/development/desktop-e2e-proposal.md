# Desktop happy-path E2E proposal and implementation

**Status: cross-platform harness and optional GitHub workflow implemented; smoke passed on all three hosted runners.**
Three small Electron journeys check that a learner can download and resume an
exercise, verify terminal work, and manually complete a lesson. A separate
Windows test covers its current Verify limitation. The E2E workflow is separate
from the required Vitest gate.

## 1. Goals

Catch failures across the desktop's real process boundaries: lesson button →
preload → IPC → main process → CLI subprocess or terminal → visible result and
persisted progress. Parser and filesystem unit tests alone cannot establish
that those parts work together.

The suite should:

- protect existing work when Start resumes a downloaded exercise;
- prove that terminal input runs in the directory selected by Start;
- show successful verification and restore exercise completion after restart;
- persist manual lesson completion independently of exercise progress; and
- run without live website availability, an installed Git-Mastery CLI, or a
  learner's profile and exercise files.

The website and CLI are controlled substitutes. These tests establish desktop
integration with those contracts; they do not certify the live website, real
CLI grading, installation, signing, packaging, AI hints, setup, or native folder
selection. A separate real-CLI smoke provides compatibility evidence (§4).

## 2. Proposed E2E tests by OS

**E2E tests are possible on all three operating systems.** Windows currently
supports a smaller set of these journeys because the application has no Windows
terminal cwd probe. That blocks successful Verify, not Playwright or Electron
automation generally.

| Journey                                                                  | macOS                                          | Linux                                    | Windows                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Download, enter the exercise, and resume without losing work             | Passed locally and on GitHub                   | Passed on GitHub                         | Passed on GitHub with Git Bash                          |
| Verify a terminal solution and restore exercise completion after restart | Passed locally and on GitHub using real `lsof` | Passed on GitHub using `/proc/<pid>/cwd` | Explicitly skipped: production cwd probe returns `null` |
| Manually complete a lesson and restore it after restart                  | Passed locally and on GitHub                   | Passed on GitHub                         | Passed on GitHub                                        |
| Assert Windows Verify is blocked and never invokes CLI verification      | Skipped: Windows only                          | Skipped: Windows only                    | Passed on GitHub                                        |

Linux needs a graphical session such as Xvfb and working Electron/`node-pty`
dependencies. Windows needs Git for Windows for shell journeys and a real
`gitmastery.exe` fixture; renaming a POSIX script or using a `.cmd` shim does not
satisfy the application's executable contract. On Windows the harness copies
the runner's Node executable to `gitmastery.exe`; the test bootstrap supplies
the fixture script as its first argument. The child process is real, while
executable selection and that extra argument are test substitutions.

The Windows test starts and solves an exercise, clicks Verify, and asserts the
current “Not in the exercise folder” dialog, unchanged Downloaded status, empty
progress, and no `verify` subprocess. It does not count as successful
verification. A mocked cwd probe would hide this application limitation.

### Journey 1: Download and safe resume

1. Launch with a fresh profile and an empty linked exercises root. Complete
   Get Started → Next → Done through the real walkthrough.
2. Open the fixture tour and lesson through the sidebar. Click the embedded
   Start control injected by production code and wait for Continue.
3. Assert Downloaded, the manifest and repository folder, and exactly one
   `download under-control` invocation with the exercises root as cwd.
4. Type a command through xterm that writes a sentinel in `control-me`.
   Move away through the terminal and confirm that command ran at the root.
5. Click Start again, write another file through xterm, and confirm it appears
   back in `control-me`. The sentinel must be unchanged and there must still be
   only one CLI invocation.

This checks resume's actual directory change as well as preservation of work.

### Journey 2: Verify and restore exercise progress

1. Use an independent fresh profile/root and Start the exercise.
2. Type the installed Git's `git init` through xterm and wait for `.git`.
3. Click the injected Verify control. The fixture accepts only `verify` from
   the expected repository, with an actual `.git` directory present.
4. Assert “Exercise answer correct,” the Completed pill, exact CLI arguments
   and cwd, and a completed record in `progress/progress.json`.
5. Assert the lesson is still manually unmarked. Close Electron and relaunch
   with the same profile/root. Assert Completed is restored while the lesson
   still offers “Mark … as done,” with no additional CLI call.

The real desktop requires both successful process exit and
`INFO  Status: Completed`. Its real OS cwd probe must also pass. After restart,
the terminal begins at the exercises root; another Verify requires Start first.

### Journey 3: Manual lesson completion

1. Use another fresh profile/root and open the lesson without starting an
   exercise.
2. Click “Mark Fixture lesson as done.” Assert the inverse accessible label,
   `init` in `gm-lessons-done`, and “1 of 1 lessons completed.”
3. Restart Electron and assert those three states remain.
4. Assert no CLI invocation, exercise directory, or exercise progress record
   was created.

## 3. Harness and fixtures

### Running locally

Install the repository dependencies and ensure the Electron `node-pty` rebuild
has completed. The host needs Git, Bash, and a graphical session; macOS also
needs `lsof`, Linux needs readable `/proc`, and Windows needs Git for Windows
discoverable by `where git`. A separately installed Git-Mastery CLI is unnecessary.

```sh
# Build main process and renderer, then run the applicable journeys.
npm run test:e2e
# Linux without a display: xvfb-run -a npm run test:e2e
# The original npm run test:e2e:mac command remains available.

# Repeat each journey ten times against the existing build, with zero retries.
npx playwright test --config tests/e2e/playwright.config.ts --repeat-each=10

# Optional negative control: intentionally fail the Verify journey.
GM_E2E_REJECT_VERIFY=1 npx playwright test \
  --config tests/e2e/playwright.config.ts --grep 'Verify a terminal'
```

On macOS/Linux the negative control must exit nonzero and fail the correct-answer assertion.
It does not edit application code. Rebuild before testing changed application
code; the direct Playwright command intentionally reuses `dist-electron` and
`dist-react`.

The implementation lives in [`tests/e2e/`](../../tests/e2e/):

| File                   | Responsibility                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts` | Supported-platform guard, one worker, zero retries, bounded waits, results outside the repository                                                                            |
| `harness.ts`           | Fresh profile/root/home, executable and shell wrappers, Electron launch, UI helpers, restart, diagnostics, cleanup                                                           |
| `bootstrap.mjs`        | Load the real compiled main process, substitute CLI executable selection, install session protocol handlers before page loads, close test-owned Windows PTYs before quitting |
| `site.mjs`             | Fixed catalogs, minimal lesson DOM, Markdown, landing page and font response                                                                                                 |
| `cli.mjs`              | Strict argument/cwd checks, fixture download, `.git` check, output and persisted progress                                                                                    |
| `happy-paths.e2e.ts`   | Three happy paths plus the Windows Verify-blocked check                                                                                                                      |

### What is mocked and what is real?

| Boundary                                                                                      | Treatment                                                                                                                                             | Scope of the evidence                                                                                                                      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Website, catalogs, lesson source and font stylesheet                                          | **Mocked:** exact HTTP(S) URL map at the production origins; system fonts replace the remote stylesheet                                               | Real catalog consumption, navigation and button injection against a minimal site contract, not live site compatibility                     |
| Git-Mastery CLI download and grading                                                          | **Mocked:** executable fixture creates the manifest/repository, checks `.git`, writes progress and emits the expected text                            | Desktop CLI contract, not real downloads, grader rules, release checks or remote progress                                                  |
| Effective CLI executable selection                                                            | **Overridden:** test bootstrap replaces only `gitmastery` calls at `child_process.spawn`, forwarding to the original spawn with the fixture path      | Does not certify which installed CLI the app would execute; avoids macOS Homebrew paths taking precedence                                  |
| Tool-presence and exercises-root checks                                                       | **Real logic with prepared files:** fixture executable on PATH, root marker and config                                                                | Prerequisites are satisfied without setup or a folder-picker interaction; an installed CLI may satisfy presence but cannot be executed     |
| Electron window, React renderer and native `WebContentsView`                                  | **Real:** built application loaded from disk                                                                                                          | Actual desktop UI integration, not a packaged installer                                                                                    |
| Preloads, `window.electron`, IPC, Start/Verify handlers, manifest resolution and resume guard | **Real; no injected success messages or state changes**                                                                                               | Production orchestration and cross-process wiring                                                                                          |
| Child process, streams, exit handling and CLI output parsing                                  | **Real after executable substitution**                                                                                                                | Actual process termination and output interpretation                                                                                       |
| xterm, `node-pty`, Bash, terminal `cd`, Git and OS cwd probe                                  | **Real:** Bash/Git Bash, installed `git init`, and `lsof` or `/proc`; Windows still returns null; bootstrap kills test-owned Windows PTYs before quit | Typed commands reach the selected directory; Verify's production gate remains active; normal Windows application shutdown is not qualified |
| Config, manifests, exercise progress and filesystem                                           | **Real storage:** harness prepares initial root/config; CLI fixture writes exercise files and progress                                                | Desktop reads and restores disk state; real CLI persistence implementation is outside scope                                                |
| Manual lesson toggle, localStorage, tour count and restart                                    | **Real:** click the UI, fully close and relaunch Electron                                                                                             | Manual completion survives independently of exercise completion                                                                            |

The test bootstrap wraps one external process boundary without adding a
production flag or modifying application sources. Merely prepending the fixture
to PATH is insufficient: [CLI resolution](../architecture/cli-resolution.md)
prepends Homebrew directories on macOS.

### Isolation, synchronization and diagnostics

Each test owns a temporary profile, home and exercises root. The root includes
spaces and an apostrophe to exercise shell quoting; paths are canonicalized to
avoid macOS `/var` versus `/private/var` cwd mismatches. Git global/system config
is disabled. macOS/Linux use `/bin/bash --noprofile --norc`. Windows uses the
application's real Git Bash discovery with a temporary HOME/USERPROFILE; its
runner-provided system shell configuration remains in effect. Windows system
environment variables and PATH are preserved for OS and Git discovery. Linux
display variables are preserved so Electron can connect to Xvfb. Linux CI
launches test Electron with `--no-sandbox` for Ubuntu's user-namespace policy;
this suite therefore does not qualify Chromium sandbox behavior.

Windows bootstrap tracks the real PTYs returned by `node-pty`. Before asking
Electron to quit, the harness kills them and waits for their exit events so
ConPTY can dispose its workers while Electron's event loop is running. The
first hosted run reached the download, resume, and blocked-Verify assertions
but hung when quitting with ConPTY still alive; its exercise directories
remained locked. This cleanup belongs to the
test harness and makes restarts possible without changing production code.
Consequently the suite does not qualify the application's normal Windows
shutdown while a terminal is open. Temporary-directory removal permits a
bounded retry for Windows handles to be released; tests still have zero retries.

The harness prepares `.gitmastery.json`, empty `progress/progress.json`, and
`config.json` with `exercisesRoot`. It deliberately leaves `hideStartIntro`
unset: the real renderer automatically handles the first embedded Start's
intro response. It does not preseed onboarding or completion.

Tests use locator waits and poll for observable file effects, with no fixed
sleeps or retries. Every new test has an independent profile; persistence tests
reuse only their own profile across restart. Electron HTTP(S) sessions have no
live fallback: unknown URLs return an error and fail teardown. This is a
fixture boundary, not an operating-system network sandbox.

The harness closes Electron and removes profiles, roots and wrappers even on
failure. Playwright attaches process output, CLI calls and network requests;
failures also attempt a renderer screenshot. That screenshot does not include
the native lesson view. A JSON report retains results and attachments under the
system temporary directory as `git-mastery-e2e-results-<pid>/results.json`,
outside the repository.

### Architecture alignment and rollout

- [Automated testing strategy](../architecture/automated-testing-strategy.md):
  `npm test` remains the fast deterministic gate. The optional `*.e2e.ts`
  journeys are outside Vitest's default discovery. No required CI job is added.
- [Exercises root](../architecture/exercises-root.md): tests link a prepared
  root, and follow the current automatic intro handling without asserting an
  obsolete checkbox.
- [Directory resolution](../architecture/exercise-directory-resolution.md):
  both Start entry points share resolve → download-if-absent → cd. Verify uses
  the actual shell cwd. Hands-on practicals have no normal Verify flow and are
  deferred.
- [CLI output](../architecture/cli-output-in-terminal.md): echoed text alone
  does not prove terminal execution; assertions include files, subprocess
  records and visible results.
- [Lesson completion](../architecture/lessons-done.md) and
  [URL restore](../architecture/embedded-url-restore.md): manual completion,
  exercise progress and terminal cwd have separate lifecycles.

### GitHub CI and manual smoke runs

[Desktop E2E](../../.github/workflows/desktop-e2e.yml) runs independently on
`macos-15`, `ubuntu-24.04`, and `windows-2022`, using Node 22 and `npm ci`
with install scripts enabled for Electron and `node-pty`. Linux installs
Electron libraries and uses Xvfb. Each matrix job has a 20-minute limit and
uploads its JSON report and failure diagnostics for 14 days, even after failure.
Expected per OS: three passed and one platform-specific skipped test.

It triggers for pull requests, pushes to `main` or `test/**`, and manual
dispatch. The `test/**` trigger allows the first smoke run before this new
workflow exists on the default branch: commit and push this branch, then open
the repository's **Actions → Desktop E2E** run. No PR is necessary for that
first branch push. Subsequent pushes to a branch with an open PR may emit both
push and PR runs.

The existing **CI → Quality checks** job runs Vitest automatically on pull
requests and pushes to `main`. A `test/**` push without an open PR starts only
Desktop E2E. **Release** remains manually triggered and runs Vitest again in
its quality gate before versioning and publishing.

After the workflow is present on `main`, open **Actions → Desktop E2E → Run
workflow**, choose the branch, select **1**, **5**, or **10** repetitions, and
click **Run workflow**. GitHub requires a dispatchable workflow on the default
branch before exposing the manual trigger. The CLI equivalent is:

```sh
gh workflow run desktop-e2e.yml --ref test/macos-desktop-e2e -f repeat=10
gh run list --workflow desktop-e2e.yml --branch test/macos-desktop-e2e
gh run watch RUN_ID --exit-status
gh run download RUN_ID
```

**Optional means not required by branch protection**, not ignoring failures.
Keep `Desktop E2E (macOS)`, `Desktop E2E (Linux)`, and `Desktop E2E (Windows)`
out of the required checks in **Settings → Rules → Rulesets**, or legacy
**Settings → Branches → branch protection**. Preserve the existing quality
check. YAML cannot mark a check optional in repository settings, so the
workflow has no `continue-on-error`; failures remain visible. An administrator
must verify any organisation-wide rules or broad required-workflow policies.

First qualify each hosted runner, then use ten repetitions to look for flakes.
Do not interpret a skipped Windows success test as Verify support. Successful
Windows Verify still needs a production cwd probe. Keep real-CLI/live-site
smoke results separately reported.

## 4. Smoke and repeatability evidence

Evaluation date: **2026-11-06**. Local runs used macOS **26.3.2 arm64**, Node
**20.20.2**, Electron **41.10.5**, and Playwright **1.65.0**. This records the
observed environment, not a supported-version matrix; newer Node requirements
in some dependencies remain a separate environment concern.

### Real CLI and live website smoke

The earlier feasibility experiment ran desktop revision **`0310b91`** with
Git-Mastery CLI **7.8.2**, the live lesson website, an isolated profile/root,
and a controlled real Bash shell. Both builds passed; Electron loaded the
built renderer with `NODE_ENV=production`.

| Check                   | Observed result                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onboarding and download | Get Started → Next → Done; opened T1L3 and clicked embedded Start for `under-control`; Downloaded appeared and the terminal entered `control-me` |
| Resume                  | A sentinel file survived another Start; this ad hoc check did not independently count subprocesses                                               |
| Terminal and Verify     | Typed `git init` through xterm; `.git` appeared; embedded Verify showed “Exercise answer correct” and Completed                                  |
| Manual completion       | Verification left the lesson unmarked; clicking its done control stored `init` independently                                                     |
| Restart                 | Relaunch with the same temporary profile/root restored both exercise and manual lesson completion                                                |

The first real-CLI attempt lacked `progress/`. CLI 7.8.2 printed Completed but
failed to save progress and exited 1; the desktop correctly showed failure.
Preparing the [CLI setup layout](https://github.com/git-mastery/app/blob/v7.8.2/app/commands/setup_folder.py),
including empty `progress/progress.json`, made the full journey pass.

### Implemented fixture suite

The checked-in suite runs on branch `test/macos-desktop-e2e`, based on desktop
revision `c4473a3`, with no production source changes. Initial integration
reached all three functional outcomes but failed its strict network assertion
because the landing page and font stylesheet were missing from the URL map.
Those responses are now explicit fixtures; there is still no live fallback.

| Validation                                                | Result                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ten repetitions of each journey, one worker, zero retries | **30/30 passed in 1.1 minutes**                                                 |
| Deliberately reject the CLI fixture's Verify call         | **Failed as expected:** the correct-answer assertion timed out; runner exited 1 |
| Existing Vitest gate                                      | **66/66 passed**, five test files; no Electron journeys discovered by Vitest    |
| Build, TypeScript, lint and formatting of changed files   | Passed                                                                          |

No flakiness was observed in those 30 executions. This is finite evidence from
one local macOS environment, not a guarantee across machines or CI. Every
repetition launched from fresh state; Verify and manual completion each also
restarted Electron. These repetitions covered local macOS only.

After adapting the harness for all three OSes, `npm run test:e2e` built the
application and passed locally on macOS with **3 passed, 1 Windows-only skip in
9.9 seconds** of test-run time.

### GitHub-hosted runner smoke

The [hosted smoke run](https://github.com/git-mastery/git-mastery-desktop/actions/runs/42172558985)
tests desktop revision **`e2b320c`** on all three runners with Node 22, one
worker, one repetition, and zero test retries.

| Runner         | Passed | Skipped | Test-run time |
| -------------- | ------ | ------- | ------------- |
| `macos-15`     | 3      | 1       | 15.3 seconds  |
| `ubuntu-24.04` | 3      | 1       | 9.9 seconds   |
| `windows-2022` | 3      | 1       | 12.3 seconds  |

macOS/Linux skip the Windows-only blocked-Verify test. Windows skips successful
Verify because the production cwd probe is absent; it checks the blocked
outcome instead. Windows also uses the explicit PTY shutdown described in §3.
These smoke runs qualify the fixture journeys once per hosted runner.
Ten-repeat hosted qualification remains a follow-up, available through manual
dispatch after the workflow reaches the default branch.
