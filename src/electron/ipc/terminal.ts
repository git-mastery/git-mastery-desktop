import { BrowserWindow } from "electron";
import os from "os";
import path from "path";
import pty from "node-pty";
import { ipcMainOn } from "../utils/util.js";

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

    const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
    ptyProcess = pty.spawn(shell!, [], {
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
