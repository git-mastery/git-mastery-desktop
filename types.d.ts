interface Window {
  electron: {
    spawn: (cols: number, rows: number) => void;
    write: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    resize: (cols: number, rows: number) => void;

    // for Web Contents View
    setContentsViewSize: (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => void;
    navigate: (url: string) => void;
    hide: () => void;
    show: () => void;
    onWcvLoading: (callback: (loading: boolean) => void) => () => void;
    onWcvUrlChanged: (callback: (url: string) => void) => () => void;
    getSitePrefs: () => Promise<SiteViewPrefs | null>;
    setSitePrefs: (
      prefs: SiteViewPrefs & { reload: boolean },
    ) => Promise<boolean>;
    setAppTheme: (payload: {
      preference: SitePageTheme;
      resolved: "light" | "dark";
    }) => void;

    // for configuration
    selectFolder: () => Promise<string | null>;
    getExerciseRoot: () => Promise<{ root: string | null }>;
    setExerciseRoot: (
      directory: string,
    ) => Promise<{ ok: true; root: string } | { ok: false; error: string }>;
    clearExerciseRoot: () => Promise<boolean>;
    checkStartPrereqs: () => Promise<{
      step: FirstRunStep | null;
      tools: ToolsStatus;
    }>;
    markStartIntroSeen: () => Promise<boolean>;

    // for retrieving config settings of the backend (electron app)
    // just an array of folder names
    getDownloadedExercises: () => Promise<ProgressData>;

    // TODO: see if we can type `originalCommand`
    onGitMasteryTaskData: (
      callback: (originalCommand: string, data: GitMasteryTaskData) => void,
    ) => () => void;

    // TODO: decide whether this command should return when (1) task starts or (2) task completes
    startGitMasteryTask: (command: string) => Promise<boolean>;
    startExercise: (exerciseIdentifier: string) => Promise<StartExerciseResult>;

    onStartExerciseStarted: (
      callback: (payload: StartExerciseStarted) => void,
    ) => () => void;
    onStartExerciseResult: (
      callback: (result: StartExerciseResult) => void,
    ) => () => void;
    onVerifyBlocked: (callback: (payload: VerifyBlocked) => void) => () => void;

    // for opening URLs in the system's default browser
    openExternal: (url: string) => void;
  };
}

/**
 * One-way channels (Renderer -> Main).
 * Used with ipcSend and ipcOn.
 * No response is expected.
 */
type IpcHandlerChannelMapping = {
  "pty-spawn": { cols: number; rows: number };
  "pty-write": { data: string };
  "pty-resize": { cols: number; rows: number };
  "pty-data": string;
  "wcv-navigate": { url: string };
  "wcv-show": null;
  "wcv-size": { x: number; y: number; width: number; height: number };
  "wcv-hide": null;
  "wcv-loading": { loading: boolean };
  "wcv-url-changed": { url: string };
  "set-app-theme": {
    preference: SitePageTheme;
    resolved: "light" | "dark";
  };

  "gitmastery-task-data": { originalCommand: string; data: GitMasteryTaskData };
  "start-exercise-started": StartExerciseStarted;
  "start-exercise-result": StartExerciseResult;
  "verify-blocked": VerifyBlocked;

  // open a URL in the system default browser
  "open-external": { url: string };
};

type IIpcInvoke<U, V> = {
  request: U;
  response: V;
};

/**
 * Two-way channels (Renderer -> Main -> Renderer).
 * Used with ipcInvoke.
 * Each entry has a typed request payload and a typed response value.
 */
type IpcInvokeChannelMapping = {
  // config
  "select-folder": IIpcInvoke<null, string | null>;
  "get-exercise-root": IIpcInvoke<null, { root: string | null }>;
  "set-exercise-root": IIpcInvoke<
    { directory: string },
    { ok: true; root: string } | { ok: false; error: string }
  >;
  "clear-exercise-root": IIpcInvoke<null, boolean>;
  "check-start-prereqs": IIpcInvoke<
    null,
    { step: FirstRunStep | null; tools: ToolsStatus }
  >;
  "mark-start-intro-seen": IIpcInvoke<null, boolean>;

  "wcv-get-site-prefs": IIpcInvoke<null, SiteViewPrefs | null>;
  "wcv-set-site-prefs": IIpcInvoke<
    SiteViewPrefs & { reload: boolean },
    boolean
  >;

  // gitmastery
  "get-downloaded-exercises": IIpcInvoke<null, ProgressData>;
  "gitmastery-start-task": IIpcInvoke<{ command: string }, boolean>;
  "gitmastery-start-exercise": IIpcInvoke<
    { exerciseIdentifier: string },
    StartExerciseResult
  >;
};

/** A first-Start step that is still outstanding. */
type FirstRunStep = "intro" | "tools" | "folder";

type ToolsStatus = {
  cli: boolean;
  /** Null off Windows, where Git Bash is not required. */
  gitBash: boolean | null;
};

/** CustardUI view state persisted on git-mastery.org as `git-mastery-custardUI-state`. */
type CustardUIState = {
  shownToggles?: string[];
  peekToggles?: string[];
  hiddenToggles?: string[];
  tabs?: Record<string, string>;
  placeholders?: Record<string, string>;
};

/** Desktop-owned copy of CustardUI prefs applied into the embedded site. */
type SitePageTheme = "light" | "dark" | "system";

type SiteViewPrefs = {
  state: CustardUIState;
  tabNavsVisible: boolean;
  /** Shared Light / Dark / System preference for chrome and MarkBind. */
  theme?: SitePageTheme;
};

/** Start was clicked; the renderer shows a loading toast until the result. */
type StartExerciseStarted = {
  exerciseIdentifier: string;
};

/** Outcome of moving the terminal into an exercise's working directory. */
type StartExerciseResult = {
  ok: boolean;
  exerciseIdentifier?: string;
  cwd?: string;
  error?: string;
  downloaded?: boolean;
  needsRestart?: boolean;
  /** Set when Start stopped because a first-run step is still outstanding. */
  firstRunStep?: FirstRunStep;
};

/** Verify was clicked while the terminal was not in the exercise directory. */
type VerifyBlocked = {
  exerciseIdentifier: string;
};

type GitMasteryTaskData = {
  // specific to `download` channels
  exerciseIdentifier?: string;

  // Error is sent when the terminal displays an error while running an operation.
  // In this case, the terminal is still running.
  error?: {
    code: number;
    message: string;
  };

  // Success is sent when there is a line of code written to stdout.
  // Note that the terminal is still running.
  success?: {
    message: string; // purely for FE to display at the bottom
    data: {
      stdout?: string;
      stderr?: string;
      [key: string]: unknown;
    };
  };

  // Completed is sent when the terminal exits.
  completed?: {
    status: "success" | "failure";
    message: string;
    data?: {
      [key: string]: unknown;
    };
    stdout?: string;
    stderr?: string;
  };
};

type ProgressState = "downloaded" | "in-progress" | "completed";
type ExerciseProgress = {
  status: ProgressState;
};
type ProgressData = {
  [exerciseIdentifier: string]: ExerciseProgress;
};
