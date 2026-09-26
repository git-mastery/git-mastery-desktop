# AI hint context providers

What the hint assistant is told about the student, where each piece comes from, and why the
boundaries are drawn where they are. Placement, gating and the tutoring policy are in `ai-hints.md`.

## 1. Problem

A model that sees only the exercise text can only paraphrase it back, and, lacking any view of the
student's work, falls back on asking what they already tried. The student came here because they
are stuck; being questioned about their own history is the wrong response when that history is on
disk.

So each turn carries a fresh snapshot of the exercise, and the system prompt tells the model to
infer progress from it rather than ask.

## 2. Shape

`src/electron/ai/context.ts` holds an array of providers:

```ts
type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: {
    exerciseId: string;
    location: ExerciseLocation | null;
  }) => Promise<string | null>;
};
```

`collectContext` resolves the exercise location once (`locateExercise`), runs every provider in
parallel, drops anything that fails, times out or is empty, and truncates each to `MAX_BLOCK_CHARS`.

| Provider          | Block label      | Source                                                       |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| `instructions`    | Instructions     | live scrape of the lesson page, else the copy cached on open |
| `exercise-folder` | Exercise folder  | exercise manifest, progress store, names-only directory tree |
| `git-state`       | Repository state | read-only `git` subprocesses in each repository found        |

Adding a signal is one file under `ai/context/` plus one array entry. The system prompt, IPC and the
panel's context disclosure need no changes.

### Why separate blocks rather than one

Truncation at `MAX_BLOCK_CHARS` is per-block and silent. Concatenating sources means whichever lands
last is cut mid-line, in an order-dependent way. Separate blocks make the cap a per-source guarantee,
let a dead WebContentsView cost only the instructions, and keep the disclosure's labels granular.
Those labels are the student-facing record of what was sent, so they must name the actual sources.

Block text is fenced in `buildSystemPrompt` with a backtick run longer than any inside it. Porcelain
status lines begin with `##`, and the scraped instructions carry their own headings and code fences.
Without the fence, both would be read as structure of the surrounding prompt.

### Deadlines are not optional

Collection gates the turn, and every provider reaches something that can stall: a WebContentsView
mid-navigation, or a git subprocess. Each provider races `PROVIDER_TIMEOUT_MS` (2500 ms), and
`collectContext` takes the turn's abort signal. A partial context always beats a turn that will not
start.

### Instructions survive navigation

The instructions are scraped when the student clicks AI Hints and cached per exercise
(`session.ts`). Later turns try a live scrape first, and fall back to the cache when the student has
navigated to another page. Otherwise, reading ahead in the lesson would silently strip the model of
the task.

## 3. Directory resolution

The location comes from `resolveExerciseCwd`, mirroring `resolveReadyExerciseCwd` in
`ipc/gitmastery.ts`. The pty's tracked cwd (`getCwd()`) is deliberately **not** used. It is
regex-guessed from typed `cd` commands and drifts on `pushd`, `cd -`, subshells and chained commands,
so by the time a hint is requested it can point anywhere. See `exercise-directory-resolution.md` §9
for the same problem in `verify`.

`ExerciseLocation` carries the exercises root, the exercise root and the working folder (where Start
`cd`s). For hands-on practicals Start `cd`s into the single subdirectory when there is one
(`hp-init-repo/things`); otherwise it stays at the exercise root. The git provider still searches
rather than assuming (§5), because some practicals create the repository later.

## 4. What is never sent

- **File contents.** The folder provider lists names only; `.git` is summarised, not walked.
- **Anything outside the exercise folder.** The tree walk and repository search do not follow
  symlinks, and every repository is containment-checked (§5).
- **The student's home path or username.** Paths are rendered relative to the folder above
  `gitmastery-exercises`, e.g. `gitmastery-exercises/under-control`.
- **Terminal output and scrollback.** Output can echo anything the student ran, including
  credentials, and its size is unbounded.

Adding any of these would cross the boundary stated in `../llm-integration.md` and needs a new
decision, not an extension of this one.

## 5. The git provider

### Repository discovery

Candidates are the working folder plus every directory within `SEARCH_DEPTH` (2) of the exercise
root that contains `.git`, nearest first. Hidden directories are skipped and symlinks are not
followed. Each candidate must pass the containment check. At most `MAX_REPOS` (3) are described,
each under its own `### Repository at …` heading, so exercises that set up more than one
repository are all visible. If none pass, the block says so explicitly. For `under-control`,
where `git init` _is_ the task, "no repository yet" is the most useful fact the model can hold.

### Containment is a privacy control

A directory existing proves nothing about whether it is a repository, or **whose**. Git searches
upwards. In `under-control`, and in every `repo_type: "ignore"` exercise, a bare `git status`
succeeds against whatever repository sits above the exercises folder. A student whose home or
coursework directory is a repository would have unrelated branch names and filenames sent to a
third-party free tier.

So each candidate runs `git rev-parse --show-toplevel` first, and `fs.realpathSync` of the result
must equal the candidate exactly. Anything else means "not a repository here", and nothing more
runs. `GIT_CEILING_DIRECTORIES` is set to the candidate's parent as a second line of defence.

### Commands

`status --porcelain=v1 -b`, `log --oneline --decorate --all -n 15`, `branch -vv`, `remote -v`,
`tag --list` and `stash list` run in parallel via `execFile` with an args array (no shell, matching
the rest of the codebase).

- **Porcelain, not plain `git status`.** Plain status advertises commands in its hint lines
  (`use "git restore --staged <file>..."`), which works against a model meant to stay inside the
  course. Porcelain suggests nothing. The cost is a short legend, because the XY column semantics are
  what a small model misreads.
- **`--no-optional-locks`.** Status runs on every send, exactly when the student may be part-way
  through their own `git add`. Without the flag, status rewrites the index and can race `index.lock`.
- **No `--graph`.** The ASCII art is noise to a small model; `--decorate --all` plus `branch -vv`
  carries the same topology more legibly.
- **Paused operations.** A paused merge, rebase, cherry-pick, revert or bisect is reported from
  marker files in `rev-parse --absolute-git-dir`. Porcelain status alone does not say which
  operation is in progress, and "you are mid-rebase" is often the whole answer.
- `GIT_TERMINAL_PROMPT=0`, a 1500 ms timeout and a 1 MB buffer.

## 6. Cost

Context is collected per send, so the system prompt is rebuilt every turn. `data-*` parts are dropped
by `convertToModelMessages`, so context does not accumulate across turns. Cost is linear in turns,
not quadratic, and the model never sees earlier turns' repository state. History sent to the model is
capped at the last 20 messages.

Added latency per send is a directory walk, one `rev-parse` per candidate, six parallel git commands
per repository and one `executeJavaScript`. That is typically well under 200 ms, bounded at 2500 ms,
against free-tier first-token latency.
