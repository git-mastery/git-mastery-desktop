import fs from "fs";
import path from "path";
import type { ContextProvider } from "../context.js";
import { formatDerivedFacts } from "./gitDerivedFacts.js";
import { runGit } from "./gitCommand.js";
import {
  discoverRepositories,
  REPOSITORY_SEARCH_SCOPE,
} from "./repositoryDiscovery.js";

/**
 * Read-only inspections, run only once a repository has been confirmed to be
 * its own root inside the exercise folder. `--graph` is deliberately absent:
 * the ASCII art is noise to a small model, and `--decorate --all` plus
 * `branch -vv` carries the same topology more legibly.
 */
const COMMANDS: { label: string; args: string[] }[] = [
  {
    // Porcelain rather than plain `git status`, whose hint lines advertise
    // commands ("use git restore --staged ...") the student may not have been
    // taught yet.
    label:
      "git status (column 1 = staged, column 2 = working tree; ?? = untracked, UU = conflict, ## = branch line)",
    // --no-optional-locks: this runs on every message send, which is precisely
    // when the student may be part-way through their own `git add`. Without it
    // `status` refreshes and rewrites the index and can race index.lock.
    args: ["--no-optional-locks", "status", "--porcelain=v1", "-b"],
  },
  {
    label: "git log",
    args: ["log", "--oneline", "--decorate", "--all", "-n", "15"],
  },
  { label: "git branch -vv", args: ["branch", "-vv"] },
  { label: "git remote -v", args: ["remote", "-v"] },
  { label: "git tag", args: ["tag", "--list"] },
  { label: "git stash list", args: ["stash", "list"] },
];

/** Marker files Git leaves in the git dir while an operation is paused. */
const IN_PROGRESS: { marker: string; label: string }[] = [
  { marker: "MERGE_HEAD", label: "a merge" },
  { marker: "rebase-merge", label: "a rebase" },
  { marker: "rebase-apply", label: "a rebase or am" },
  { marker: "CHERRY_PICK_HEAD", label: "a cherry-pick" },
  { marker: "REVERT_HEAD", label: "a revert" },
  { marker: "BISECT_LOG", label: "a bisect" },
];

async function gitDirOf(repo: string): Promise<string | null> {
  try {
    return await runGit(repo, ["rev-parse", "--absolute-git-dir"]);
  } catch {
    return null;
  }
}

function inProgressLabels(gitDir: string | null): string[] {
  if (!gitDir) return [];
  return IN_PROGRESS.filter(({ marker }) =>
    fs.existsSync(path.join(gitDir, marker)),
  ).map(({ label }) => label);
}

/** Name the commit MERGE_HEAD points at, if Git can. */
async function mergeIncomingName(
  repo: string,
  gitDir: string | null,
): Promise<string | null> {
  if (!gitDir || !fs.existsSync(path.join(gitDir, "MERGE_HEAD"))) return null;
  try {
    const named = await runGit(repo, [
      "name-rev",
      "--name-only",
      "--no-undefined",
      "MERGE_HEAD",
    ]);
    const ref = named
      .replace(/[~^].*$/, "")
      .replace(/^remotes\/[^/]+\//, "")
      .trim();
    return ref || null;
  } catch {
    return null;
  }
}

async function headSubject(repo: string): Promise<string | null> {
  try {
    const subject = await runGit(repo, ["log", "-1", "--format=%s"]);
    return subject || null;
  } catch {
    return null;
  }
}

async function describeRepo(
  repo: string,
  heading: string,
  cwd: string,
  display: (target: string) => string,
): Promise<string> {
  const [gitDir, subject, commandParts] = await Promise.all([
    gitDirOf(repo),
    headSubject(repo),
    Promise.all(
      COMMANDS.map(async ({ label, args }) => {
        try {
          const output = await runGit(repo, args);
          return { label, output: output || "" };
        } catch (err) {
          console.warn(`[ai] git-state: ${args.join(" ")} failed:`, err);
          return { label, output: null as string | null };
        }
      }),
    ),
  ]);
  const incoming = await mergeIncomingName(repo, gitDir);
  const status =
    commandParts.find((part) => part.label.startsWith("git status"))?.output ??
    null;
  const facts = formatDerivedFacts({
    repoDisplay: display(repo),
    cwdDisplay: display(cwd),
    repoAbs: repo,
    cwdAbs: cwd,
    status,
    headSubject: subject,
    inProgress: inProgressLabels(gitDir),
    mergeIncoming: incoming,
  });
  const sections = commandParts.map(({ label, output }) =>
    output === null ? null : `$ ${label}\n${output || "(no output)"}`,
  );
  return [heading, facts, ...sections]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export const gitStateProvider: ContextProvider = {
  id: "git-state",
  label: "Repository state",
  async collect({ location, signal }) {
    if (!location) return null;
    const display = (target: string) =>
      path.relative(path.dirname(location.exercisesRoot), target) || ".";

    const repos = await discoverRepositories(location, (repo, args) =>
      runGit(repo, args, signal).catch(() => null),
    );

    if (repos.length === 0) {
      return [
        "Derived facts (read these first):",
        `- Working folder: ${display(location.cwd)}`,
        `- Repository: no inspectable repository found under ${display(location.exerciseRoot)}`,
        "",
        REPOSITORY_SEARCH_SCOPE,
      ].join("\n");
    }

    const described = await Promise.all(
      repos.map(({ repo }) =>
        describeRepo(
          repo,
          `### Repository at ${display(repo)}`,
          location.cwd,
          display,
        ),
      ),
    );
    return described.join("\n\n");
  },
};
