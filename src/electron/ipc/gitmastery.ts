import { BrowserWindow } from "electron";
import path from "path";
import { spawn } from "child_process";
import { ipcMainHandle } from "../utils/util.js";
import { logGM } from "../utils/logger.js";
import {
  CLI_BINARY,
  getCliEnvironment,
  getExerciseDirectory,
  resolveGitMasteryBinary,
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
import { notifyAiHintsPageStateChanged } from "../ai/availability.js";
import {
  getBlockingPrereq,
  getStartPrereqStep,
  prereqFailureMessage,
} from "../startPrereqs.js";

const GM_TASK_DATA_CHANNEL = "gitmastery-task-data" as const;
const START_EXERCISE_STARTED_CHANNEL = "start-exercise-started" as const;
const START_EXERCISE_RESULT_CHANNEL = "start-exercise-result" as const;
const VERIFY_BLOCKED_CHANNEL = "verify-blocked" as const;

type ExercisePageBusy = (
  kind: "start" | "verify",
  id: string,
  busy: boolean,
) => void;

let exercisePageBusy: ExercisePageBusy | null = null;

/** The embedded lesson page paints Start/Verify busy state from this. */
export function onExercisePageBusy(handler: ExercisePageBusy) {
  exercisePageBusy = handler;
}

function setPageBusy(kind: "start" | "verify", id: string, busy: boolean) {
  exercisePageBusy?.(kind, id, busy);
}

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
  return spawn(resolveGitMasteryBinary() ?? CLI_BINARY, args, {
    cwd,
    env: getCliEnvironment(),
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
const spawnFailureMessage = (err: Error) => {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT") {
    return "Git-Mastery CLI not found. Install it from Settings, or restart the app if you just installed it yourself.";
  }
  return `Could not run Git-Mastery: ${err.message}`;
};

const _reportSpawnFailure = (
  mainWindow: BrowserWindow,
  originalCommand: string,
  exerciseIdentifier: string | undefined,
  err: Error,
) => {
  const message = spawnFailureMessage(err);
  logGM("close", originalCommand, message);
  const taskPayload: GitMasteryTaskData = {
    exerciseIdentifier,
    completed: {
      status: "failure",
      message,
    },
  };
  sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
    originalCommand,
    data: taskPayload,
  });
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
    echo.write(spawnFailureMessage(err));
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
): Promise<void> => {
  setPageBusy("verify", exerciseIdentifier, true);
  return runVerify(mainWindow, exerciseIdentifier).finally(() => {
    setPageBusy("verify", exerciseIdentifier, false);
  });
};

const runVerify = (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
): Promise<void> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const blocking = getBlockingPrereq();
    if (blocking) {
      const message = prereqFailureMessage(blocking);
      echoToXterm(`\r\n${message}\r\n`);
      sendToRenderer(mainWindow, GM_TASK_DATA_CHANNEL, {
        originalCommand: `verify`,
        data: {
          exerciseIdentifier,
          completed: { status: "failure", message },
        },
      });
      finish();
      return;
    }

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
      sendToRenderer(mainWindow, VERIFY_BLOCKED_CHANNEL, {
        exerciseIdentifier,
      });
      finish();
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
      echo.write(spawnFailureMessage(err));
      echo.finish();
      _reportSpawnFailure(mainWindow, "verify", exerciseIdentifier, err);
      finish();
    });

    childProcess.on("close", (code) => {
      if (settled) return;
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
      finish();
    });
  });

/** Incremented on every Start so a finishing download cannot steal a newer `cd`. */
let startGeneration = 0;

const _startExercise = async (
  mainWindow: BrowserWindow,
  exerciseIdentifier: string,
  options?: { skipIntro?: boolean },
): Promise<StartExerciseResult> => {
  // The outcome is broadcast as well as returned, so that the button injected
  // into the embedded lesson page, which has no return value to inspect, drives
  // the same error handling as the app's own button.
  const report = (
    result: StartExerciseResult,
    { broadcast = true }: { broadcast?: boolean } = {},
  ): StartExerciseResult => {
    if (!result.ok && result.error)
      console.warn(`[start-exercise] ${result.error}`);
    if (broadcast) {
      sendToRenderer(mainWindow, START_EXERCISE_RESULT_CHANNEL, result);
    }
    return result;
  };

  // Checked before taking a start generation, so a missing tool does not
  // cancel a download that is already changing directory.
  const firstRunStep = getStartPrereqStep({ skipIntro: options?.skipIntro });
  if (firstRunStep) {
    return report({ ok: false, exerciseIdentifier, firstRunStep });
  }

  const generation = ++startGeneration;
  const cdIfCurrent = (directory: string) => {
    if (generation === startGeneration) changeDirectory(directory);
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
  options?: { skipIntro?: boolean },
): Promise<StartExerciseResult> => {
  const inFlight = startingExercises.get(exerciseIdentifier);
  if (inFlight) return inFlight;

  sendToRenderer(mainWindow, START_EXERCISE_STARTED_CHANNEL, {
    exerciseIdentifier,
  });
  setPageBusy("start", exerciseIdentifier, true);
  const started = _startExercise(
    mainWindow,
    exerciseIdentifier,
    options,
  ).finally(() => {
    startingExercises.delete(exerciseIdentifier);
    // A download is what makes an exercise's AI Hints button usable.
    notifyAiHintsPageStateChanged();
    setPageBusy("start", exerciseIdentifier, false);
  });
  startingExercises.set(exerciseIdentifier, started);
  return started;
};

// Handles backend gitmastery ipc events
// responsible for downloads, verification, etc
export function setupGitmasteryIpc(mainWindow: BrowserWindow) {
  ipcMainHandle(
    "gitmastery-start-task",
    async ({ command }: { command: string }) => {
      // validateCommand(command);
      console.log(command);

      const commandParts = command.split(" ");
      const commandName = commandParts[0];
      const commandArgs = commandParts.slice(1);

      switch (commandName) {
        case "download":
          // Routed through startExercise so this path keeps the guard against
          // downloading over an exercise that already exists.
          void startExercise(mainWindow, commandArgs.join(" "));
          break;
        case "verify":
          void _verify(mainWindow, commandArgs.join(" "));
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
    async ({
      exerciseIdentifier,
      skipIntro,
    }: {
      exerciseIdentifier: string;
      skipIntro?: boolean;
    }) => startExercise(mainWindow, exerciseIdentifier, { skipIntro }),
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
