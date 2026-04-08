import { BrowserWindow } from "electron";
import os from "os";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import pty from "node-pty";
import { ipcMainOn } from "../utils/util.js";

/**
 * On Windows, attempts to find Git Bash (bash.exe) by locating the git
 * executable on PATH and resolving bash.exe relative to the Git install root.
 *
 * Git for Windows always ships bash.exe at <git-root>\bin\bash.exe, so this
 * works regardless of the installation directory.
 *
 * Returns null if git is not on PATH or bash.exe cannot be found.
 */
function findGitBash(): string | null {
  if (os.platform() !== 'win32') return null;
  try {
    // `where git` may return multiple lines; take the first valid one
    const gitPath = execSync('where git', { encoding: 'utf8' })
      .trim()
      .split('\n')[0]
      .trim();
    // git.exe lives at <git-root>\cmd\git.exe or <git-root>\bin\git.exe
    // Go up two levels to reach the Git install root
    const gitRoot = path.resolve(gitPath, '..', '..');
    const bashPath = path.join(gitRoot, 'bin', 'bash.exe');
    if (fs.existsSync(bashPath)) {
      console.log(`[terminal] found Git Bash at: ${bashPath}`);
      return bashPath;
    }
    console.warn(`[terminal] git found at ${gitPath} but bash.exe not found at ${bashPath}`);
    return null;
  } catch {
    console.warn('[terminal] could not locate git on PATH; falling back to COMSPEC');
    return null;
  }
}

/**
 * Resolves the shell to use for the pty process.
 *
 * Priority:
 *  1. Windows: Git Bash (bash.exe) found via git on PATH
 *  2. Windows fallback: COMSPEC (cmd.exe or PowerShell)
 *  3. macOS/Linux: $SHELL env var
 *  4. macOS/Linux fallback: /bin/bash
 */
function resolveShell(): string {
  if (os.platform() === 'win32') {
    return findGitBash() ?? process.env.COMSPEC ?? 'cmd.exe';
  }
  return process.env.SHELL ?? '/bin/bash';
}

let ptyProcess: pty.IPty;

/** Tracks the current working directory of the pty process. */
let cwd: string = process.env.HOME || process.env.USERPROFILE || os.homedir();

/** Returns the current working directory of the pty process. */
export function getCwd(): string {
  console.log(`[debug] cwd of simulated terminal is ${cwd}`)
  return cwd;
}

/**
 * Parses a `cd` command string and updates the tracked `cwd`.
 * Handles absolute paths, `~`, `..`, and relative paths.
 */
function updateCwdFromCdCommand(input: string): void {
  // Match a cd command, e.g. `cd /some/path`, `cd ..`, `cd ~`, `cd "C:\path with spaces"`
  const match = input.match(/^cd\s+"?([^"\r\n]+?)"?\s*\r?$/);
  if (!match) return;

  const target = match[1].trim();

  if (!target || target === '~') {
    cwd = process.env.HOME || process.env.USERPROFILE || os.homedir();
  } else {
    // path.resolve handles absolute, relative, and `..` segments
    cwd = path.resolve(cwd, target);
  }
}

/**
 * Writes data to the pty process.
 * If the data is a `cd` command, the tracked cwd is updated.
 */
export function writeToPty(data: string) {
  if (ptyProcess) {
    updateCwdFromCdCommand(data);
    ptyProcess.write(data);
  }
}

// This handles the simulated git terminal
export function setupTerminalIpc(mainWindow: BrowserWindow) {

  // Handle pty spawn request from renderer

  ipcMainOn('pty-spawn', ({ cols, rows }: { cols: number; rows: number }) => {
    // Kill existing pty if the renderer reloaded (e.g. page refresh)
    if (ptyProcess) {
      ptyProcess.kill();
    }

    // Reset cwd to home on each new pty spawn
    cwd = process.env.HOME || process.env.USERPROFILE || os.homedir();

    const shell = resolveShell();
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env
    });

    ptyProcess.onData(data => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-data', data);
      }
    });
  });

  // Handle pty input from renderer
  // writeToPty already handles cwd tracking for cd commands
  ipcMainOn('pty-write', ({ data }: { data: string }) => {
    writeToPty(data);
  });

  // Handle resize from renderer
  ipcMainOn('pty-resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

}
