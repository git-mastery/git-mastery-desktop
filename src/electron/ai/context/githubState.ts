import type { ContextProvider } from "../context.js";
import { readExerciseManifest } from "../../exerciseManifest.js";
import { createGithubCli, PR_LIMIT } from "../githubCli.js";
import { runGit } from "./gitCommand.js";
import {
  discoverRepositories,
  exerciseBoundary,
} from "./repositoryDiscovery.js";

const MAX_TARGETS = 3;
const MAX_CONTEXT_CHARS = 2000;
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
      if (!root) return "GitHub: unknown (exercise boundary unavailable).";
      const deadline = AbortSignal.timeout(COLLECTION_TIMEOUT_MS);
      const requestSignal = signal
        ? AbortSignal.any([signal, deadline])
        : deadline;
      const lines: string[] = [];
      const targets = new Map<string, string>();
      const addTarget = (name: string | null) => {
        if (!name) return;
        targets.set(name.toLowerCase(), name);
      };
      const manifestTarget =
        readExerciseManifest(root)?.exercise_repo.pr_repo_full_name;
      if (typeof manifestTarget === "string")
        addTarget(githubTarget(`https://github.com/${manifestTarget}`));
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
              if (match) addTarget(githubTarget(match[2]));
            }
          } catch {
            lines.push("Remotes: unknown.");
          }
        }),
      );
      lines.push(
        identity.status === "ok"
          ? `Account: ${identity.value.login}`
          : `Account: unknown (${identity.reason})`,
      );
      if (targets.size > MAX_TARGETS)
        lines.push("Additional repositories omitted.");
      if (!targets.size)
        lines.push("Repositories: unknown (no GitHub target).");
      const results = await Promise.all(
        [...targets.values()].slice(0, MAX_TARGETS).map(async (name) => {
          const [repository, prs] = await Promise.all([
            cli.repository(name, requestSignal),
            identity.status === "ok"
              ? cli.openPullRequests(name, identity.value.login, requestSignal)
              : null,
          ]);
          const result: string[] = [];
          if (repository.status === "ok") {
            const repo = repository.value;
            result.push(
              `Repo ${name}${repo.full_name.toLowerCase() === name.toLowerCase() ? "" : ` → ${repo.full_name}`}: ${repo.visibility}; fork: ${repo.fork}${repo.fork ? `; parent: ${repo.parent?.full_name ?? "unknown"}` : ""}`,
            );
          } else {
            result.push(`Repo ${name}: unknown (${repository.reason})`);
          }
          if (!prs || prs.status === "unknown") {
            result.push(
              `Open PRs: unknown (${prs?.reason ?? "account unavailable"})`,
            );
          } else {
            result.push(
              `Open PRs by account:${prs.value.length ? "" : " none"}${prs.value.length === PR_LIMIT ? " (limit reached; others unknown)" : ""}`,
            );
            for (const pr of prs.value) {
              const head =
                pr.headRepository && pr.headRepositoryOwner
                  ? `${pr.headRepositoryOwner.login}/${pr.headRepository.name}`
                  : "unknown";
              result.push(
                `PR #${pr.number}${pr.isDraft ? " (draft)" : ""}: ${head}:${JSON.stringify(pr.headRefName)} → ${JSON.stringify(pr.baseRefName)}`,
              );
            }
          }
          return result.join("\n");
        }),
      );
      if (signal?.aborted) return null;
      const text = [...lines, ...results].join("\n");
      const suffix = "\n[Truncated; remaining data unknown.]";
      return text.length > MAX_CONTEXT_CHARS
        ? text.slice(0, MAX_CONTEXT_CHARS - suffix.length) + suffix
        : text;
    },
  };
}

export const githubStateProvider = createGithubStateProvider();
