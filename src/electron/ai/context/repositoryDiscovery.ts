import fs from "node:fs";
import path from "node:path";
import type { ExerciseLocation } from "../availability.js";

const MAX_DIRECTORIES = 200;
const MAX_CANDIDATES = 12;
const MAX_REPOSITORIES = 3;
const SEARCH_DEPTH = 2;

export const REPOSITORY_SEARCH_SCOPE =
  "Repository search: depth 2, at most 200 directories, 12 candidates and 3 repositories; hidden directories, nested repositories and external Git storage are excluded. Uninspected evidence is unknown.";

export function realpath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

export function contained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`)
  );
}

export function exerciseBoundary(location: ExerciseLocation): string | null {
  const root = realpath(location.exerciseRoot);
  const parent = realpath(location.exercisesRoot);
  const cwd = realpath(location.cwd);
  return root &&
    parent &&
    cwd &&
    root !== parent &&
    contained(parent, root) &&
    contained(root, cwd)
    ? root
    : null;
}

type ReadGit = (cwd: string, args: string[]) => Promise<string | null>;

/** Shared by local and GitHub context: never let Git discover a parent repository. */
export async function discoverRepositories(
  location: ExerciseLocation,
  read: ReadGit,
) {
  const root = exerciseBoundary(location);
  if (!root) return [];
  const candidates = new Set<string>([location.cwd]);
  let level = [root];
  let visited = 0;
  for (
    let depth = 0;
    depth <= SEARCH_DEPTH &&
    visited < MAX_DIRECTORIES &&
    candidates.size < MAX_CANDIDATES;
    depth++
  ) {
    const next: string[] = [];
    for (const dir of level) {
      if (++visited > MAX_DIRECTORIES || candidates.size >= MAX_CANDIDATES)
        break;
      if (fs.existsSync(path.join(dir, ".git"))) {
        candidates.add(dir);
        continue;
      }
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            next.length < MAX_DIRECTORIES
          )
            next.push(path.join(dir, entry.name));
        }
      } catch {
        // Unreadable paths supply no evidence.
      }
    }
    level = next;
  }
  const checked = await Promise.all(
    [...candidates].map(async (candidate) => {
      const repo = realpath(candidate);
      if (!repo || !contained(root, repo)) return null;
      try {
        const dotGit = path.join(repo, ".git");
        const stat = fs.statSync(dotGit);
        let gitDir: string | null;
        if (stat.isDirectory()) gitDir = realpath(dotGit);
        else {
          if (!stat.isFile() || stat.size > 4096) return null;
          const pointer = fs.readFileSync(dotGit, "utf8").trim();
          gitDir = pointer.startsWith("gitdir: ")
            ? realpath(path.resolve(repo, pointer.slice(8)))
            : null;
        }
        if (!gitDir || !contained(root, gitDir)) return null;
        let storage = gitDir;
        const commonFile = path.join(gitDir, "commondir");
        if (fs.existsSync(commonFile)) {
          if (fs.statSync(commonFile).size > 4096) return null;
          const common = realpath(
            path.resolve(gitDir, fs.readFileSync(commonFile, "utf8").trim()),
          );
          if (!common || !contained(root, common)) return null;
          storage = common;
        }
        const objects = realpath(path.join(storage, "objects"));
        if (
          !objects ||
          !contained(root, objects) ||
          fs.existsSync(path.join(objects, "info", "alternates"))
        )
          return null;
        const top = await read(repo, ["rev-parse", "--show-toplevel"]);
        return top && realpath(top) === repo ? { repo, gitDir } : null;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((entry) => entry !== null).slice(0, MAX_REPOSITORIES);
}
