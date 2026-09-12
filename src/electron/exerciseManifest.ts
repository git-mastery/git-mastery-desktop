import fs from "fs";
import path from "path";

/**
 * The per-exercise manifest the GitMastery CLI writes at download time, as
 * `<exerciseRoot>/.gitmastery-exercise.json`. Only the fields the app reads are
 * typed; the CLI writes more.
 */
export type ExerciseManifest = {
  exercise_name: string;
  tags?: string[];
  requires_git?: boolean;
  requires_github?: boolean;
  base_files?: { [resource: string]: string };
  exercise_repo: {
    // "ignore" means the CLI creates no repo folder and the learner works at
    // the exercise root. `repo_name` is a placeholder in that case.
    repo_type: "local" | "local-ignore" | "remote" | "ignore";
    repo_name: string;
    repo_title?: string | null;
    init?: boolean | null;
  };
  downloaded_at?: number;
};

export const EXERCISE_MANIFEST_NAME = ".gitmastery-exercise.json";

/**
 * Hands-on practices are set up by a download script rather than a manifest, so
 * there is nothing to read and the learner works at the exercise root.
 */
export const HANDS_ON_PREFIX = "hp-";

/**
 * `repo_name` and the exercise identifier are joined onto a parent path, so
 * they have to stay a single path segment. Absolute paths and backslashes are
 * rejected as well: `path.basename` does not treat `\` as a separator on POSIX,
 * so `C:\foo` would otherwise pass on macOS.
 */
export const isPathSegment = (name: string) =>
  name !== "." &&
  name !== ".." &&
  !path.isAbsolute(name) &&
  !name.includes("\\") &&
  path.basename(name) === name;

const isDirectory = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Where the learner should work for a given exercise, or why we cannot say.
 *
 * `corrupt` and `incomplete` are deliberately distinct from `not-downloaded`:
 * they mean a folder exists but is not a usable exercise, so re-downloading
 * over it would destroy whatever is in there.
 */
export type ExerciseCwdResult =
  | { state: "ready"; cwd: string }
  | { state: "not-downloaded" }
  | { state: "corrupt"; exerciseRoot: string }
  | { state: "incomplete"; exerciseRoot: string };

/**
 * Reads an exercise's manifest. Never throws: a missing, unreadable or
 * malformed manifest is reported as null so callers can treat it as "this is
 * not a usable exercise folder" rather than crashing the IPC handler.
 */
export function readExerciseManifest(
  exerciseRoot: string,
): ExerciseManifest | null {
  try {
    const raw = fs.readFileSync(
      path.join(exerciseRoot, EXERCISE_MANIFEST_NAME),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as ExerciseManifest;
    if (!parsed?.exercise_repo?.repo_type || !parsed.exercise_repo.repo_name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolves the directory the learner should work in for a downloaded exercise.
 *
 * This mirrors how the CLI itself computes the `cd` hint it prints after a
 * download (`app/commands/download.py`): everything except `repo_type:
 * "ignore"` puts the work in a `repo_name` subfolder. Reading the manifest is
 * exact, where inspecting the folder's shape can only guess — an exercise whose
 * whole point is running `git init` has no `.git` to find, and a folder the
 * learner created themselves is indistinguishable from the real one.
 *
 * The CLI writes the manifest before it creates or clones the repo folder, so a
 * download that failed midway leaves a manifest pointing at a folder that does
 * not exist. That is `incomplete`, and it must not be silently downloaded over.
 */
export function resolveExerciseCwd(exerciseRoot: string): ExerciseCwdResult {
  if (!fs.existsSync(exerciseRoot)) return { state: "not-downloaded" };
  if (!isDirectory(exerciseRoot)) return { state: "corrupt", exerciseRoot };

  if (path.basename(exerciseRoot).startsWith(HANDS_ON_PREFIX)) {
    // Hands-on practices have no manifest, so an empty leftover from a failed
    // download is indistinguishable from a successful one except by contents.
    if (fs.readdirSync(exerciseRoot).length === 0) {
      return { state: "incomplete", exerciseRoot };
    }
    return { state: "ready", cwd: exerciseRoot };
  }

  const manifest = readExerciseManifest(exerciseRoot);
  if (!manifest) return { state: "corrupt", exerciseRoot };

  const { repo_type, repo_name } = manifest.exercise_repo;
  if (repo_type === "ignore") return { state: "ready", cwd: exerciseRoot };
  if (!isPathSegment(repo_name)) return { state: "corrupt", exerciseRoot };

  const cwd = path.join(exerciseRoot, repo_name);
  if (!fs.existsSync(cwd)) return { state: "incomplete", exerciseRoot };
  if (!isDirectory(cwd)) return { state: "corrupt", exerciseRoot };

  return { state: "ready", cwd };
}
