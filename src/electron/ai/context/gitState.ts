import fs from "fs";
import path from "path";
import type { ContextBlock, ContextProvider } from "../context.js";
import { formatDerivedFacts } from "./gitDerivedFacts.js";
import { collectGitEvidence } from "./gitEvidence.js";
import { GitReader, realpath } from "./gitReader.js";
import {
  discoverRepositories,
  exerciseBoundary,
  REPOSITORY_SEARCH_SCOPE,
} from "./repositoryDiscovery.js";

const IN_PROGRESS = [
  { marker: "MERGE_HEAD", label: "a merge" },
  { marker: "rebase-merge", label: "a rebase" },
  { marker: "rebase-apply", label: "a rebase or am" },
  { marker: "CHERRY_PICK_HEAD", label: "a cherry-pick" },
  { marker: "REVERT_HEAD", label: "a revert" },
  { marker: "BISECT_LOG", label: "a bisect" },
];

async function describeState(
  git: GitReader,
  repo: string,
  gitDir: string,
  cwd: string,
  display: (target: string) => string,
): Promise<string> {
  const [status, subject, remoteNames, incoming] = await Promise.all([
    git.read(repo, ["status", "--porcelain=v1", "-b"]),
    git.read(repo, ["log", "-1", "--format=%s"]),
    git.read(repo, ["remote"]),
    fs.existsSync(path.join(gitDir, "MERGE_HEAD"))
      ? git.read(repo, [
          "name-rev",
          "--name-only",
          "--no-undefined",
          "MERGE_HEAD",
        ])
      : null,
  ]);
  const facts = formatDerivedFacts({
    repoDisplay: display(repo),
    cwdDisplay: display(cwd),
    repoAbs: repo,
    cwdAbs: cwd,
    status,
    headSubject: subject,
    configuredRemotes:
      remoteNames === null ? null : remoteNames.split("\n").filter(Boolean),
    inProgress: IN_PROGRESS.filter(({ marker }) =>
      fs.existsSync(path.join(gitDir, marker)),
    ).map(({ label }) => label),
    mergeIncoming:
      incoming?.replace(/[~^].*$/, "").replace(/^remotes\/[^/]+\//, "") ?? null,
  });
  const files = status
    ?.split(/\r?\n/)
    .filter((row) => row.length >= 3 && !row.startsWith("## "));
  const parts = [facts];
  if (fs.existsSync(path.join(gitDir, "SQUASH_MSG"))) {
    parts.push(
      "Squash preparation marker SQUASH_MSG: present (may remain after a commit; not proof of completion)",
    );
  }
  if (status === null) {
    parts.push("git status --porcelain=v1 -b: unknown (command unavailable)");
  } else if (files && files.length > 0) {
    parts.push(
      "git status --porcelain=v1 -b (column 1 staged, column 2 worktree; ?? untracked, UU conflict):",
      status,
    );
  }
  return parts.join("\n");
}

export const gitStateProvider: ContextProvider = {
  id: "git-state",
  label: "Repository state",
  async collect({ location, signal }) {
    if (!location) return null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    // Leave time for partial results to settle before the outer 2500ms limit.
    const timer = setTimeout(abort, 2100);
    const git = new GitReader(controller.signal);
    const started = new Date().toISOString();
    try {
      const root = exerciseBoundary(location);
      const exercisesRoot = realpath(location.exercisesRoot);
      const cwd = realpath(location.cwd);
      if (!root || !exercisesRoot || !cwd) {
        return "Repository evidence unavailable: exercise/working folder could not be resolved within the exercise boundary.";
      }
      const display = (target: string) =>
        path.relative(path.dirname(exercisesRoot), target) || ".";
      const repos = await discoverRepositories(location, (repo, args) =>
        git.read(repo, args),
      );
      if (!repos.length) {
        return `No inspectable repository found within the exercise search limits (or Git unavailable).\n${REPOSITORY_SEARCH_SCOPE}`;
      }
      const blocks = await Promise.all(
        repos.map(async ({ repo, gitDir }, index) => {
          const [state, evidence] = await Promise.all([
            describeState(git, repo, gitDir, cwd, display),
            collectGitEvidence(git, repo, root),
          ]);
          const parts = [
            { id: "git-state", label: "Repository state", text: state },
            ...evidence,
          ];
          const heading = `Repository: ${display(repo)}\nObservation window: ${started} – ${new Date().toISOString()} (not atomic)\n${REPOSITORY_SEARCH_SCOPE}\n\n`;
          return parts.map((part, partIndex): ContextBlock => ({
            id: `${part.id}-${index}`,
            label: `${part.label} · ${display(repo)}`,
            text: partIndex === 0 ? `${heading}${part.text}` : part.text,
          }));
        }),
      );
      return blocks.flat();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  },
};
