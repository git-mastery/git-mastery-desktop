import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { ipcMainHandle } from "../utils/util.js";
import { getConfig } from "../storage.js";
import { logGM } from "../utils/logger.js";
import {
  getEnvironmentWithHomebrew,
  getExerciseDirectory,
  getGitMasteryExecutable,
} from "../utils/cli/getters.js";
import { patchExerciseProgress } from "../exerciseProgress.js";
import {
  HANDS_ON_PREFIX,
  isPathSegment,
  resolveExerciseCwd,
} from "../exerciseManifest.js";
import {
  changeDirectory,
  echoToXterm,
  getCwd,
  reprintPrompt,
} from "./terminal.js";
import { sendToRenderer } from "./ipcUtils.js";

const GM_TASK_DATA_CHANNEL = "gitmastery-task-data" as const;
const START_EXERCISE_STARTED_CHANNEL = "start-exercise-started" as const;
const START_EXERCISE_RESULT_CHANNEL = "start-exercise-result" as const;
const VERIFY_BLOCKED_CHANNEL = "verify-blocked" as const;

const isSameDirectory = (a: string, b: string): boolean => {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
};

/**
 * The directory Start would `cd` into, or null if the exercise is not ready
 * (invalid id, no exercises folder, not downloaded, corrupt, incomplete).
 */
const resolveReadyExerciseCwd = (exerciseIdentifier: string): string | null => {
  if (!isPathSegment(exerciseIdentifier)) return null;
  try {
    const resolved = resolveExerciseCwd(
      path.join(getExerciseDirectory(), exerciseIdentifier),
    );
    if (resolved.state === "ready") return resolved.cwd;
  } catch {
    // No configured exercise directory.
  }
  return null;
};

// -----------------------
// The below handles the functions for GitMastery invocation
// -----------------------

// TODO: handle the CWD (it fails when the exercise directory doesn't exist, so we have to ahndle this special case
// but should we have a better way of handling it)
const _spawnChildProcess = ({
  args,
  cwd = getExerciseDirectory(),
}: {
  args: string[];
  cwd?: string;
}) => {
  return spawn(getGitMasteryExecutable(), args, {
    cwd,
    env: getEnvironmentWithHomebrew(),
  });
};

/**
 * Mirrors a spawned CLI run into xterm scrollback. Display-only — the command
 * still runs as child_process, not inside the interactive shell.
 */
const startCliEcho = (commandLabel: string) => {
  echoToXterm(`\r\n${commandLabel}\r\n`);
  let finished = false;
  return {
    write(chunk: string) {
      if (finished || chunk.length === 0) return;
      echoToXterm(chunk);
    },
    finish() {
      if (finished) return;
      finished = true;
      echoToXterm("\r\n");
      reprintPrompt();
    },
  };
};

/**
 * Reports a process that never started (GitMastery missing from PATH, exercise
 * folder gone) as a task failure. Without an `error` listener Node throws this
 * as an uncaught exception and `close` never fires.
 */
const _reportSpawnFailure = (
  mainWindow: BrowserWindow,
  originalCommand: string,
  exerciseIdentifier: string | undefined,
  err: Error,
) => {
  logGM("close", originalCommand, err.message);
  const taskPayload: GitMasteryTaskData = {
    exerciseIdentifier,
    completed: {
      status: "failure",
      message: `Could not run GitMastery: ${err.message}`,
    },
  };
  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand,
    data: taskPayload,
  });
};

const _setup = async (mainWindow: BrowserWindow) => {
  const exeLocation = getGitMasteryExecutable();
  const dataDirectory = getConfig().dataDirectory;

  console.log({ exeLocation, dataDirectory });

  // 1. Check if the data directory exists.
  // Reported as a failed task rather than thrown, so the renderer settles the
  // same way it does for any other setup failure.
  if (!dataDirectory || !fs.existsSync(dataDirectory)) {
    console.log("error: data directory not found");
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: "setup",
      data: {
        completed: {
          status: "failure",
          message:
            "No save location configured. Choose where exercise files should live first.",
        },
      },
    });
    return;
  }

  // 2a. Check if the exe exists (windows only) — auto-download if missing
  // if (process.platform === "win32" && !fs.existsSync(exeLocation)) {

  //   logGM('download', 'exe', 'gitmastery.exe not found — downloading latest release...');
  //   await downloadGitMasteryExe(dataDirectory);
  //   logGM('download', 'exe', 'Download complete.');
  // }

  // 2b. Check if gitmastery is installed using brew (Mac only)
  // TODO

  // 3. Check if the exercises folder is created
  const exerciseDirectory = path.join(dataDirectory, "gitmastery-exercises");
  if (!fs.existsSync(exerciseDirectory)) {
    // run setup process
    // Spawn the process
    // Do NOT use shell: true — it causes cmd.exe to split on spaces in the path,
    // e.g. "C:\Coding\gitmastery stuff\gitmastery.exe" gets truncated to "C:\Coding\gitmastery"
    // Use dataDirectory as cwd because the exercises subdirectory
    // doesn't exist yet — setup is what creates it. Using the default
    // cwd (getExerciseDirectory()) would cause spawn to fail with ENOENT.
    const childProcess = _spawnChildProcess({
      args: ["setup"],
      cwd: dataDirectory,
    });
    const echo = startCliEcho("gitmastery setup");

    let stdoutBuffer = "";
    let stderrBuffer = "";

    childProcess.stdout.on("data", (data) => {
      stdoutBuffer += data.toString() + "[[terminal-line]]";
      // Send progress updates to renderer
      logGM("stdout", "setup", data.toString());
      echo.write(data.toString());

      const taskPayload: GitMasteryTaskData = {
        success: {
          message: data.toString(),
          data: {
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          },
        },
      };

      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: "setup",
        data: taskPayload,
      });

      if (data.toString().includes("PROMPT")) {
        childProcess.stdin.write("\n");
        childProcess.stdin.end(); // no more input
      }
    });

    childProcess.stderr.on("data", (data) => {
      stderrBuffer += data.toString() + "[[terminal-line]]";
      // Send error updates to renderer
      logGM("stderr", "setup", data.toString());
      echo.write(data.toString());

      const taskPayload: GitMasteryTaskData = {
        error: {
          message: data.toString(),
          code: 500,
        },
      };

      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: "setup",
        data: taskPayload,
      });
    });

    childProcess.on("error", (err) => {
      echo.write(`Could not run GitMastery: ${err.message}`);
      echo.finish();
      _reportSpawnFailure(mainWindow, "setup", undefined, err);
    });

    childProcess.on("close", (code) => {
      echo.finish();
      logGM("close", "setup", String(code));
      if (code === 0) {
        // Success

        const taskPayload: GitMasteryTaskData = {
          completed: {
            status: "success",
            message: "Setup finished",
          },
        };
        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: "setup",
          data: taskPayload,
        });
      } else {
        // Failure

        const taskPayload: GitMasteryTaskData = {
          completed: {
            status: "failure",
            message: stderrBuffer || "Setup failed. Try again.",
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          },
        };

        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: "setup",
          data: taskPayload,
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
    },
  };
  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand: "setup",
    data: taskPayload,
  });

  console.log("nothing to setup for gitmastery setup", taskPayload);
  return;
};

/**
 * Runs `gitmastery download <exercise>`, streaming progress to the renderer.
 * Resolves true once the CLI exits successfully, so callers can chain work —
 * `startExercise` uses this to cd in once the files are actually on disk.
 *
 * Callers must not invoke this for an exercise that already exists on disk. See
 * startExercise, and docs/architecture/exercise-directory-resolution.md.
 */
export const _download = (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
): Promise<boolean> => {
  let resolveFinished: (ok: boolean) => void = () => {};
  const finished = new Promise<boolean>((resolve) => {
    resolveFinished = resolve;
  });
  let settled = false;
  const settle = (ok: boolean) => {
    if (settled) return;
    settled = true;
    resolveFinished(ok);
  };

  const childProcess = _spawnChildProcess({
    args: ["download", exerciseIdentifier],
  });
  const echo = startCliEcho(`gitmastery download ${exerciseIdentifier}`);

  const taskPayload: GitMasteryTaskData = {
    exerciseIdentifier: exerciseIdentifier,
    success: {
      message: "Downloading…",
      data: {
        stderr: "",
        stdout: "",
      },
    },
  };

  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand: `download ${exerciseIdentifier}`,
    data: taskPayload,
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";

  childProcess.stdout.on("data", (data) => {
    stdoutBuffer += data.toString() + "[[terminal-line]]";
    // Send progress updates to renderer
    logGM("stdout", `download ${exerciseIdentifier}`, data.toString());
    echo.write(data.toString());

    const taskPayload: GitMasteryTaskData = {
      exerciseIdentifier: exerciseIdentifier,

      success: {
        message: data.toString(),
        data: {
          stderr: stderrBuffer,
          stdout: stdoutBuffer,
        },
      },
    };

    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `download ${exerciseIdentifier}`,
      data: taskPayload,
    });
  });

  childProcess.stderr.on("data", (data) => {
    stderrBuffer += data.toString() + "[[terminal-line]]";
    // Send error updates to renderer
    logGM("stderr", `download ${exerciseIdentifier}`, data.toString());
    echo.write(data.toString());

    const taskPayload: GitMasteryTaskData = {
      exerciseIdentifier: exerciseIdentifier,

      error: {
        code: 500, // TODO: set this code properly
        message: data.toString(),
      },
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `download ${exerciseIdentifier}`,
      data: taskPayload,
    });
  });

  childProcess.on("error", (err) => {
    echo.write(`Could not run GitMastery: ${err.message}`);
    echo.finish();
    _reportSpawnFailure(
      mainWindow,
      `download ${exerciseIdentifier}`,
      exerciseIdentifier,
      err,
    );
    settle(false);
  });

  childProcess.on("close", (code) => {
    echo.finish();
    // Spawn `error` already reported the failure; `close` still fires with
    // `code === null` and must not send a second completed payload or throw.
    if (settled) return;
    try {
      logGM("close", `download ${exerciseIdentifier}`, String(code));
      if (code === 0) {
        const taskPayload: GitMasteryTaskData = {
          exerciseIdentifier: exerciseIdentifier,

          completed: {
            status: "success",
            message: "Download finished",
          },
        };
        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: `download ${exerciseIdentifier}`,
          data: taskPayload,
        });

        patchExerciseProgress(exerciseIdentifier, "downloaded");
      } else {
        const taskPayload: GitMasteryTaskData = {
          exerciseIdentifier: exerciseIdentifier,

          completed: {
            status: "failure",
            message:
              stderrBuffer ||
              "Download failed. Finish setup in Settings, then try again.",
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
          },
        };
        sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
          originalCommand: `download ${exerciseIdentifier}`,
          data: taskPayload,
        });
      }
    } finally {
      settle(code === 0);
    }
  });

  return finished;
};

/**
 * Verify only runs once the terminal is already in the directory Start would
 * `cd` into. If it is not, the CLI is not spawned — the renderer asks the
 * learner to click Start Exercise instead.
 */
export const _verify = (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
) => {
  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand: `verify`,
    data: {
      exerciseIdentifier,
      success: {
        message: "Verifying…",
        data: { stderr: "", stdout: "" },
      },
    },
  });

  const exerciseCwd = resolveReadyExerciseCwd(exerciseIdentifier);
  if (exerciseCwd === null || !isSameDirectory(getCwd(), exerciseCwd)) {
    sendToRenderer(mainWindow, VERIFY_BLOCKED_CHANNEL, { exerciseIdentifier });
    return;
  }

  const childProcess = _spawnChildProcess({
    args: ["verify"],
    cwd: exerciseCwd,
  });
  const echo = startCliEcho("gitmastery verify");

  let stdoutBuffer = "";
  let stderrBuffer = "";

  childProcess.stdout.on("data", (data) => {
    stdoutBuffer += data.toString() + "[[terminal-line]]";
    // Send progress updates to renderer
    logGM("stdout", `verify`, data.toString());
    echo.write(data.toString());

    const taskPayload: GitMasteryTaskData = {
      exerciseIdentifier: exerciseIdentifier,

      success: {
        message: data.toString(),
        data: {
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
        },
      },
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `verify`,
      data: taskPayload,
    });

    // check for SUCCESS and ERROR
  });

  childProcess.stderr.on("data", (data) => {
    stderrBuffer += data.toString() + "[[terminal-line]]";
    // Send error updates to renderer
    logGM("stderr", `verify`, data.toString());
    echo.write(data.toString());

    const taskPayload: GitMasteryTaskData = {
      exerciseIdentifier: exerciseIdentifier,

      error: {
        code: 500, // TODO: set this code properly
        message: data.toString(),
      },
    };
    sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
      originalCommand: `verify`,
      data: taskPayload,
    });
  });

  childProcess.on("error", (err) => {
    echo.write(`Could not run GitMastery: ${err.message}`);
    echo.finish();
    _reportSpawnFailure(mainWindow, "verify", exerciseIdentifier, err);
  });

  childProcess.on("close", (code) => {
    echo.finish();
    logGM("close", `verify`, String(code));
    if (code === 0) {
      // Success

      const correct = _checkCorrectSolution(stdoutBuffer);
      const incorrect = _checkIncorrectSolution(stdoutBuffer);
      const comments = _getComments(stdoutBuffer);

      const taskPayload: GitMasteryTaskData = {
        exerciseIdentifier: exerciseIdentifier,

        completed: {
          status: "success",
          message: "Verify finished",
          stdout: stdoutBuffer,
          stderr: stderrBuffer,

          data: {
            correct,
            incorrect,
            comments,
          },
        },
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `verify`,
        data: taskPayload,
      });

      if (!exerciseIdentifier.startsWith(HANDS_ON_PREFIX)) {
        patchExerciseProgress(
          exerciseIdentifier,
          correct ? "completed" : "in-progress",
        );
      }
    } else {
      // Failure

      const taskPayload: GitMasteryTaskData = {
        exerciseIdentifier: exerciseIdentifier,

        completed: {
          status: "failure",
          message: stderrBuffer || "Verify failed. Try again.",
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
        },
      };
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `verify`,
        data: taskPayload,
      });
    }
  });
};

/** Incremented on every Start so a finishing download cannot steal a newer `cd`. */
let startGeneration = 0;

const _startExercise = async (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
): Promise<StartExerciseResult> => {
  const generation = ++startGeneration;
  const cdIfCurrent = (directory: string) => {
    if (generation === startGeneration) changeDirectory(directory);
  };

  // The outcome is broadcast as well as returned, so that the button injected
  // into the embedded lesson page, which has no return value to inspect, drives
  // the same onboarding and error handling as the app's own button.
  const report = (
    result: StartExerciseResult,
    { broadcast = true }: { broadcast?: boolean } = {},
  ): StartExerciseResult => {
    if (!result.ok) console.warn(`[start-exercise] ${result.error}`);
    if (broadcast) {
      sendToRenderer(mainWindow, START_EXERCISE_RESULT_CHANNEL, result);
    }
    return result;
  };

  if (!isPathSegment(exerciseIdentifier)) {
    return report({
      ok: false,
      exerciseIdentifier,
      error: "Invalid exercise identifier.",
    });
  }

  let exerciseRoot: string;
  try {
    exerciseRoot = path.join(getExerciseDirectory(), exerciseIdentifier);
  } catch (err) {
    return report({
      ok: false,
      exerciseIdentifier,
      error: (err as Error).message,
    });
  }

  const resolved = resolveExerciseCwd(exerciseRoot);

  switch (resolved.state) {
    case "ready":
      cdIfCurrent(resolved.cwd);
      return report({
        ok: true,
        exerciseIdentifier,
        cwd: resolved.cwd,
        downloaded: false,
      });

    case "not-downloaded": {
      const downloaded = await _download(mainWindow, exerciseIdentifier);
      if (!downloaded) {
        return report({
          ok: false,
          exerciseIdentifier,
          error: `Could not download ${exerciseIdentifier}.`,
        });
      }

      const afterDownload = resolveExerciseCwd(exerciseRoot);
      if (afterDownload.state !== "ready") {
        return report({
          ok: false,
          exerciseIdentifier,
          error: `Downloaded ${exerciseIdentifier}, but could not find its folder.`,
          needsRestart: true,
        });
      }

      cdIfCurrent(afterDownload.cwd);
      return report({
        ok: true,
        exerciseIdentifier,
        cwd: afterDownload.cwd,
        downloaded: true,
      });
    }

    // Something is on disk but unusable. Downloading over it would destroy
    // whatever the learner has in there, so make them choose to restart.
    case "corrupt":
    case "incomplete":
      return report({
        ok: false,
        exerciseIdentifier,
        error:
          resolved.state === "corrupt"
            ? `The folder at ${resolved.exerciseRoot} is not a valid exercise.`
            : `The exercise at ${resolved.exerciseRoot} did not finish downloading.`,
        needsRestart: true,
      });
  }
};

/** Starts in flight, so that a second click does not download a second time. */
const startingExercises = new Map<string, Promise<StartExerciseResult>>();

/**
 * Puts the learner into an exercise, downloading it first only if it is not
 * already on disk.
 *
 * The existence check is the point. `gitmastery download` is destructive on
 * older CLIs (it deletes the folder and any work in it) and a hard error on
 * newer ones, so "Start" must never issue a download for an exercise the
 * learner has already begun. Resolving locally also makes resuming instant —
 * every CLI invocation costs seconds, since it checks for a newer release
 * before running any subcommand.
 *
 * See docs/architecture/exercise-directory-resolution.md.
 */
export const startExercise = (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
): Promise<StartExerciseResult> => {
  const inFlight = startingExercises.get(exerciseIdentifier);
  if (inFlight) return inFlight;

  sendToRenderer(mainWindow, START_EXERCISE_STARTED_CHANNEL, {
    exerciseIdentifier,
  });
  const started = _startExercise(mainWindow, exerciseIdentifier).finally(() =>
    startingExercises.delete(exerciseIdentifier),
  );
  startingExercises.set(exerciseIdentifier, started);
  return started;
};

// Handles backend gitmastery ipc events
// responsible for downloads, verification, etc
export function setupGitmasteryIpc(mainWindow: BrowserWindow) {
  // command 1: `gitmastery setup`
  // prerequisites: must have chosen an exe location and exercise directory
  // action: spawn terminal, cd to exercise directory, run `[exe location] setup`
  ipcMainHandle(
    "gitmastery-start-task",
    async ({ command }: { command: string }) => {
      // validateCommand(command);
      console.log(command);

      const commandParts = command.split(" ");
      const commandName = commandParts[0];
      const commandArgs = commandParts.slice(1);

      switch (commandName) {
        case "setup":
          await _setup(mainWindow);
          break;
        case "download":
          // Routed through startExercise so this path keeps the guard against
          // downloading over an exercise that already exists.
          void startExercise(mainWindow, commandArgs.join(" "));
          break;
        case "verify":
          _verify(mainWindow, commandArgs.join(" "));
          break;
        default:
          throw new Error("Invalid command");
      }

      return true;
    },
  );

  // Command 2: `start` an exercise manually (this function helps the user CD into an exercise)
  ipcMainHandle(
    "gitmastery-start-exercise",
    async ({ exerciseIdentifier }: { exerciseIdentifier: string }) =>
      startExercise(mainWindow, exerciseIdentifier),
  );
}

// Checks for the line `INFO  Status: Incomplete`
const _checkIncorrectSolution = (stdout: string) => {
  const lines = stdout.split("[[terminal-line]]");
  for (const line of lines) {
    if (line.includes("INFO  Status: Incomplete")) {
      return true;
    }
    if (line.includes("INFO  Status: Error")) {
      return true;
    }
  }
  return false;
};
// Checks for the line `INFO  Status: Completed`
const _checkCorrectSolution = (stdout: string) => {
  const lines = stdout.split("[[terminal-line]]");
  for (const line of lines) {
    if (line.includes("INFO  Status: Completed")) {
      return true;
    }
  }
  return false;
};

/**
 *
 * INFO  Comments:\r\n- The init operation is not undone.
 */
const _getComments = (stdout: string) => {
  const lines = stdout.split("[[terminal-line]]");
  for (const line of lines) {
    if (line.includes("INFO  Comments:")) {
      // TODO: Fragile, replace with the json output version in future
      return line.split("\n")[1].trim().replace("- ", "");
    }
  }
  return "";
};
