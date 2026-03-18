import { ipcMain, BrowserWindow } from "electron";
import os from "os";
import pty from "node-pty";
import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import { getConfig } from "../storage.js";
import path from "path";
import { spawn } from "child_process";
import { logGM } from "../utils/logger.js";

const GM_TASK_DATA_CHANNEL = 'gitmastery-task-data' as const;

let ptyProcess: pty.IPty;

// This handles the simulated git terminal
export function setupTerminalIpc(mainWindow: BrowserWindow) {

  // Handle pty spawn request from renderer

  ipcMainOn('pty-spawn', ({ cols, rows }: { cols: number; rows: number }) => {
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
  ipcMainOn('pty-write', ({ data }: { data: string }) => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  // Handle resize from renderer
  ipcMainOn('pty-resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

}


// -----------------------
// The below handles the functions for GitMastery invocation
// -----------------------


const validateCommand = (command: string) => {
  const validCommands = ['setup', 'download'];

  const commandParts = command.split(' ');
  const commandName = commandParts[0];

  if (!validCommands.includes(commandName)) {
    throw new Error('Invalid command');
  }
}

const _spawnChildProcess = (args: string[]) => {
  return spawn(getGitMasteryExecutable(), args, {
    cwd: getConfig().exerciseDirectory,
    env: getEnvironmentWithHomebrew(),
  });

}

const _setup = (mainWindow: BrowserWindow) => {
  const exeLocation = getGitMasteryExecutable();
  const exerciseDirectory = getConfig().exerciseDirectory;

  console.log({ exeLocation, exerciseDirectory });

  // Spawn the process
  // Do NOT use shell: true — it causes cmd.exe to split on spaces in the path,
  // e.g. "C:\Coding\gitmastery stuff\gitmastery.exe" gets truncated to "C:\Coding\gitmastery"
  const childProcess = _spawnChildProcess(["setup"]);

  let stdoutBuffer = '';
  let stderrBuffer = '';

  childProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    // Send progress updates to renderer
    logGM("stdout", "setup", data.toString());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(GM_TASK_DATA_CHANNEL, {
        originalCommand: "setup",
        data: {
          success: {
            message: data.toString(),
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          }
        },
      });
    }

    if (data.toString().includes("PROMPT")) {
      childProcess.stdin.write("\n");
      childProcess.stdin.end(); // no more input
    }
  });

  childProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString();
    // Send error updates to renderer
    logGM("stderr", "setup", data.toString());
    // mainWindow.webContents.send('gitmastery-error', {
    //   originalCommand,
    //   error: stderrBuffer,
    // });
  });

  childProcess.on('close', (code) => {
    logGM("close", "setup", code!.toString());
    if (code === 0) {
      // Success
      // mainWindow.webContents.send('gitmastery-success', {
      //   originalCommand,
      //   data: parseGitMasteryOutput(stdoutBuffer),
      // });
    } else {
      // Failure
      // mainWindow.webContents.send('gitmastery-failure', {
      //   originalCommand,
      //   error: stderrBuffer,
      //   code,
      // });
    }
  });

}


const _download = (mainWindow: BrowserWindow, exerciseName: string) => {
  const childProcess = _spawnChildProcess(["download", exerciseName]);

  let stdoutBuffer = '';
  let stderrBuffer = '';

  childProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    // Send progress updates to renderer
    logGM("stdout", `download ${exerciseName}`, data.toString());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(GM_TASK_DATA_CHANNEL, {
        originalCommand: `download ${exerciseName}`,
        data: {
          success: {
            message: data.toString(),
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          }
        },
      });
    }

    if (data.toString().includes("INFO cd")) {
      // we need to change the CWD of the simulated git terminal to the exercise downloaded
      // the path will be: getConfig().exerciseDirectory + 
    }
  });

  childProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString();
    // Send error updates to renderer
    logGM("stderr", `download ${exerciseName}`, data.toString());
    // mainWindow.webContents.send('gitmastery-error', {
    //   originalCommand,
    //   error: stderrBuffer,
    // });
  });

  childProcess.on('close', (code) => {
    logGM("close", `download ${exerciseName}`, code!.toString());
    if (code === 0) {
      // Success
      // mainWindow.webContents.send('gitmastery-success', {
      //   originalCommand,
      //   data: parseGitMasteryOutput(stdoutBuffer),
      // });
    } else {
      // Failure
      // mainWindow.webContents.send('gitmastery-failure', {
      //   originalCommand,
      //   error: stderrBuffer,
      //   code,
      // });
    }
  });

}


// Handles backend gitmastery ipc events
// responsible for downloads, verification, etc
export function setupGitmasteryIpc(mainWindow: BrowserWindow) {
  // command 1: `gitmastery setup`
  // prerequisites: must have chosen an exe location and exercise directory
  // action: spawn terminal, cd to exercise directory, run `[exe location] setup`
  ipcMainHandle('gitmastery-start-task', async ({ command }: { command: string }) => {
    validateCommand(command);

    const exeLocation = getConfig().exeLocation;
    const exerciseDirectory = getConfig().exerciseDirectory;
    if (!exeLocation || !exerciseDirectory) {
      throw new Error('Exe location or exercise directory not found, please configure them in settings.');
    }
    // spawn a separate terminal (NOT the pty terminal)
    console.log(`exeLocation is ${exeLocation}`);
    console.log(`exerciseDirectory is ${exerciseDirectory}`);

    console.log(command);

    const commandParts = command.split(' ');
    const commandName = commandParts[0];
    const commandArgs = commandParts.slice(1);

    switch (commandName) {
      case 'setup':
        _setup(mainWindow);
        break;
      case 'download':
        _download(mainWindow, commandArgs.join(" "));
        break;
      default:
        throw new Error('Invalid command');
    }

    // commandToFunctionMap[command as keyof typeof commandToFunctionMap](mainWindow);



    return true;
  });

}

// Helper function to get the correct gitmastery executable based on platform
function getGitMasteryExecutable(): string {
  if (getConfig().exeLocation) {
    return getConfig().exeLocation!;
  }

  if (process.platform === 'darwin') {
    // On macOS, use Homebrew-installed gitmastery
    return 'gitmastery';
  } else {
    // On Windows, use bundled executable
    return path.join(__dirname, '../gitmastery.exe');
  }
}

// Helper function to get environment with Homebrew paths added
function getEnvironmentWithHomebrew(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  if (process.platform === 'darwin') {
    // On macOS, add common Homebrew paths to PATH
    const homebrewPaths = [
      '/opt/homebrew/bin',      // Apple Silicon Macs
      '/usr/local/bin',         // Intel Macs
      '/opt/homebrew/sbin',
      '/usr/local/sbin'
    ];

    // Standard system paths that should always be included
    const systemPaths = [
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ];

    // Get current PATH or use system paths as fallback
    const currentPath = env.PATH || systemPaths.join(':');

    // Combine Homebrew paths with current PATH
    // Put Homebrew paths first so they take precedence
    const allPaths = [...homebrewPaths, ...currentPath.split(':')];

    // Remove duplicates while preserving order
    const uniquePaths = Array.from(new Set(allPaths)).filter(p => p.length > 0);

    env.PATH = uniquePaths.join(':');

    // Debug logging to help diagnose PATH issues
    console.log('Enhanced PATH for macOS:', env.PATH);
  }

  return env;
}
