import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { ContextProvider } from "../context.js";
import { getCliEnvironment } from "../../utils/cli/getters.js";

const execFileAsync = promisify(execFile);

/** No child process elsewhere in this app has a timeout. Do not copy that. */
const TIMEOUT_MS = 1500;
const MAX_BUFFER = 1024 * 1024;

/** How far below the exercise folder to look for a repository. */
const SEARCH_DEPTH = 2;
const MAX_REPOS = 3;

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

function realpath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: {
      ...getCliEnvironment(),
      // None of these commands touch the network, but a credential prompt in a
      // process with no terminal would hang rather than fail.
      GIT_TERMINAL_PROMPT: "0",
      // Second line of defence behind the containment check below: refuse to
      // discover a repository above the candidate's own directory.
      GIT_CEILING_DIRECTORIES: path.dirname(cwd),
    },
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

/**
 * Whether `dir` is itself the root of a Git repository.
 *
 * This check is load-bearing for privacy, not defensive polish. Git searches
 * upwards, so in an exercise that has no repository yet — `under-control`,
 * where running `git init` *is* the task — a bare `git status` succeeds
 * against whatever repository happens to be above the exercises folder. A
 * student whose home or coursework directory is a repository would otherwise
 * have unrelated branch names and filenames sent to a third-party model.
 */
async function isRepoRoot(dir: string): Promise<boolean> {
  let toplevel: string;
  try {
    toplevel = await runGit(dir, ["rev-parse", "--show-toplevel"]);
  } catch {
    return false;
  }
  if (!toplevel) return false;
  const resolvedTop = realpath(toplevel);
  return resolvedTop !== null && resolvedTop === realpath(dir);
}

/**
 * Folders under the exercise root that contain a `.git`, nearest first.
 * Hands-on sandboxes put the repository in a subfolder (`hp-init-repo/things`),
 * and several exercises have the student create one, so the working folder
 * alone is not enough. Symlinks are not followed.
 */
function findRepoCandidates(root: string): string[] {
  const found: string[] = [];
  let level = [root];
  for (let depth = 0; depth <= SEARCH_DEPTH && level.length > 0; depth += 1) {
    const next: string[] = [];
    for (const dir of level) {
      if (fs.existsSync(path.join(dir, ".git"))) {
        found.push(dir);
        continue;
      }
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            next.push(path.join(dir, entry.name));
          }
        }
      } catch {
        // Unreadable folder: nothing to report from it.
      }
    }
    level = next;
  }
  return found;
}

async function describeInProgress(repo: string): Promise<string | null> {
  try {
    const gitDir = await runGit(repo, ["rev-parse", "--absolute-git-dir"]);
    const active = IN_PROGRESS.filter(({ marker }) =>
      fs.existsSync(path.join(gitDir, marker)),
    ).map(({ label }) => label);
    return active.length > 0
      ? `Operation in progress: ${active.join(", ")} (paused, not yet finished or aborted)`
      : null;
  } catch {
    return null;
  }
}

async function describeRepo(repo: string, heading: string): Promise<string> {
  const [inProgress, ...sections] = await Promise.all([
    describeInProgress(repo),
    ...COMMANDS.map(async ({ label, args }) => {
      try {
        const output = await runGit(repo, args);
        return `$ ${label}\n${output || "(no output)"}`;
      } catch (err) {
        console.warn(`[ai] git-state: ${args.join(" ")} failed:`, err);
        return null;
      }
    }),
  ]);
  return [heading, inProgress, ...sections]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export const gitStateProvider: ContextProvider = {
  id: "git-state",
  label: "Repository state",
  async collect({ location }) {
    if (!location) return null;
    const display = (target: string) =>
      path.relative(path.dirname(location.exercisesRoot), target) || ".";

    const candidates = [
      location.cwd,
      ...findRepoCandidates(location.exerciseRoot).filter(
        (dir) => dir !== location.cwd,
      ),
    ];
    const verified = await Promise.all(
      candidates.map(async (dir) => ((await isRepoRoot(dir)) ? dir : null)),
    );
    const repos = verified
      .filter((dir): dir is string => dir !== null)
      .slice(0, MAX_REPOS);

    if (repos.length === 0) {
      return `No Git repository exists in the exercise folder yet: neither the working folder (${display(location.cwd)}) nor any folder below ${display(location.exerciseRoot)} contains a .git directory.`;
    }

    const described = await Promise.all(
      repos.map((repo) =>
        describeRepo(repo, `### Repository at ${display(repo)}`),
      ),
    );
    return described.join("\n\n");
  },
};
