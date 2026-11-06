import type { ContextProvider } from "../context.js";
import { readExerciseManifest } from "../../exerciseManifest.js";
import { createGithubCli, PR_LIMIT, PR_TARGET } from "../githubCli.js";

// Policies checked against git-mastery/exercises at
// d00473c6425b9b16e6892a58fa1acf0e3df816b1. Recheck when those verifiers change.
const POLICIES = new Map([
  ["fork-repo", "fork"],
  ["clone-repo", "fork"],
  ["remote-control", "public-repository"],
  ["create-pr-from-main", "pull-request"],
]);
const COLLECTION_TIMEOUT_MS = 2100;

export function createGithubStateProvider(
  cli = createGithubCli(),
): ContextProvider {
  return {
    id: "github-state",
    label: "GitHub state",
    async collect({ exerciseId, location, signal }) {
      const policy = POLICIES.get(exerciseId);
      if (!policy || !location || signal?.aborted) return null;
      const started = new Date().toISOString();
      const lines = [
        "Read-only GitHub.com metadata; observations are not a verification result.",
      ];
      const render = () =>
        signal?.aborted
          ? null
          : [
              `Observed between ${started} and ${new Date().toISOString()}.`,
              ...lines,
              "Use these current observations over earlier assistant guesses. Unknown is not failed; metadata alone cannot establish completion.",
            ].join("\n");
      const manifest = readExerciseManifest(location.exerciseRoot);
      if (!manifest) {
        lines.push(
          "GitHub metadata unknown: unsupported-target (manifest unavailable).",
        );
        return render();
      }
      if (policy === "pull-request") {
        const repo = manifest.exercise_repo;
        if (
          (repo.repo_title != null && repo.repo_title !== "gm-languages") ||
          (repo.pr_repo_full_name != null &&
            repo.pr_repo_full_name !== PR_TARGET)
        ) {
          lines.push(
            "GitHub metadata unknown: unsupported-target (setup target conflicts with this exercise).",
          );
          return render();
        }
        lines.push(
          "Limit: committed Java.txt content and the verifier's last_user_commit are not checked.",
        );
      } else if (exerciseId === "clone-repo") {
        lines.push(
          "Limit: local shapes clone and origin/upstream configuration must be checked using local repository evidence.",
        );
      } else if (exerciseId === "remote-control") {
        lines.push(
          "Limit: the URL submitted to interactive verification is unknown. The desktop verification subprocess does not relay that input.",
        );
      }

      const deadline = AbortSignal.timeout(COLLECTION_TIMEOUT_MS);
      const requestSignal = signal
        ? AbortSignal.any([signal, deadline])
        : deadline;
      const identity = await cli.identity(requestSignal);
      if (identity.status === "unknown") {
        lines.push(
          `GitHub account and task metadata unknown: ${identity.reason}.`,
        );
        return render();
      }
      const login = identity.value.login;
      lines.push(`Authenticated GitHub account: ${login}.`);
      if (policy === "pull-request") {
        lines.push(
          `Query: open PRs authored by ${login} in ${PR_TARGET}; limit ${PR_LIMIT}, no head/base filter.`,
        );
        const result = await cli.openPullRequests(login, requestSignal);
        if (result.status === "unknown") {
          lines.push(`Open PR metadata unknown: ${result.reason}.`);
          return render();
        }
        const prs = result.value;
        lines.push(
          prs.length === PR_LIMIT
            ? `Returned ${PR_LIMIT} candidates (limit reached; additional candidates may exist).`
            : `Returned ${prs.length} matching open PRs.`,
        );
        const selected = prs.reduce<(typeof prs)[number] | null>(
          (latest, pr) => (!latest || pr.number > latest.number ? pr : latest),
          null,
        );
        if (!selected) {
          lines.push(
            "No matching open PR returned at query time. Closed and merged PRs were not queried.",
          );
        } else {
          const headRepo =
            selected.headRepository && selected.headRepositoryOwner
              ? `${selected.headRepositoryOwner.login}/${selected.headRepository.name}`
              : "unknown (unavailable/deleted)";
          lines.push(
            `Selected candidate: #${selected.number}, highest number returned under the verifier's selection rule.`,
            `URL: https://github.com/${PR_TARGET}/pull/${selected.number}`,
            `State: ${selected.state}; draft: ${selected.isDraft}.`,
            `Head repository: ${headRepo}; head branch: ${selected.headRefName}; head commit: ${selected.headRefOid}.`,
            `Base branch: ${selected.baseRefName}.`,
            `Head branch main required by task: ${selected.headRefName === "main" ? "observed" : "not observed (wrong head branch)"}.`,
          );
        }
      } else {
        const target = `${login}/${policy === "fork" ? "gm-shapes" : `gitmastery-${login}-remote-control`}`;
        lines.push(`Expected repository: ${target}.`);
        const result = await cli.repository(target, requestSignal);
        if (result.status === "unknown") {
          lines.push(
            `Repository existence, visibility and fork metadata unknown: ${result.reason}.`,
            "A 404/not-found-or-inaccessible result does not prove a repository is absent or private.",
          );
          return render();
        }
        const repo = result.value;
        lines.push(
          `Observed repository: ${repo.full_name}; expected identity ${repo.full_name.toLowerCase() === target.toLowerCase() ? "matches" : "does not match (possibly renamed/redirected)"}.`,
          `Visibility: ${repo.visibility}; fork: ${repo.fork}.`,
        );
        if (policy === "fork") {
          lines.push(
            `Direct parent: ${repo.parent?.full_name ?? "unknown/not supplied"}.`,
            "Task source: git-mastery/gm-shapes; pinned verifier checks fork status and direct parent owner git-mastery.",
          );
        } else {
          lines.push(
            `Public visibility required by task: ${repo.visibility === "public" ? "observed" : "not observed"}.`,
          );
        }
      }
      return render();
    },
  };
}

export const githubStateProvider = createGithubStateProvider();
