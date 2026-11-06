# AI hint context providers

What the hint assistant is told about the student, where each piece comes from, and why the
boundaries are drawn where they are. Placement, gating and the tutoring policy are in `ai-hints.md`.

## 1. Problem

A model that sees only the exercise text can only paraphrase it back, and, lacking any view of the
student's work, falls back on asking what they already tried. The student came here because they
are stuck; being questioned about their own history is the wrong response when that history is on
disk.

Each turn recollects workspace evidence. The prompt distinguishes this evidence from task setup,
stored achievement, student reports, and previous advice. Initial conditions such as “this branch
has not been pushed” must not override current refs. The collection spans a short time window;
it is not an atomic snapshot or a complete record of the student's actions.

## 2. Shape

`src/electron/ai/context.ts` holds an array of providers:

```ts
type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: {
    exerciseId: string;
    location: ExerciseLocation | null;
    signal?: AbortSignal;
  }) => Promise<string | AiContextBlock[] | null>;
};
```

`collectContext` resolves the exercise location once (`locateExercise`), runs every provider in
parallel, drops anything that fails, times out or is empty, and caps each block at 8,000 characters
with an explicit truncation marker. A provider may return multiple blocks without changing IPC.

| Provider          | Block label                                                                                                                                                    | Source                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `instructions`    | Instructions                                                                                                                                                   | live scrape of the lesson page, else the copy cached on open                                                           |
| `exercise-files`  | Exercise file contents; File contents · relative path                                                                                                          | bounded visible UTF-8 working files, including questions and learner answers                                           |
| `exercise-folder` | Exercise folder                                                                                                                                                | exercise manifest, progress store, names-only directory tree                                                           |
| `git-state`       | Repository state; Local branch relationships; Branch ancestry and counts; Branch commit history; Branch operation history; Local tag details; Live remote refs | separate blocks per repository, from read-only Git observations                                                        |
| `github-state`    | GitHub state                                                                                                                                                   | fresh account, repository/fork and authored open PR metadata for targets discovered from exercise remotes and manifest |

Adding a signal is one file under `ai/context/` plus one array entry. The system prompt, IPC and the
panel's context disclosure need no structural changes. Providers with new evidence semantics also
update the prompt's interpretation rules.

### GitHub state

Every exercise and hands-on chat collects the same compact **GitHub state** block on each message,
using the learner's existing `gh` login. Targets come from local GitHub remotes and the manifest's
`exercise_repo.pr_repo_full_name`; there are no exercise-specific rules.

The AI receives:

1. **Account:** signed-in `login` from `gh api user`.
2. **Repository:** identity, visibility, fork flag and parent (for forks) from
   `gh api repos/<owner>/<name>` (`full_name`, `visibility`, `fork`, `parent.full_name`).
   A changed identity is shown when GitHub redirects a renamed repository.
3. **The account's open PRs:** number, draft status, head repository and head/base branches from
   `gh pr list --repo <owner/name> --author <login> --state open`
   (`number`, `isDraft`, `headRepository`, `headRepositoryOwner`, `headRefName`, `baseRefName`).
4. **Unknown or omitted data:** short failure reasons and warnings only when a limit is reached.

The block is capped at 2,000 characters, three repositories and five open PRs per repository.
Collection remains read-only with a 2.1-second deadline. It sends no timestamps, source traces,
PR URLs, commit hashes or repeated guidance. The prompt has one GitHub interpretation rule:
prefer current facts; unknown or omitted evidence is inconclusive; metadata is not verification.

### Why separate blocks rather than one

Truncation at `MAX_BLOCK_CHARS` is per-block and marked. Concatenating repositories or putting tag
details after a long log can discard the decisive evidence. Separate blocks protect those sources,
and ancestry summaries are separate from detailed histories and reflogs. Omitted entries remain
unknown; a truncated list never establishes absence. The disclosure's labels include the repository.
Those labels are the student-facing record of what was sent, so they must name the actual sources.

Block text is fenced in `buildSystemPrompt` with a backtick run longer than any inside it. Porcelain
status lines begin with `##`, and the scraped instructions carry their own headings and code fences.
Without the fence, both would be read as structure of the surrounding prompt.

### Deadlines are not optional

Collection gates the turn, and every provider reaches something that can stall: a WebContentsView
mid-navigation, or a git subprocess. Each provider races `PROVIDER_TIMEOUT_MS` (2500 ms), and
`collectContext` takes the turn's abort signal. Git work has an inner 2,100 ms deadline, passed to
child processes, leaving time to return partial results before the outer deadline. Its per-send
reader deduplicates commands and limits concurrency to eight subprocesses. Failed commands return
unknown, with no raw error logging that could disclose URLs. Other provider failures still omit
their blocks; broader structured failure reporting remains deferred.

### Instructions survive navigation

The instructions are scraped when the student clicks AI Hints and cached per exercise
(`session.ts`). Later turns try a live scrape first, and fall back to the cache when the student has
navigated to another page. Otherwise, reading ahead in the lesson would silently strip the model of
the task.

## 3. Directory resolution

The location comes from `resolveExerciseCwd`, mirroring `resolveReadyExerciseCwd` in
`ipc/gitmastery.ts`. The terminal's live cwd (`getCwd()`) is not used for hints: a hint
should still see the exercise folder even if the learner `cd`'d elsewhere. Verify uses
`getCwd()` as a gate; see `exercise-directory-resolution.md` §9.

`ExerciseLocation` carries the exercises root, the exercise root and the working folder (where Start
`cd`s). For hands-on practicals Start `cd`s into the single subdirectory when there is one
(`hp-init-repo/things`); otherwise it stays at the exercise root. The git provider still searches
rather than assuming (§5), because some practicals create the repository later.

## 4. File contents and exclusions

- **Staged and historical file bodies are not collected.** Working text comes from the file
  provider (§4.1); Git supplies separate metadata, subjects, reflogs and tag annotations.
- **Unrelated repositories.** The Git collector rejects working folders, gitdirs and worktree
  common directories outside the canonical exercise boundary (§5). Local file remotes are also
  confined to that boundary. Broader workspace-generation and all-provider containment work
  remains deferred.
- **Absolute workspace paths in generated labels.** Paths are rendered relative to the folder above
  `gitmastery-exercises`, e.g. `gitmastery-exercises/under-control`. Remote displays omit login
  usernames; URLs containing credentials or query strings are skipped. Git commit/tag text is
  learner-authored metadata, not a general-purpose secret-redaction guarantee.
- **Terminal output and scrollback.** Output can echo anything the student ran, including
  credentials, and its size is unbounded.
- **Remote file contents and PR descriptions.** The GitHub provider sends metadata only.

### 4.1 Bounded working text, including learner answers

`exerciseFiles.ts` reads visible UTF-8 text inside the current exercise folder, including files
outside its Git repository, untracked files, and answer sheets. The same provider serves exercises
and hands-on practicals. It does not depend on a manifest allowlist or parse question/answer formats.

The reason to include answers is diagnostic: an untouched answer sheet and a completed one used to
look identical, and filenames could not reveal incorrect edits or conflict markers. Reading the
actual attempt provides useful evidence with less code than per-exercise answer-progress and
file-state classifiers. The tutoring policy still withholds corrected answers and finished
solutions; collecting an attempt does not certify it or authorize completing it for the learner.

The collector uses a breadth-first walk with these fixed rules:

- Skip every dot-prefixed file and directory, including `.git`, `.env`, and `.gitignore`.
- Skip `node_modules`, `vendor`, `venv`, and `__pycache__`; they can be visible directories.
- Skip common key filenames/extensions and credential filenames, and text containing a PEM
  private-key header. Skipping hidden files alone would miss visible keys.
- Accept only regular UTF-8 text without binary control bytes; never follow symlinks. Canonical
  paths must remain inside the exercise, whose root must remain inside the linked exercises folder.
- Inspect at most 200 directory entries to depth five, include at most 20 files, skip files larger
  than 32 KiB, and send at most 6,000 content characters per file and 24,000 in total.

Each included file has a relative path and JSON-quoted text preserving whitespace, in its own
context block. A summary records exclusions and traversal limits. Per-file excerpts and the
outer 8,000-character block cap mark truncation explicitly. Missing, unreadable, excluded and
truncated contents remain unknown.

This intentionally excludes `.gitignore` contents even in ignore exercises. It also does not
inspect staged/historical versions or execute student code. Those limitations call for a precise
check when needed, rather than a more elaborate collector. The names-only folder tree and Git
status can still mention hidden filenames; the exclusion applies to file-body collection.

These filters reduce accidental disclosure; they are not a universal secret detector. Visible
exercise text and learner answers are sent to the selected AI provider as written, unless filtered
or truncated. Verifying the exercise folder establishes location, not the sensitivity of every
file a learner might add. The existing context disclosure shows the text attached to each turn.

## 5. The git provider

### Repository discovery

Candidates are the working folder plus directories within depth two of the exercise root that
contain `.git`, nearest first. The walk examines at most 200 directories and 12 candidates, skips
hidden directories and symlinks, and stops descending when it finds a repository. At most three
repositories are described in separate blocks. An empty result means no inspectable repository was
found within these limits, not proof that no repository exists anywhere below the exercise.

### Derived facts

Raw porcelain is easy for a small model to ignore. After the commands run, `git-state` prepends a
short, conservative summary of what they already show:

- working folder versus where `.git` actually is
- attached branch or detached HEAD, plus the current commit subject
- clean, dirty, or conflicted working tree (conflicted paths by name)
- paused merge, rebase, cherry-pick, revert, or bisect
- merge direction when `MERGE_HEAD` can be named (`bringing <incoming> into <current>`)

The summary is structural. It does not encode exercise ids, expected branches, or verifier
answers. The raw command output stays below it as evidence. If a fact cannot be parsed, it is
omitted rather than guessed.

### Containment is a privacy control

A directory existing proves nothing about whether it is a repository, or **whose**. Git searches
upwards. In `under-control`, and in every `repo_type: "ignore"` exercise, a bare `git status`
succeeds against whatever repository sits above the exercises folder. A student whose home or
coursework directory is a repository would have unrelated branch names and filenames sent to a
third-party free tier.

Before Git runs, canonical paths for the exercise, working folder, candidate, `.git` pointer and
worktree `commondir` must stay within the exercise boundary. External gitdirs and repositories
using alternate object stores are unsupported. Then `rev-parse --show-toplevel` must resolve to
the candidate exactly. `GIT_CEILING_DIRECTORIES` is set to the candidate's parent, inherited
`GIT_*` overrides are removed, optional locks and fsmonitor are disabled, and lazy fetching is
disabled so missing objects do not trigger an implicit fetch.

### Commands

Commands use `execFile` with argument arrays, a 1,500 ms subprocess timeout and a 1 MiB buffer.
No fetch, prune, checkout or verifier runs during collection.

- **Porcelain, not plain `git status`.** Plain status advertises commands in its hint lines
  (`use "git restore --staged <file>..."`), which works against a model meant to stay inside the
  course. Porcelain suggests nothing. The cost is a short legend, because the XY column semantics are
  what a small model misreads.
- **`--no-optional-locks`.** Status runs on every send, exactly when the student may be part-way
  through their own `git add`. Without the flag, status rewrites the index and can race `index.lock`.
- **Local refs.** `for-each-ref` collects up to 60 local branches and 60 remote-tracking refs,
  including full object IDs, upstreams and symbolic targets. Relationships for the first eight
  local branches compare configured upstreams and same-name tracking refs with
  `rev-list --left-right --count`. A missing upstream is explicitly independent of push status.
- **Topology.** For HEAD and the first eight local branches, logs carry commit IDs and parent IDs
  (12 commits per ref), alongside reachable commit/merge counts and pairwise ancestry. A shallow
  repository is labeled; its available history does not prove full ancestry.
- **Operation history.** Up to eight reflog events per inspected ref expose rename, reset and
  merge events with time and without author/email fields. Clone/fetch/pull/push command text is
  redacted. Missing or expired reflogs mean unknown. `SQUASH_MSG` is reported only as a preparation
  marker that may remain after a commit, not proof of correctness.
- **Tags.** Up to 20 local tags carry object type/ID, lightweight versus annotated kind, fully
  peeled target, and at most 1,200 characters of annotation. Tagger identity is excluded.
- **Paused operations.** A paused merge, rebase, cherry-pick, revert or bisect is reported from
  marker files in the validated Git directory. Porcelain status alone does not say which
  operation is in progress, and "you are mid-rebase" is often the whole answer.

### Remote observations are separate

`remote get-url --all` resolves fetch and push destinations separately. For at most three configured
remotes and four destinations per remote, `ls-remote --heads --tags` reads server advertisements.
Shared fetch/push URLs are queried once. Tag `^{}` rows are normalized into the tag's peeled target.
Same-name branches are explicitly reported as matching, different, or not advertised at the checked
target. Remote ancestry is not inferred from different IDs.

Only HTTPS, SSH, and local file targets inside this exercise are supported. Network queries use an
empty Git configuration, with protocol restrictions, credential helpers disabled, and SSH in batch
mode with existing trusted host keys. This deliberately trades private/custom-auth remote coverage
for bounded, noninteractive observations without credential helper side effects. Failed
authentication, network errors, skipped URLs and timeouts all produce **unknown**, never “absent.”
Displayed remote lists are also bounded. No observation updates local remote-tracking refs.

Remote identity is not proof of fork ownership, repository visibility, or PR state. GitHub API
context is a separate feature.

## 6. Cost

Context is collected per send, so the system prompt is rebuilt every turn. `data-*` parts are dropped
by `convertToModelMessages`, so context does not accumulate across turns. Cost is linear in turns,
not quadratic, and the model never sees earlier turns' repository state. History sent to the model is
capped at the last 20 messages.

Git evidence adds bounded local commands and optional network latency on each send. One reader
shares a deadline and command cache for that collection only. The overall provider ceiling remains
2,500 ms; large repositories or slow remotes yield explicitly partial evidence. Independent blocks
increase the maximum payload compared with the former single Git block, while preserving decisive
refs, counts and tags when detailed history is truncated.

GitHub collection reads the account and discovers targets, then queries repository and PR metadata
in parallel within a 2,100 ms deadline. Those facts are recollected each turn; only rate-limit retry
timing is retained.
