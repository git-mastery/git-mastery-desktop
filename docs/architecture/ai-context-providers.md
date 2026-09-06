# AI hint context providers

What the hint assistant is told about the student, where each piece comes from, and why the
boundaries are drawn where they are.

## 1. Problem

The first version of the feature sent the model one thing: the exercise brief scraped from the
lesson page (`getExerciseText`). That leaves the assistant blind in two ways at once.

It cannot see **what the student did**, so it can only paraphrase the exercise text back at them.
It cannot see **where they are in the course**, so it answers with whatever Git it knows — a
student stuck on T1L4 (staging) gets told to `git restore --staged`, or to rebase. For a teaching
tool, a hint pitched twenty lessons ahead is worse than no hint.

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
to `MAX_BLOCK_CHARS`. Three ship today:

| Provider        | Block label      | Source                                       |
| --------------- | ---------------- | -------------------------------------------- |
| `exerciseBrief` | Exercise brief   | live DOM scrape of the lesson page           |
| `gitState`      | Repository state | `git` subprocesses in the exercise directory |
| `curriculum`    | Course position  | vendored lesson table + `exercises.json`     |

Adding a fourth signal is one file plus one array entry. The system prompt, IPC, and the panel's
context chip need no changes.

### Why three blocks rather than one

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
  inside the curriculum works directly against the course-position block. Porcelain suggests
  nothing. It costs a ~150-char legend, since the XY column semantics are what a small model
  misreads.
- **`--no-optional-locks`.** This runs on every message send, which is exactly when the student may
  be part-way through their own `git add`. Without it, `status` refreshes and rewrites the index
  and can race `index.lock`.
- **No `--graph`.** The ASCII art is noise to a small model; `--decorate --all` plus `branch -vv`
  carries the same topology more legibly.
- `GIT_TERMINAL_PROMPT=0`, a 1200 ms timeout and a 1 MB buffer. No other child process in this app
  has a timeout; that precedent is not worth extending.

Total output measured on real exercises is well under 1 KB.

## 4. The curriculum provider

### Sourcing rule

All _lesson_ information reaching the model — position, title, concepts — comes from the website
repo's canonical sequence file and nowhere else:

```
https://github.com/git-mastery/git-mastery.github.io/blob/master/.claude/skills/concepts-review/references/git-mastery-lesson-sequence.md
```

`lessons.json` is **not** read on the AI path; it remains the sidebar's navigation data.
`exercises.json` is read for exactly one thing — which lesson an exercise belongs to — and its
embedded lesson titles are ignored. One source for lesson content means no chance of two sources
disagreeing about what a student has been taught.

### Vendored, not fetched

`scripts/generate-curriculum.mjs` fetches and parses the sequence file into
`src/electron/ai/curriculumData.ts`, which is committed. It must be a `.ts` module: the electron
`tsconfig.json` has no `resolveJsonModule` and includes only `.ts`/`.cts`/`.mts`, and
`electron-builder.json` ships only `dist-react` and `dist-electron` — a committed `.json` under
`src/electron` would work under `npm run dev` and silently vanish from a packaged build.

Fetching it at runtime was rejected. The app already depends on `exercises.json` at runtime (no
sidebar without it), so fetching _that_ adds no new failure mode — but it has no existing
dependency on `raw.githubusercontent.com`, and the sequence file is Markdown in an agent-tooling
directory rather than a published, versioned artifact. A table reformat would silently kill the
feature for every user simultaneously; through the generator it breaks one script, in front of a
human, with users unaffected until it is fixed. The generator exits non-zero on fewer than 43 rows
or non-monotonic ordinals, so that failure is loud. Course content changes at most per semester,
which is the release cadence anyway.

`exercises.json` is fetched once at startup into a module-level value and **read**, never awaited,
on the send path. An unresolved fetch costs the student this block, not a delayed message.

### A ceiling, not a syllabus

The block names the current position, that lesson's concepts, and every lesson still ahead:

```
Course position: T1L4 — Specifying What to Include in a Snapshot
Concepts the student can rely on: Modified/new files; staging area/index; ...
Not taught yet, do not introduce: T1L5 commit, T1L6 log, T2L1 remoteRepos, ... T10L3 otherPmFeatures
If an answer seems to need one of those, say this exercise does not require it and redirect ...
```

Only the **current** lesson's concepts go in. An earlier design sent the cumulative concept map
for every lesson so far — 5,391 chars worst case, ~1,350 tokens _per turn_ on a rate-limited free
tier. It was rejected for growing in the wrong direction: it is largest at late exercises, where
the student needs the least help staying in bounds, and it expands the model's surface area rather
than constraining it. Earlier lessons are implicitly available and cost nothing to omit.

The forward list is **uncapped**, measured at 1,048 chars at T1L1 and shrinking to 383 by T9L1 —
largest exactly when the student knows least. An earlier draft capped it at 15 entries, which for
a T1L4 student silently dropped `interactiveRebase` and `cherryPick`: precisely the far-future
material a model is most likely to reach for wrongly.

Naming the forbidden lessons concretely matters more than the wording of the rule. The prompt
already carries one unenforced advisory ("do not hand over the full sequence of commands"); a
second _abstract_ one dilutes it rather than compounding. The stated fallback matters too — weak
models break prohibitions hardest when the prohibition leaves them nothing to say.

### Known limits

- The sequence file's concepts are prose, so the constraint reads "do not introduce lesson X"
  rather than "do not emit `git rebase`". Weaker than literal command tokens would be, and the
  price of a single maintained source. If violations show up in practice, the fix is a `commands`
  field upstream — not a second table here.
- Exercises are selectable out of order, so "what the student has covered" is a fiction for
  someone who opens exercise 30 first. The deny list degrades gracefully because it keys on the
  current exercise's lesson rather than on history; a cumulative narrative would not.
- Detour exercises inherit their parent lesson's position, as the upstream reference prescribes.

## 5. Cost

Context is collected per send, so the system prompt is rebuilt every turn. `data-*` parts are
dropped by `convertToModelMessages` (verified in the installed `ai` package), so context does not
accumulate across turns — cost is linear in turns, not quadratic — and the model never sees prior
turns' repository state.

Added latency per send is roughly one `rev-parse` plus three parallel git commands and one
`executeJavaScript`: under 100 ms typically, bounded at 1500 ms, against free-tier first-token
latency.
