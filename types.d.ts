interface Window {
  electron: {
    spawn: (cols: number, rows: number) => void;
    write: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    resize: (cols: number, rows: number) => void;

    // for Web Contents View
    setContentsViewSize: (x: number, y: number, width: number, height: number) => void;
    navigate: (url: string) => void;
    hide: () => void;
    show: () => void;

    // for configuration
    setExeLocation: (location: string) => void;
    setExerciseDirectory: (directory: string) => void;
    selectFolder: () => Promise<string | null>;
    selectFile: (fileType: string) => Promise<string | null>

    // for retrieving config settings of the backend (electron app)
    // just an array of folder names
    getDownloadedExercises: () => Promise<ProgressData>


    // TODO: see if we can type `originalCommand`
    onGitMasteryTaskData: (callback: (originalCommand: string, data: GitMasteryTaskData) => void) => () => void;

    // TODO: decide whether this command should return when (1) task starts or (2) task completes
    startGitMasteryTask: (command: string) => Promise<boolean>;
    startExercise: (exerciseIdentifier: string) => void;
  }
}

/**
 * One-way channels (Renderer -> Main).
 * Used with ipcSend and ipcOn.
 * No response is expected.
 */
type IpcHandlerChannelMapping = {
  "pty-spawn": { cols: number, rows: number },
  "pty-write": { data: string },
  "pty-resize": { cols: number, rows: number },
  "pty-data": string,
  "wcv-navigate": { url: string },
  "wcv-show": null,
  "wcv-size": { x: number, y: number, width: number, height: number },
  "wcv-hide": null,

  // to be saved on backend to run the exe if needed (Win)
  "set-exe-location": { location: string },

  // to be saved on backend to reference whenever a new exercise needs to be downloaded
  "set-exercise-directory": { directory: string },

  "gitmastery-task-data": { originalCommand: string, data: GitMasteryTaskData },
  "gitmastery-start-exercise": { exerciseIdentifier: string },
}

/**
 * Two-way channels (Renderer -> Main -> Renderer).
 * Used with ipcInvoke.
 * Each entry has a typed request payload and a typed response value.
 */
type IpcInvokeChannelMapping = {
  "select-folder": { request: null, response: string | null },
  "select-file": { request: string, response: string | null },

  "get-downloaded-exercises": { request: null, response: ProgressData },

  "gitmastery-setup": { request: null, response: string | null },
  "gitmastery-start-task": { request: { command: string }, response: boolean },
}

type GitMasteryTaskData = {
  // specific to `download` channels
  exerciseIdentifier?: string;

  // Error is sent when the terminal displays an error while running an operation.
  // In this case, the terminal is still running.
  error?: {
    code: number;
    message: string;
  }

  // Success is sent when there is a line of code written to stdout.
  // Note that the terminal is still running.
  success?: {
    message: string; // purely for FE to display at the bottom
    data: {
      stdout?: string;
      stderr?: string;
      [key: string]: unknown


    };

  }

  // Completed is sent when the terminal exits.
  completed?: {
    status: "success" | "failure";
    message: string;
    data?: {
      [key: string]: unknown
    }
    stdout?: string;
    stderr?: string;
  }
}

type ProgressState = "correct" | "incorrect" | "in-progress" | "not-started";
type ExerciseProgress = {
  status: ProgressState
}
type ProgressData = {
  [exerciseIdentifier: string]: ExerciseProgress
}