import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { getCliEnvironment } from "../../utils/cli/getters.js";

const execFileAsync = promisify(execFile);

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

/** One collection owns the cache, queue and deadline; nothing survives a send. */
export class GitReader {
  private pending = new Map<string, Promise<string | null>>();
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private signal: AbortSignal) {}

  read(cwd: string, args: string[], remote = false): Promise<string | null> {
    const key = JSON.stringify([cwd, args, remote]);
    let result = this.pending.get(key);
    if (!result) {
      result = this.execute(cwd, args, remote);
      this.pending.set(key, result);
    }
    return result;
  }

  private async execute(
    cwd: string,
    args: string[],
    remote: boolean,
  ): Promise<string | null> {
    if (this.active >= 8) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      if (this.signal.aborted) return null;
      const env = getCliEnvironment();
      // Inherited Git overrides can redirect even read-only commands elsewhere.
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
          ...(remote
            ? [
                // The null device as gitdir prevents repository discovery and
                // local URL rewrites, helpers and SSH commands from being loaded.
                `--git-dir=${os.devNull}`,
                "-c",
                "credential.helper=",
                "-c",
                "core.askPass=",
                "-c",
                "protocol.allow=never",
                "-c",
                "protocol.https.allow=always",
                "-c",
                "protocol.ssh.allow=always",
                "-c",
                "protocol.file.allow=always",
              ]
            : []),
          ...args,
        ],
        {
          cwd,
          env: {
            ...env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_OPTIONAL_LOCKS: "0",
            GIT_NO_LAZY_FETCH: "1",
            GIT_CEILING_DIRECTORIES: path.dirname(cwd),
            ...(remote
              ? {
                  GIT_CONFIG_NOSYSTEM: "1",
                  GIT_CONFIG_GLOBAL: os.devNull,
                  GIT_SSH_COMMAND: `ssh -F "${os.devNull}" -oBatchMode=yes -oStrictHostKeyChecking=yes -oConnectTimeout=1`,
                }
              : {}),
          },
          signal: this.signal,
          timeout: 1500,
          maxBuffer: 1024 * 1024,
        },
      );
      return stdout.trim();
    } catch {
      // Never log execFile's error: it can contain credential-bearing URLs.
      return null;
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}
