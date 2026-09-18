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
  if (os.platform() !== "win32") return null;
  try {
    // `where git` may return multiple lines; take the first valid one
    const gitPath = execSync("where git", { encoding: "utf8" })
      .trim()
      .split("\n")[0]
      .trim();
    // git.exe lives at <git-root>\cmd\git.exe or <git-root>\bin\git.exe
    // Go up two levels to reach the Git install root
    const gitRoot = path.resolve(gitPath, "..", "..");
    const bashPath = path.join(gitRoot, "bin", "bash.exe");
    if (fs.existsSync(bashPath)) {
      console.log(`[terminal] found Git Bash at: ${bashPath}`);
      return bashPath;
    }

    // try C:\Program Files\Git\git-bash.exe
    const bashPathAlt = path.join("C:\\Program Files\\Git\\bin", "bash.exe");
    if (fs.existsSync(bashPathAlt)) {
      console.log(`[terminal] found Git Bash at: ${bashPathAlt}`);
      return bashPathAlt;
    }
    console.warn(
      `[terminal] git found at ${gitPath} but bash.exe not found at ${bashPath}`,
    );
    return null;
  } catch {
    console.warn(
      "[terminal] could not locate git on PATH; falling back to COMSPEC",
    );
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
  if (os.platform() === "win32") {
    return findGitBash() ?? process.env.COMSPEC ?? "cmd.exe";
  }
  return process.env.SHELL ?? "/bin/bash";
}

let ptyProcess: pty.IPty;
let isPosixShell = true;
let terminalWindow: BrowserWindow | null = null;

/**
 * Commands issued before the shell exists (e.g. an exercise started while the
 * terminal is still mounting) so they can be replayed once it spawns.
 */
let pendingCommands: string[] = [];

/** Tracks the current working directory of the pty process. */
let cwd: string = process.env.HOME || process.env.USERPROFILE || os.homedir();

/** Returns the current working directory of the pty process. */
export function getCwd(): string {
  console.log(`[debug] cwd of simulated terminal is ${cwd}`);
  return cwd;
}

/** Quotes a path for the spawned shell. Windows paths cannot contain `"`. */
function quotePath(directory: string): string {
  return isPosixShell
    ? `'${directory.replace(/'/g, "'\\''")}'`
    : `"${directory}"`;
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

  if (!target || target === "~") {
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

function sendToXterm(data: string) {
  if (terminalWindow && !terminalWindow.isDestroyed()) {
    terminalWindow.webContents.send("pty-data", data);
  }
}

/**
 * Paints text in the xterm pane without sending it to the shell. CLI spawn
 * output uses this so INFO lines live in scrollback instead of a toast.
 */
export function echoToXterm(text: string) {
  sendToXterm(text.replace(/\r?\n/g, "\r\n"));
}

/**
 * Clears a half-typed line and submits empty Enter so the shell reprints a
 * prompt below display-only echo (which the PTY never saw).
 */
export function reprintPrompt() {
  writeToPty("\x15\r");
}

/**
 * Writes a command to the prompt. `\x15` clears anything the user has half-typed,
 * which would otherwise be prepended to it. If the shell has not spawned yet the
 * command is replayed on spawn.
 */
function writeCommandToPty(command: string) {
  if (!ptyProcess) {
    pendingCommands.push(command);
    return;
  }
  ptyProcess.write(`\x15${command}\r`);
}

/**
 * Moves the terminal into a directory. The path is quoted rather than
 * interpolated so that shell metacharacters in it stay literal.
 */
export function changeDirectory(directory: string) {
  cwd = directory;
  writeCommandToPty(`cd ${quotePath(directory)}`);
}

// This handles the simulated git terminal
export function setupTerminalIpc(mainWindow: BrowserWindow) {
  terminalWindow = mainWindow;

  // Handle pty spawn request from renderer

  ipcMainOn("pty-spawn", ({ cols, rows }: { cols: number; rows: number }) => {
    // Kill existing pty if the renderer reloaded (e.g. page refresh)
    if (ptyProcess) {
      ptyProcess.kill();
    }

    // Reset cwd to home on each new pty spawn, unless a queued command (e.g. an
    // exercise started while the terminal was mounting) already set one.
    if (pendingCommands.length === 0) {
      cwd = process.env.HOME || process.env.USERPROFILE || os.homedir();
    }

    const shell = resolveShell();
    isPosixShell = !/cmd\.exe$|powershell\.exe$|pwsh\.exe$/i.test(shell);
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: process.env,
    });

    // Queued commands are replayed on the shell's first output rather than
    // immediately after spawn, since shells discard input written before they
    // finish setting up their line editor.
    let hasReplayedQueue = false;

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pty-data", data);
      }

      if (!hasReplayedQueue) {
        hasReplayedQueue = true;
        const queued = pendingCommands;
        pendingCommands = [];
        queued.forEach(writeCommandToPty);
      }
    });
  });

  // Handle pty input from renderer
  // writeToPty already handles cwd tracking for cd commands
  ipcMainOn("pty-write", ({ data }: { data: string }) => {
    writeToPty(data);
  });

  // Handle resize from renderer
  ipcMainOn("pty-resize", ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });
}
