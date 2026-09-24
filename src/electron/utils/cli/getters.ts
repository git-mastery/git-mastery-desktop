import fs from "fs";
import path from "path";
import { getConfig } from "../../storage.js";

export const CLI_BINARY =
  process.platform === "win32" ? "gitmastery.exe" : "gitmastery";

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
 * PATH for spawned CLI / PTY processes. Prepends `dataDirectory` so an
 * app-downloaded binary is found the same way as a self-install, then (on
 * macOS) Homebrew prefixes that GUI launches otherwise miss.
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

  const prefix: string[] = [];
  const dataDirectory = getConfig().dataDirectory;
  if (dataDirectory) prefix.push(dataDirectory);
  if (process.platform === "darwin") prefix.push(...MACOS_HOMEBREW_PATHS);

  const unique = Array.from(
    new Set(
      [...prefix, ...current.split(path.delimiter)].filter((p) => p.length > 0),
    ),
  );

  env[key] = unique.join(path.delimiter);
  return env;
}

/** Absolute path to the CLI, or null when nothing on PATH provides it. */
export function resolveGitMasteryBinary(): string | null {
  const env = getCliEnvironment();
  const dirs = (env[pathKey(env)] ?? "")
    .split(path.delimiter)
    .filter((p) => p.length > 0);

  for (const dir of dirs) {
    const candidate = path.join(dir, CLI_BINARY);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function getExerciseDirectory(): string {
  const dataDirectory = getConfig().dataDirectory;
  if (!dataDirectory) {
    throw new Error("Exercise directory not found. Finish setup to create it.");
  }
  return path.join(dataDirectory, "gitmastery-exercises");
}
