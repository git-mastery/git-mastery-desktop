# GitHub context for AI hints

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
