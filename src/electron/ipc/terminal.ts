import { ipcMain, BrowserWindow } from "electron";
import os from "os";
import pty from "node-pty";

let ptyProcess: pty.IPty;

export function setupTerminalIpc(mainWindow: BrowserWindow) {

  // Handle pty spawn request from renderer
  ipcMain.on('pty-spawn', (_, { cols, rows }: { cols: number; rows: number }) => {
    // Kill existing pty if the renderer reloaded (e.g. page refresh)
    if (ptyProcess) {
      ptyProcess.kill();
    }

    const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
    ptyProcess = pty.spawn(shell!, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || process.env.USERPROFILE,
      env: process.env
    });

    ptyProcess.onData(data => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-data', data);
      }
    });
  });

  // Handle pty input from renderer
  ipcMain.on('pty-write', (_, data) => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  // Handle resize from renderer
  ipcMain.on('pty-resize', (_, { cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

}

