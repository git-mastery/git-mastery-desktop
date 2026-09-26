import fs from "fs";
import path from "path";
import type { ContextProvider } from "../context.js";
import { kindOf } from "../session.js";
import { readExerciseManifest } from "../../exerciseManifest.js";
import { getExerciseProgress } from "../../exerciseProgress.js";

const MAX_DEPTH = 3;
const MAX_ENTRIES = 80;

const PROGRESS_LABEL: Record<ProgressState, string> = {
  downloaded: "downloaded, not verified yet",
  "in-progress": "verified before, has not passed yet",
  completed: "completed (verify passed)",
};

/**
 * Names only, never contents. Symlinks are listed but not followed, so the
 * walk cannot leave the exercise folder.
 */
function listTree(root: string): string[] {
  const lines: string[] = [];
  let truncated = false;

  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) =>
      a.isDirectory() === b.isDirectory()
        ? a.name.localeCompare(b.name)
        : a.isDirectory()
          ? -1
          : 1,
    );
    for (const entry of entries) {
      if (lines.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      const indent = "  ".repeat(depth);
      if (entry.name === ".git") {
        lines.push(`${indent}.git/ (Git repository data, not listed)`);
        continue;
      }
      if (entry.isDirectory()) {
        lines.push(`${indent}${entry.name}/`);
        if (depth + 1 < MAX_DEPTH) walk(path.join(dir, entry.name), depth + 1);
      } else {
        lines.push(`${indent}${entry.name}`);
      }
    }
  };

  walk(root, 0);
  if (lines.length === 0) lines.push("(empty)");
  if (truncated) lines.push(`… (listing stopped at ${MAX_ENTRIES} entries)`);
  return lines;
}

export const exerciseFolderProvider: ContextProvider = {
  id: "exercise-folder",
  label: "Exercise folder",
  async collect({ exerciseId, location }) {
    if (!location) return null;
    // Relative to the folder above `gitmastery-exercises`, so no home
    // directory or username is sent.
    const display = (target: string) =>
      path.relative(path.dirname(location.exercisesRoot), target) || ".";

    const lines: string[] = [];
    if (kindOf(exerciseId) === "hands-on") {
      lines.push(`Hands-on practical: ${exerciseId}`);
    } else {
      lines.push(`Exercise: ${exerciseId}`);
      const status = getExerciseProgress()[exerciseId]?.status;
      if (status) lines.push(`Progress: ${PROGRESS_LABEL[status]}`);

      const manifest = readExerciseManifest(location.exerciseRoot);
      if (manifest) {
        const repo = manifest.exercise_repo;
        lines.push(
          `Repository setup: ${repo.repo_type}${repo.repo_type === "ignore" ? " (no repository is provided)" : `, folder "${repo.repo_name}"`}`,
        );
        if (manifest.requires_github) lines.push("Requires GitHub: yes");
        if (manifest.tags?.length) {
          lines.push(`Topics: ${manifest.tags.join(", ")}`);
        }
      }
    }
    lines.push(`Working folder (Start cds here): ${display(location.cwd)}`);
    lines.push("");
    lines.push("Files (names only):");
    lines.push(`${display(location.exerciseRoot)}/`);
    lines.push(...listTree(location.exerciseRoot).map((line) => `  ${line}`));
    return lines.join("\n");
  },
};
