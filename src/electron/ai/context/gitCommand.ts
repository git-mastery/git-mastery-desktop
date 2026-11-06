import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { getCliEnvironment } from "../../utils/cli/getters.js";

const execFileAsync = promisify(execFile);

/** Bounded local reads shared by repository discovery and context providers. */
export async function runGit(
  cwd: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  const env = getCliEnvironment();
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) delete env[key];
  }
  const { stdout } = await execFileAsync(
    "git",
    [
      "--no-optional-locks",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      ...args,
    ],
    {
      cwd,
      signal,
      env: {
        ...env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_LAZY_FETCH: "1",
        GIT_CEILING_DIRECTORIES: path.dirname(cwd),
      },
      timeout: 1500,
      maxBuffer: 1024 * 1024,
    },
  );
  return stdout.trim();
}
