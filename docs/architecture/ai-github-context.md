# GitHub context for AI hints

When a learner asks for a hint, the app sends the AI information about their current exercise.
For four exercises, it also reads GitHub through the learner's signed-in GitHub CLI (`gh`).
This lets the AI see facts that local Git cannot establish, such as whether a repository is public,
whether it is a fork, or whether the learner has opened a pull request.

These facts appear in a **GitHub state** text block, alongside the other exercise context.
The learner can inspect that block in the AI Hints context disclosure. It is refreshed for each
message and does not mark the exercise as passed.

## Exactly what the AI receives

The block contains the shared information below, followed by either repository information or
pull request information. It contains selected fields and short explanations, not raw API responses.
If a lookup fails, unavailable fields are replaced by an explicit unknown reason.

### Shared information

- **Observation time:** when collection started and finished.
- **GitHub host:** GitHub.com.
- **Signed-in account:** the GitHub username returned by `gh`, when the account lookup succeeds.
  This can differ from the author name configured in local Git.
- **Lookup failure, if any:** which information is unknown and why, such as missing authentication,
  timeout, or a repository that is absent or inaccessible.
- **Interpretation rules:** use these current observations over earlier assistant guesses;
  unknown does not mean failed; GitHub metadata alone does not establish exercise completion.
- **Exercise-specific limitations:** the local clone, submitted URL or committed file content
  that this provider does not check, as listed in the exercise table below.

An unsupported exercise or unavailable exercise location produces no GitHub block. A missing
manifest or conflicting PR target produces an unknown block without a GitHub request. An account
lookup failure stops collection before any account-specific target is queried.

### Repository information

For `fork-repo`, `clone-repo` and `remote-control`, the block includes:

1. **Expected repository:** the account and repository name required by the exercise.
2. **Observed repository:** the full `owner/name` returned by GitHub.
3. **Name match:** whether the observed and expected identities match, ignoring letter case.
   A renamed repository can return a different identity through a redirect.
4. **Visibility:** `public`, `private` or `internal`, as returned by GitHub.
5. **Fork flag:** whether GitHub identifies this repository as a fork.

For `fork-repo` and `clone-repo`, it also includes:

6. **Direct parent repository:** the `owner/name` of the repository this fork was made from,
   or an explicit unknown when GitHub does not supply it.
7. **Expected fork relationship:** the task names `git-mastery/gm-shapes`; the exercise verifier
   checks that the repository is a fork and its direct parent's owner is `git-mastery`.

For `remote-control`, it also includes:

6. **Public-visibility check:** whether the observed visibility satisfies the task's public
   repository requirement.

The name match and public-visibility check are comparisons made by the app. The repository
identity, visibility, fork flag and parent come from GitHub. None is an overall pass/fail result.

### Pull request information

A pull request (PR) proposes changes from a **head** branch into a **base** branch.
For `create-pr-from-main`, the block includes:

1. **Search scope:** open PRs authored by the signed-in account in `git-mastery/gm-languages`,
   with a limit of 30 and no head/base branch filter.
2. **Returned count:** how many matching PRs the query returned.
3. **Limit warning:** when 30 are returned, additional candidates may exist.
4. **Selected PR number:** the highest number in the returned set, matching the exercise
   verifier's selection rule. Only this PR's details are sent, not the whole candidate list.
5. **Selected PR URL:** constructed from the fixed course repository and the PR number.
6. **State:** `OPEN`; closed and merged PRs are not queried.
7. **Draft flag:** whether the selected PR is a draft.
8. **Head repository:** its owner and name, or unknown if unavailable or deleted.
9. **Head branch:** the source branch containing the proposed changes.
10. **Head commit ID:** the commit GitHub currently reports at the tip of that branch.
11. **Base branch:** the destination branch the PR proposes to change.
12. **Head-branch check:** whether the head branch is `main`, as required by this exercise.
13. **Content limitation:** the submitted `Java.txt` content and the verifier's selected commit
    (`last_user_commit`) have not been checked.

If the query succeeds with no results, the block says no matching open PR was returned and omits
the selected-PR fields. It does not claim that the learner has never created a PR. GitHub search
indexing can delay a newly created PR appearing in results.

For example, if PR #8 uses `feature` and an older PR #2 uses `main`, the app selects #8 and
reports the wrong head branch. Filtering for `main` would hide the PR the verifier would inspect.
A head commit ID tells the AI which revision GitHub reported; it does not reveal that revision's
file contents.

### What this block does not contain

- Repository files, file contents, diffs, or the contents of `Java.txt`.
- PR titles, descriptions, comments, reviews, or details of the unselected candidates.
- Account profile details, email addresses, credentials or authentication tokens.
- Other account repositories, closed/merged PR history, or an account-wide activity feed.
- Terminal output, raw API responses or raw subprocess errors.
- Verification output, the URL typed into verification, or a newly computed exercise grade.

Local Git state and other exercise information come from
[separate context providers](ai-context-providers.md). These exclusions describe the GitHub block,
not everything that may appear elsewhere in the AI's context.

## Which exercises are supported

`<login>` below means the account currently authenticated in GitHub CLI.

| Exercise              | GitHub target                                       | What still needs checking elsewhere                                                                                 |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `fork-repo`           | `<login>/gm-shapes`                                 | The exercise's verification result                                                                                  |
| `clone-repo`          | `<login>/gm-shapes`                                 | A local `shapes` clone, `origin` pointing to the learner's fork, and `upstream` pointing to `git-mastery/gm-shapes` |
| `remote-control`      | `<login>/gitmastery-<login>-remote-control`         | The URL submitted to interactive verification; the desktop verification subprocess does not relay that input        |
| `create-pr-from-main` | Open PRs by `<login>` in `git-mastery/gm-languages` | Correct committed `Java.txt` content in the version selected by the verifier                                        |

The app has an explicit target rule for each of these four exercise IDs. A downloaded exercise
is required, but a local Git repository is not: fork/clone exercises can need hints before cloning.
Other exercises, hands-on practicals and lesson chats do not collect this GitHub context.

Targets are not taken from learner messages or local remote URLs. A wrong `origin` must not move
the lookup to an unrelated repository. For the PR exercise, supplied manifest fields `repo_title`
and `pr_repo_full_name` must agree with the known course target. Missing fields use the explicit
rule; conflicting values stop the lookup. A stored `pr_number` is ignored because it may be stale.

## How the AI should interpret the result

Successful observations can support a specific diagnosis: a repository is private, it is not a
fork, its parent differs from the task source, or the selected PR uses the wrong head branch.
They cannot establish that every exercise requirement is satisfied.

Unavailable evidence must stay unknown:

| Result reported in the block      | Meaning                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `cli-missing`                     | The app could not start `gh`                                                           |
| `auth-required` / `auth-rejected` | Authentication is missing or was rejected                                              |
| `not-found-or-inaccessible`       | GitHub returned 404; the repository may be absent or inaccessible to this account      |
| `forbidden`                       | Access was refused; this does not establish repository visibility                      |
| `rate-limited`                    | GitHub asked the client to slow down                                                   |
| `timeout`                         | The process or collection deadline was reached                                         |
| `network`                         | A process/network request failed without a more specific classification                |
| `invalid-response`                | Output was malformed, oversized or missing required valid fields                       |
| `unsupported-target`              | The exercise manifest was unavailable or its target conflicted with the supported task |

In particular, **404 does not mean “private” or “not created.”** If account lookup succeeds but
the repository/PR lookup fails, the block retains the observed account and marks the rest unknown.
It does not substitute results from a previous message.

## Collection and boundaries

On each hint message, the app:

1. Checks the exercise ID, location and manifest against the supported target rules.
2. Reads the current account with `gh api user`.
3. Reads the exact task repository, or lists the account's open PRs in the fixed course repository.
4. Validates the response and builds the text block from the fields listed above.
5. Attaches the block to the AI prompt and the existing context disclosure.

The app uses the learner's normal `gh` authentication rather than adding a separate login.
It does not extract or store a token. Commands explicitly target GitHub.com, use argument arrays
without a shell, and have no interactive input. Prompts, update notifications, telemetry and debug
output are disabled for the child process. No GitHub resource or learner repository is changed,
and no verifier is run.

| Bound                           | Value                                                 |
| ------------------------------- | ----------------------------------------------------- |
| GitHub collection deadline      | 2,100 ms across account lookup and task lookup        |
| Individual subprocess timeout   | 1,500 ms, also interrupted by the collection deadline |
| Outer context-provider deadline | 2,500 ms                                              |
| Captured subprocess output      | At most 1 MiB per output stream                       |
| Final context block             | At most 8,000 characters                              |
| PR candidates                   | At most 30 returned                                   |

Cancelling a message aborts the GitHub subprocess and suppresses its late block. GitHub failures
leave the other context providers available. Separate requests are observations over a time window,
not an atomic snapshot.

Account, repository and PR facts are never cached between messages. Only a rate-limit retry time
is kept in memory: use GitHub's retry guidance when available, otherwise wait 60 seconds.
During that host-wide cooldown, subsequent messages receive `rate-limited`, not old facts.

## Implementation and source of the rules

[githubState.ts](../../src/electron/ai/context/githubState.ts) owns the four exercise rules and the
exact text sent to the AI. [githubCli.ts](../../src/electron/ai/githubCli.ts) owns the three read
operations, response validation and subprocess limits.
[context.ts](../../src/electron/ai/context.ts) registers the provider;
[prompt.ts](../../src/electron/ai/prompt.ts) tells the tutor how to use its evidence.

The rules were checked against exercise revision
[`d00473c6425b9b16e6892a58fa1acf0e3df816b1`](https://github.com/git-mastery/exercises/tree/d00473c6425b9b16e6892a58fa1acf0e3df816b1):

- [Fork verifier](https://github.com/git-mastery/exercises/blob/d00473c6425b9b16e6892a58fa1acf0e3df816b1/fork_repo/verify.py)
  and [clone verifier](https://github.com/git-mastery/exercises/blob/d00473c6425b9b16e6892a58fa1acf0e3df816b1/clone_repo/verify.py):
  check fork status and direct parent owner; clone adds local checks.
- [Remote-control verifier](https://github.com/git-mastery/exercises/blob/d00473c6425b9b16e6892a58fa1acf0e3df816b1/remote_control/verify.py):
  checks public visibility and an interactively submitted URL.
- [PR verifier](https://github.com/git-mastery/exercises/blob/d00473c6425b9b16e6892a58fa1acf0e3df816b1/create_pr_from_main/verify.py)
  and [PR selection helper](https://github.com/git-mastery/exercises/blob/d00473c6425b9b16e6892a58fa1acf0e3df816b1/exercise_utils/github_cli.py):
  select the highest returned open PR number, require head `main`, and check committed content.
  The helper uses [GitHub CLI's default limit of 30](https://cli.github.com/manual/gh_pr_list).

Review these rules when the exercises change. The small explicit table is needed because the
existing manifests do not describe every target. It avoids searching unrelated account resources
or depending on a new course-wide metadata format.

Remote file-body collection is deferred: the relationship between GitHub's head commit and the
verifier's `last_user_commit` has not been established. This is why a correct-looking PR is never
treated as proof of correct submitted content.

## Validation

The feature was validated on macOS on 6 November 2026:

- All 107 deterministic tests passed, including account changes, refreshed PR state, unknown
  outcomes, target restrictions, cancellation, output limits and prompt/context wiring.
- Both opt-in live adapter tests passed against GitHub using existing `gh` authentication.
- Main-process and test typechecks, the production build, formatting and lint passed.

Earlier read-only feasibility probes used GitHub CLI 2.97.0, Node 20.20.2 and REST API version
`2022-11-28`. They confirmed repository/fork fields, PR metadata, empty selections, HTTP 401/404,
missing authentication and process cancellation. Three account-plus-repository samples took
954–1,162 ms; these are feasibility samples, not a network reliability guarantee.

The executable checks are in
[githubContext.test.ts](../../tests/electron/ai/githubContext.test.ts),
[githubWiring.test.ts](../../tests/electron/ai/githubWiring.test.ts) and
[githubLive.test.ts](../../tests/electron/ai/githubLive.test.ts):

```sh
# Routine tests use fake GitHub responses and real isolated subprocess fixtures.
npm test

# Optional: real read-only GitHub calls; requires working gh authentication.
GIT_MASTERY_GITHUB_SMOKE=1 npm test -- tests/electron/ai/githubLive.test.ts
```

Electron UI behavior, live tutor interpretation and Windows/Linux runtime behavior remain
unvalidated for this feature. A future Electron test must mock the `gh` process boundary:
browser network mocks do not intercept subprocess traffic, and an empty `GH_CONFIG_DIR` alone
does not guarantee isolation from inherited authentication.
