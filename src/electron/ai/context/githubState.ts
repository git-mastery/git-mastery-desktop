import path from "node:path";
import type { ContextProvider } from "../context.js";
import { readExerciseManifest } from "../../exerciseManifest.js";
import { createGithubCli, PR_LIMIT } from "../githubCli.js";
import { runGit } from "./gitCommand.js";
import {
  discoverRepositories,
  exerciseBoundary,
  REPOSITORY_SEARCH_SCOPE,
} from "./repositoryDiscovery.js";

const MAX_TARGETS = 3;
const MAX_CONTEXT_CHARS = 8000;
const COLLECTION_TIMEOUT_MS = 2100;

/** Only repository identity is retained, never credentials or a raw remote URL. */
export function githubTarget(value: string): string | null {
  const match =
    /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^/?#\s]+\/[^/?#\s]+)\/?$/i.exec(
      value,
    );
  const target = match?.[1].replace(/\.git$/i, "");
  return target &&
    /^[a-z\d]+(?:-[a-z\d]+)*\/[\w.-]{1,100}$/i.test(target) &&
    ![".", ".."].includes(target.split("/")[1])
    ? target
    : null;
}

export function createGithubStateProvider(
  cli = createGithubCli(),
): ContextProvider {
  return {
    id: "github-state",
    label: "GitHub state",
    async collect({ location, signal }) {
      if (!location || signal?.aborted) return null;
      const root = exerciseBoundary(location);
      if (!root)
        return "GitHub metadata unknown: exercise folder could not be resolved within the exercise boundary.";
      const started = new Date().toISOString();
      const deadline = AbortSignal.timeout(COLLECTION_TIMEOUT_MS);
      const requestSignal = signal
        ? AbortSignal.any([signal, deadline])
        : deadline;
      const lines = [
        "Read-only GitHub.com metadata; observations are not a verification result.",
        REPOSITORY_SEARCH_SCOPE,
        `At most ${MAX_TARGETS} distinct targets and ${PR_LIMIT} open PRs per target; closed and merged PRs are not queried.`,
      ];
      const targets = new Map<string, { name: string; sources: Set<string> }>();
      const addTarget = (name: string | null, source: string) => {
        if (!name) return;
        const key = name.toLowerCase();
        const entry = targets.get(key) ?? { name, sources: new Set<string>() };
        entry.sources.add(source);
        targets.set(key, entry);
      };
      const manifestTarget =
        readExerciseManifest(root)?.exercise_repo.pr_repo_full_name;
      if (typeof manifestTarget === "string")
        addTarget(
          githubTarget(`https://github.com/${manifestTarget}`),
          "exercise manifest pr_repo_full_name",
        );
      const [identity, repos] = await Promise.all([
        cli.identity(requestSignal),
        discoverRepositories(location, (repo, args) =>
          runGit(repo, args, requestSignal).catch(() => null),
        ),
      ]);
      await Promise.all(
        repos.map(async ({ repo }) => {
          try {
            const remotes = await runGit(repo, ["remote", "-v"], requestSignal);
            for (const line of remotes.split("\n")) {
              const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line);
              if (match)
                addTarget(
                  githubTarget(match[2]),
                  `${JSON.stringify(path.relative(root, repo) || ".")} remote ${JSON.stringify(match[1])} (${match[3]})`,
                );
            }
          } catch {
            lines.push(
              "Remote target discovery unknown: Git unavailable or timed out.",
            );
          }
        }),
      );
      lines.push(
        identity.status === "ok"
          ? `Authenticated GitHub account: ${identity.value.login}.`
          : `Authenticated GitHub account unknown: ${identity.reason}.`,
      );
      if (targets.size > MAX_TARGETS)
        lines.push(
          "Target limit reached; additional discovered targets were not queried.",
        );
      if (!targets.size)
        lines.push(
          "No GitHub repository target discovered from the manifest or inspectable remotes; repository and PR metadata are unknown.",
        );
      const results = await Promise.all(
        [...targets.values()]
          .slice(0, MAX_TARGETS)
          .map(async ({ name, sources }) => {
            const [repository, prs] = await Promise.all([
              cli.repository(name, requestSignal),
              identity.status === "ok"
                ? cli.openPullRequests(
                    name,
                    identity.value.login,
                    requestSignal,
                  )
                : null,
            ]);
            const result = [
              `Queried repository: ${name}; source: ${[...sources].join("; ")}.`,
            ];
            if (repository.status === "ok") {
              const repo = repository.value;
              result.push(
                `Observed repository: ${repo.full_name}.`,
                `Visibility: ${repo.visibility}; fork: ${repo.fork}.`,
                `Direct parent: ${repo.parent?.full_name ?? "unknown/not supplied"}.`,
              );
            } else {
              result.push(`Repository metadata unknown: ${repository.reason}.`);
            }
            if (!prs || prs.status === "unknown") {
              result.push(
                `Open PR metadata unknown: ${prs?.reason ?? "authenticated account unavailable"}.`,
              );
            } else {
              result.push(
                `Open PRs authored by ${identity.status === "ok" ? identity.value.login : "unknown"} in ${name}: ${prs.value.length} returned${prs.value.length === PR_LIMIT ? " (limit reached; additional PRs may exist)" : ""}.`,
              );
              for (const pr of prs.value) {
                const head =
                  pr.headRepository && pr.headRepositoryOwner
                    ? `${pr.headRepositoryOwner.login}/${pr.headRepository.name}`
                    : "unknown (unavailable/deleted)";
                result.push(
                  `PR #${pr.number}: https://github.com/${name}/pull/${pr.number}; state: ${pr.state}; draft: ${pr.isDraft}; head repository: ${head}; head branch: ${JSON.stringify(pr.headRefName)}; head commit: ${pr.headRefOid}; base branch: ${JSON.stringify(pr.baseRefName)}.`,
                );
              }
            }
            return result.join("\n");
          }),
      );
      if (signal?.aborted) return null;
      const text = [
        `Observed between ${started} and ${new Date().toISOString()} (not atomic).`,
        ...lines,
        ...results,
        "Use current observations over earlier guesses. Unknown is not failed; a 404 can mean absent or inaccessible. Metadata alone does not establish exercise completion or file correctness.",
      ].join("\n");
      const suffix = "\n[Truncated: remaining GitHub metadata is unknown.]";
      return text.length > MAX_CONTEXT_CHARS
        ? text.slice(0, MAX_CONTEXT_CHARS - suffix.length) + suffix
        : text;
    },
  };
}

export const githubStateProvider = createGithubStateProvider();
