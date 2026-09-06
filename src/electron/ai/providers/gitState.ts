import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { ContextProvider } from "../context.js";
import { isPathSegment, resolveExerciseCwd } from "../../exerciseManifest.js";
import {
  getCliEnvironment,
  getExerciseDirectory,
} from "../../utils/cli/getters.js";

const execFileAsync = promisify(execFile);

/** No child process elsewhere in this app has a timeout. Do not copy that. */
const TIMEOUT_MS = 1200;
const MAX_BUFFER = 1024 * 1024;

/**
 * Read-only inspections, run only once the repository has been confirmed to be
 * the exercise's own. `--graph` is deliberately absent: the ASCII art is noise
 * to a small model, and `--decorate --all` plus `branch -vv` carries the same
 * topology more legibly.
 */
const COMMANDS: { label: string; args: string[] }[] = [
  {
    // Porcelain rather than plain `git status`, whose hint lines advertise
    // commands ("use git restore --staged ...") the student may not have been
    // taught yet — exactly what the course-position block exists to prevent.
    label:
      "git status (column 1 = staged, column 2 = working tree; ?? = untracked, ## = branch line)",
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
];

/**
 * The exercise's own working directory, mirroring `resolveReadyExerciseCwd` in
 * ipc/gitmastery.ts. The pty's tracked cwd is not used: it is regex-guessed
 * from typed `cd` commands and drifts on pushd, `cd -`, subshells and chained
 * commands, so it can point somewhere else entirely by the time a hint is asked
 * for.
 */
function resolveCwd(exerciseId: string): string | null {
  if (!isPathSegment(exerciseId)) return null;
  try {
    const resolved = resolveExerciseCwd(
      path.join(getExerciseDirectory(), exerciseId),
    );
    return resolved.state === "ready" ? resolved.cwd : null;
  } catch {
    // No configured exercise folder yet. Not an error worth reporting per send.
    return null;
  }
}

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
      // discover a repository above the exercise's own directory.
      GIT_CEILING_DIRECTORIES: path.dirname(cwd),
    },
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

/**
 * Whether `cwd` is itself the root of a Git repository.
 *
 * This check is load-bearing for privacy, not defensive polish. Git searches
 * upwards, so in an exercise that has no repository yet — `under-control`,
 * where running `git init` *is* the task, and every `repo_type: "ignore"`
 * exercise — a bare `git status` succeeds against whatever repository happens
 * to be above the exercises folder. A student whose home or coursework
 * directory is a repository would otherwise have unrelated branch names and
 * filenames sent to a third-party model.
 *
 * Returning false is also the honest, useful answer for those exercises: the
 * student has not initialised a repository yet, and the model should know that.
 */
async function isExerciseRepoRoot(cwd: string): Promise<boolean> {
  let toplevel: string;
  try {
    toplevel = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    return false;
  }
  if (!toplevel) return false;

  const resolvedTop = realpath(toplevel);
  const resolvedCwd = realpath(cwd);
  return resolvedTop !== null && resolvedTop === resolvedCwd;
}

export const gitStateProvider: ContextProvider = {
  id: "git-state",
  label: "Repository state",
  async collect({ exerciseId }) {
    const cwd = resolveCwd(exerciseId);
    if (!cwd) return null;

    if (!(await isExerciseRepoRoot(cwd))) {
      return "The exercise folder is not a Git repository yet - it contains no .git directory.";
    }

    const sections = await Promise.all(
      COMMANDS.map(async ({ label, args }) => {
        try {
          const output = await runGit(cwd, args);
          return `$ ${label}\n${output || "(no output)"}`;
        } catch (err) {
          console.warn(`[ai] git-state: ${args.join(" ")} failed:`, err);
          return null;
        }
      }),
    );

    const collected = sections.filter((s): s is string => s !== null);
    return collected.length > 0 ? collected.join("\n\n") : null;
  },
};
