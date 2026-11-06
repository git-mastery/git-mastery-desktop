# GitHub context for AI hints

Every exercise and hands-on chat uses the same GitHub collection logic. On each message,
the app reads available metadata through the learner's existing GitHub CLI (`gh`) login
and sends it in a **GitHub state** block alongside the other [AI context](ai-context-providers.md).
There are no rules tied to individual exercise names.

The block contains:

1. **Observation times:** when collection starts and finishes, from the app's clock.
2. **Signed-in GitHub username:** the `login` returned by `gh api user`. This is the
   account used for the queries, which may differ from the repository owner or Git commit author.
3. **Queried repositories and their sources:** GitHub `owner/name` identities extracted
   from local fetch/push remotes (`git remote -v`) and the exercise manifest's
   `exercise_repo.pr_repo_full_name`, when present. The block identifies the local
   folder, remote name and fetch/push direction, or the manifest field that supplied
   each target. Repeated identities are queried once.
4. **Repository identity, visibility, fork flag and direct parent:** `full_name`,
   `visibility` (`public`, `private` or `internal`), `fork`, and `parent.full_name`
   returned by `gh api repos/<owner>/<name>`. The observed identity may differ from the
   queried identity after a rename. A missing parent is reported as unknown.
5. **Open pull requests authored by the signed-in account in each queried repository:**
   obtained with `gh pr list --repo <owner/name> --author <login> --state open`.
   The block includes the number returned and, for each PR, its number, URL, open state,
   draft flag, head repository, head branch, head commit ID and base branch.
   These come from `number`, `state`, `isDraft`, `headRepository`,
   `headRepositoryOwner`, `headRefName`, `headRefOid` and `baseRefName`;
   the URL is constructed from the queried repository and PR number.
6. **Unknowns and collection limits:** the app reports failed lookups, missing targets
   and missing fields explicitly. Local discovery inspects at most three repositories,
   two directory levels below the exercise root, 200 directories and 12 candidates.
   GitHub queries cover at most three distinct targets and 30 open PRs per target.
   The block is capped at 8,000 characters; truncation and reached limits are marked.

Only repositories discovered within the exercise's local boundary or named by its manifest
are queried. No target is guessed from the exercise name. If there is no discoverable
target, repository and PR metadata are unknown; the account lookup still runs.
Lesson chats do not collect workspace context.

Collection is read-only, uses a 2.1-second deadline, and refreshes on each message.
Tokens, raw API responses, PR titles/bodies/comments, remote file contents, closed or merged
PRs, and interactive verification input are not sent. Failed lookups mean unknown;
a 404 can mean absent or inaccessible. These observations are not an exercise pass/fail result.
