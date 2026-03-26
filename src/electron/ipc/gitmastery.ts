import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { ipcMainHandle } from "../utils/util.js";
import { getConfig } from "../storage.js";
import { logGM } from "../utils/logger.js";
import { downloadGitMasteryExe } from "../utils/win32/downloadExe.js";
import { getEnvironmentWithHomebrew, getExerciseDirectory, getGitMasteryExecutable } from "../utils/cli/getters.js";
import { getCwd, writeToPty } from "./terminal.js";
import { sendToRenderer } from "./ipcUtils.js";

const GM_TASK_DATA_CHANNEL = 'gitmastery-task-data' as const;

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

// TODO: handle the CWD (it fails when the exercise directory doesn't exist, so we have to ahndle this special case
// but should we have a better way of handling it)
const _spawnChildProcess = ({ args, cwd = getExerciseDirectory() }: { args: string[], cwd?: string }) => {
  return spawn(getGitMasteryExecutable(), args, {
    cwd,
    env: getEnvironmentWithHomebrew(),
  });

}


const _setup = async (mainWindow: BrowserWindow) => {
  const exeLocation = getGitMasteryExecutable();
  const dataDirectory = getConfig().dataDirectory;

  console.log({ exeLocation, dataDirectory });

  // 1. Check if the data directory exists
  if (!dataDirectory || !fs.existsSync(dataDirectory)) {
    throw new Error('Exercise directory not found');
  }


  // 2a. Check if the exe exists (windows only) — auto-download if missing
  if (process.platform === "win32" && !fs.existsSync(exeLocation)) {

    logGM('download', 'exe', 'gitmastery.exe not found — downloading latest release...');
    await downloadGitMasteryExe(dataDirectory);
    logGM('download', 'exe', 'Download complete.');
  }

  // 2b. Check if gitmastery is installed using brew (Mac only)
  // TODO

  // 3. Check if the exercises folder is created
  const exerciseDirectory = path.join(dataDirectory, 'gitmastery-exercises');
  if (!fs.existsSync(exerciseDirectory)) {
    // run setup process
    // Spawn the process
    // Do NOT use shell: true — it causes cmd.exe to split on spaces in the path,
    // e.g. "C:\Coding\gitmastery stuff\gitmastery.exe" gets truncated to "C:\Coding\gitmastery"
    // Use dataDirectory as cwd because the exercises subdirectory
    // doesn't exist yet — setup is what creates it. Using the default
    // cwd (getExerciseDirectory()) would cause spawn to fail with ENOENT.
    const childProcess = _spawnChildProcess({ args: ["setup"], cwd: dataDirectory });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    childProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      // Send progress updates to renderer
      logGM("stdout", "setup", data.toString());



      const taskPayload: GitMasteryTaskData = {
        success: {
          message: data.toString(),
          data: {
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          }
        }
      }

      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: "setup",
        data: taskPayload
      });


      if (data.toString().includes("PROMPT")) {
        childProcess.stdin.write("\n");
        childProcess.stdin.end(); // no more input
      }
    });

    childProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      // Send error updates to renderer
      logGM("stderr", "setup", data.toString());

      const taskPayload: GitMasteryTaskData = {
        error: {
          message: data.toString(),
          code: 500,
        }
      }

      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: "setup",
        data: taskPayload
      });

    });

    childProcess.on('close', (code) => {
      logGM("close", "setup", code!.toString());
      if (code === 0) {
        // Success


        const taskPayload: GitMasteryTaskData = {
          completed: {
            status: "success",
            message: "Setup completed successfully",
          }
        };
        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: "setup",
          data: taskPayload
        });
      } else {
        // Failure

        const taskPayload: GitMasteryTaskData = {
          error: {
            message: "Setup failed! Please try again (TODO)",
            code: 500,
          }
        }

        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: "setup",
          data: taskPayload
        });
      }
    });

    return;

  }

  // else, nothing to setup
  const taskPayload: GitMasteryTaskData = {
    completed: {
      status: "success",
      message: "Setup complete",
    }
  };
  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand: "setup",
    data: taskPayload
  });
  return;

}


const _download = (mainWindow: BrowserWindow, exerciseName: string) => {
  const childProcess = _spawnChildProcess({ args: ["download", exerciseName] });

  let stdoutBuffer = '';
  let stderrBuffer = '';

  childProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    // Send progress updates to renderer
    logGM("stdout", `download ${exerciseName}`, data.toString());

    const taskPayload: GitMasteryTaskData = {
      success: {
        message: data.toString(),
        data: {
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
        }
      }
    };

    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `download ${exerciseName}`,
      data: taskPayload
    });

    if (data.toString().includes("INFO  cd")) {
      // get the `cd` portion
      const cdLine = data.toString().split("INFO  cd")[1].trim();

      const fullPath = path.join(getExerciseDirectory(), ...cdLine.split("/"));

      console.log(`[info - electron] automatically cd-ing to: ${fullPath}`)

      writeToPty(`cd "${fullPath}"\r`);
    }
  });

  childProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString();
    // Send error updates to renderer
    logGM("stderr", `download ${exerciseName}`, data.toString());

    const taskPayload: GitMasteryTaskData = {
      error: {
        code: 500, // TODO: set this code properly
        message: data.toString(),
      }
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `download ${exerciseName}`,
      data: taskPayload
    });


  });


  childProcess.on('close', (code) => {
    logGM("close", `download ${exerciseName}`, code!.toString());
    if (code === 0) {
      // Success

      const taskPayload: GitMasteryTaskData = {
        completed: {
          status: "success",
          message: "Download completed successfully",
        }
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `download ${exerciseName}`,
        data: taskPayload
      });
    } else {
      // Failure
      const taskPayload: GitMasteryTaskData = {
        completed: {
          status: "failure",
          message: "Download failed! Please ensure GitMastery is set up properly",
        }
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `download ${exerciseName}`,
        data: taskPayload
      });

    }
  });

}

const _verify = (mainWindow: BrowserWindow) => {
  const childProcess = _spawnChildProcess({ args: ["verify"], cwd: getCwd() });

  let stdoutBuffer = '';
  let stderrBuffer = '';

  childProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    // Send progress updates to renderer
    logGM("stdout", `verify`, data.toString());

    const taskPayload: GitMasteryTaskData = {
      success: {
        message: data.toString(),
        data: {
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
        }
      }
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `verify`,
      data: taskPayload
    });


    // check for SUCCESS and ERROR

  });

  childProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString();
    // Send error updates to renderer
    logGM("stderr", `verify`, data.toString());

    const taskPayload: GitMasteryTaskData = {
      error: {
        code: 500, // TODO: set this code properly
        message: data.toString(),
      }
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `verify`,
      data: taskPayload
    });

  });

  childProcess.on('close', (code) => {
    logGM("close", `verify`, code!.toString());
    if (code === 0) {
      // Success


      const taskPayload: GitMasteryTaskData = {
        completed: {
          status: "success",
          message: "Verify completed successfully",
        }
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `verify`,
        data: taskPayload
      });

    } else {
      // Failure


      const taskPayload: GitMasteryTaskData = {
        error: {
          code: 500, // TODO: set this code properly
          message: "Verify failed! Please try again (TODO)",
        }
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `verify`,
        data: taskPayload
      });

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
    // validateCommand(command);
    console.log(command);

    const commandParts = command.split(' ');
    const commandName = commandParts[0];
    const commandArgs = commandParts.slice(1);

    switch (commandName) {
      case 'setup':
        await _setup(mainWindow);
        break;
      case 'download':
        _download(mainWindow, commandArgs.join(" "));
        break;
      case 'verify':
        _verify(mainWindow);
        break;
      default:
        throw new Error('Invalid command');
    }

    // commandToFunctionMap[command as keyof typeof commandToFunctionMap](mainWindow);



    return true;
  });

}

