import fs from "fs";
import path from "path";
import { getConfig } from "../../storage.js";

export const CLI_BINARY =
  process.platform === "win32" ? "gitmastery.exe" : "gitmastery";

/** Written by `gitmastery setup` into the exercises root. */
export const EXERCISE_ROOT_MARKER = ".gitmastery.json";

const MACOS_HOMEBREW_PATHS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/homebrew/sbin",
  "/usr/local/sbin",
];

const MACOS_SYSTEM_PATHS = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"];

/** Windows env keys are case-insensitive; a spread copy of process.env is not. */
const pathKey = (env: NodeJS.ProcessEnv) =>
  Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";

/**
 * PATH for spawned CLI / PTY processes. On macOS, prepends Homebrew prefixes
 * that GUI launches otherwise miss. Nothing else is added: the CLI is installed
 * by the learner, and a learner-chosen folder must not sit ahead of system tools.
 */
export function getCliEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const key = pathKey(env);

  const inherited = env[key];
  const fallback =
    process.platform === "darwin"
      ? MACOS_SYSTEM_PATHS.join(path.delimiter)
      : "";
  const current = inherited && inherited.length > 0 ? inherited : fallback;

  const prefix = process.platform === "darwin" ? MACOS_HOMEBREW_PATHS : [];

  const unique = Array.from(
    new Set(
      [...prefix, ...current.split(path.delimiter)].filter((p) => p.length > 0),
    ),
  );

  env[key] = unique.join(path.delimiter);
  return env;
}

const isFile = (candidate: string): boolean =>
  fs.statSync(candidate, { throwIfNoEntry: false })?.isFile() ?? false;

/** Absolute path to the CLI, or null when nothing on PATH provides it. */
export function resolveGitMasteryBinary(): string | null {
  const env = getCliEnvironment();
  const dirs = (env[pathKey(env)] ?? "")
    .split(path.delimiter)
    .filter((p) => p.length > 0);

  for (const dir of dirs) {
    const candidate = path.join(dir, CLI_BINARY);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/** True when `directory` is a Git-Mastery exercises root. */
export function isExerciseRoot(directory: string): boolean {
  return isFile(path.join(directory, EXERCISE_ROOT_MARKER));
}

export function getExerciseDirectory(): string {
  const exercisesRoot = getConfig().exercisesRoot;
  if (!exercisesRoot) {
    throw new Error(
      "Exercise folder not set. Choose it when you start an exercise.",
    );
  }
  return exercisesRoot;
}
