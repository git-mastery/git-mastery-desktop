# AI hint context providers

What the hint assistant is told about the student, where each piece comes from, and why the
boundaries are drawn where they are.

## 1. Problem

The first version of the feature sent the model one thing: the exercise brief scraped from the
lesson page (`getExerciseText`). That leaves the assistant unable to see **what the student did**,
so it can only paraphrase the exercise text back at them — and, lacking any view of the repository,
it falls back on asking the student what they have already tried. The student came here because
they are stuck; being interrogated about their own history is the wrong response when the history
is sitting on disk.

So the assistant is given a live snapshot of the exercise repository on every turn, and the system
prompt tells it to infer progress from that snapshot rather than ask.

## 2. Shape

`src/electron/ai/context.ts` holds an array of providers:

```ts
type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: { exerciseId: string }) => Promise<string | null>;
};
```

`collectContext` runs them, drops anything that fails, times out, or is empty, and truncates each
to `MAX_BLOCK_CHARS`. Two ship today:

| Provider        | Block label      | Source                                       |
| --------------- | ---------------- | -------------------------------------------- |
| `exerciseBrief` | Exercise brief   | live DOM scrape of the lesson page           |
| `gitState`      | Repository state | `git` subprocesses in the exercise directory |

Adding a third signal is one file plus one array entry. The system prompt, IPC, and the panel's
context chip need no changes.

### Why separate blocks rather than one

Truncation at `MAX_BLOCK_CHARS` is per-block and silent. Concatenating sources into one block
means whichever lands last gets amputated mid-line with no signal, in an order-dependent way.
Separate blocks make the cap a per-source guarantee, let a dead WebContentsView cost only the
brief, and keep the chip's labels granular — those labels are the student-facing disclosure of
what was sent, so they have to name the actual sources.

Block text is fenced in `buildSystemPrompt` with a backtick run longer than any inside it.
Porcelain status lines begin with `##`, and the scraped brief carries its own headings and code
fences; unfenced, both are read as structure of the surrounding prompt.

### Deadlines are not optional

Collection gates the turn, and every provider reaches something that can stall — a
WebContentsView mid-navigation, a git subprocess. Before this change there was no deadline and no
abort wiring: a stalled provider left the panel waiting forever with a dead Stop button, because
`AbortController.signal` reached only `streamText`. Each provider now races a 1500 ms timeout, and
`collectContext` takes the signal. A partial context always beats a turn that will not start.

## 3. The git provider

### Directory resolution

Resolved from the exercise identifier via `resolveExerciseCwd`, mirroring
`resolveReadyExerciseCwd` in `ipc/gitmastery.ts`. The pty's tracked cwd (`getCwd()`) is
deliberately **not** used: it is
regex-guessed from typed `cd` commands and drifts on `pushd`, `cd -`, subshells and chained
commands, so by the time a hint is requested it can point anywhere. See
`exercise-directory-resolution.md` §9 for the same problem in `verify`.

Consequently `ContextCollectArgs` carries only `exerciseId`. The old `cwd` field was removed
rather than left unused, so the next provider author does not reach for it.

### Containment is a privacy control

`resolveExerciseCwd` returning `ready` proves a directory exists. It proves nothing about whether
that directory is a repository, or **whose**. Git searches upwards. In `under-control` — where
running `git init` _is_ the exercise — and in every `repo_type: "ignore"` exercise, a bare
`git status` succeeds against whatever repository sits above the exercises folder. Reproduced with
a repository one level up, a naive provider returns:

```
## my-private-branch
?? gitmastery-exercises/
```

That is a student's unrelated branch names and filenames, sent to a third-party free tier.

So the provider runs `git rev-parse --show-toplevel` first, serially, and compares
`fs.realpathSync` of the result against the resolved cwd. Anything other than an exact match means
"no repository here" and nothing else runs. `GIT_CEILING_DIRECTORIES` is set to the parent as a
second line of defence.

This is also the pedagogically correct answer: for `under-control` the student genuinely has not
initialised a repository, and that is the single most useful fact the model could hold. The probe
additionally gates the other three commands, replacing three exit-128 failures with one answer.

### Commands

`git status --porcelain=v1 -b`, `log --oneline --decorate --all -n 15`, `branch -vv`, `remote -v`,
run in parallel via `execFile` with an args array — no shell, matching the rest of the codebase.

- **Porcelain, not plain `git status`.** Plain status advertises commands in its hint lines
  (`use "git restore --staged <file>..."`). Feeding those to a model whose whole job is to stay
  inside the course works against the exercise. Porcelain suggests nothing. It costs a ~150-char legend, since the XY column semantics are what a small model
  misreads.
- **`--no-optional-locks`.** This runs on every message send, which is exactly when the student may
  be part-way through their own `git add`. Without it, `status` refreshes and rewrites the index
  and can race `index.lock`.
- **No `--graph`.** The ASCII art is noise to a small model; `--decorate --all` plus `branch -vv`
  carries the same topology more legibly.
- `GIT_TERMINAL_PROMPT=0`, a 1200 ms timeout and a 1 MB buffer. No other child process in this app
  has a timeout; that precedent is not worth extending.

Total output measured on real exercises is well under 1 KB.

## 4. Cost

Context is collected per send, so the system prompt is rebuilt every turn. `data-*` parts are
dropped by `convertToModelMessages` (verified in the installed `ai` package), so context does not
accumulate across turns — cost is linear in turns, not quadratic — and the model never sees prior
turns' repository state.

Added latency per send is roughly one `rev-parse` plus four parallel git commands and one
`executeJavaScript`: under 100 ms typically, bounded at 1500 ms, against free-tier first-token
latency.
