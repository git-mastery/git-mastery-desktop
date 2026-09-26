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
    checkStartPrereqs: (options?: { skipIntro?: boolean }) => Promise<{
      step: FirstRunStep | null;
      tools: ToolsStatus;
    }>;
    hideStartIntro: () => Promise<boolean>;

    // for retrieving config settings of the backend (electron app)
    // just an array of folder names
    getDownloadedExercises: () => Promise<ProgressData>;

    // TODO: see if we can type `originalCommand`
    onGitMasteryTaskData: (
      callback: (originalCommand: string, data: GitMasteryTaskData) => void,
    ) => () => void;

    // TODO: decide whether this command should return when (1) task starts or (2) task completes
    startGitMasteryTask: (command: string) => Promise<boolean>;
    startExercise: (
      exerciseIdentifier: string,
      options?: { skipIntro?: boolean },
    ) => Promise<StartExerciseResult>;

    onStartExerciseStarted: (
      callback: (payload: StartExerciseStarted) => void,
    ) => () => void;
    onStartExerciseResult: (
      callback: (result: StartExerciseResult) => void,
    ) => () => void;
    onVerifyBlocked: (callback: (payload: VerifyBlocked) => void) => () => void;

    // for opening URLs in the system's default browser
    openExternal: (url: string) => void;

    // AI hints: bring-your-own-key provider settings
    getAiSettings: () => Promise<AiSettingsView>;
    saveAiSettings: (input: AiSettingsInput) => Promise<AiSaveResult>;

    // AI hints: docked chat panel
    onAiHintsOpen: (callback: (session: AiHintsSession) => void) => () => void;
    previewAiContext: (exerciseId: string) => Promise<AiContextBlock[]>;

    // Carries the AI SDK's UI message stream between main and the chat panel.
    // Consumed by IpcChatTransport, not by components directly.
    aiChatStart: (payload: {
      streamId: string;
      exerciseId: string;
      messages: GitMasteryUIMessage[];
    }) => Promise<AiChatStartResult>;
    aiChatAbort: (streamId: string) => void;
    onAiChatChunk: (
      callback: (streamId: string, chunk: AiChatChunk) => void,
    ) => () => void;
    onAiChatEnd: (callback: (streamId: string) => void) => () => void;
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

  "ai-hints-open": AiHintsSession;

  "ai-chat-abort": { streamId: string };
  "ai-chat-chunk": { streamId: string; chunk: AiChatChunk };
  "ai-chat-end": { streamId: string };
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
    { skipIntro?: boolean },
    { step: FirstRunStep | null; tools: ToolsStatus }
  >;
  "hide-start-intro": IIpcInvoke<null, boolean>;

  "wcv-get-site-prefs": IIpcInvoke<null, SiteViewPrefs | null>;
  "wcv-set-site-prefs": IIpcInvoke<
    SiteViewPrefs & { reload: boolean },
    boolean
  >;

  // gitmastery
  "get-downloaded-exercises": IIpcInvoke<null, ProgressData>;
  "gitmastery-start-task": IIpcInvoke<{ command: string }, boolean>;
  "gitmastery-start-exercise": IIpcInvoke<
    { exerciseIdentifier: string; skipIntro?: boolean },
    StartExerciseResult
  >;

  "ai-get-settings": IIpcInvoke<null, AiSettingsView>;
  "ai-save-settings": IIpcInvoke<AiSettingsInput, AiSaveResult>;
  "ai-preview-context": IIpcInvoke<{ exerciseId: string }, AiContextBlock[]>;

  "ai-chat-start": IIpcInvoke<
    { streamId: string; exerciseId: string; messages: GitMasteryUIMessage[] },
    AiChatStartResult
  >;
};

type AiProviderId = "openrouter" | "openai" | "anthropic" | "google" | "custom";

/**
 * What the settings panel needs to render a provider. The client that talks to
 * it lives in main, which is the only process that ever holds a key in use.
 */
type AiProviderInfo = {
  id: AiProviderId;
  label: string;
  description: string;
  /** Null when there is no sensible default and the learner must name one. */
  defaultModel: string | null;
  keyUrl: string | null;
  keyPlaceholder: string;
  keyRequired: boolean;
  baseUrlRequired: boolean;
  baseUrlPlaceholder: string | null;
};

type AiProviderSettings = {
  model: string;
  baseUrl: string;
  apiKey: string;
};

type AiSettingsView = {
  providers: AiProviderInfo[];
  activeProvider: AiProviderId;
  /** Kept per provider, so flipping the picker does not lose another's key. */
  saved: Partial<
    Record<AiProviderId, AiProviderSettings & { keyEncrypted: boolean }>
  >;
  encryptionAvailable: boolean;
};

type AiSettingsInput = { provider: AiProviderId } & AiProviderSettings;

type AiSaveResult =
  { ok: true; encrypted: boolean } | { ok: false; error: string };

type AiHintsKind = "exercise" | "hands-on";

/** Which exercise or hands-on practical the docked panel is helping with. */
type AiHintsSession = {
  exerciseId: string;
  kind: AiHintsKind;
  title: string;
};

type AiContextBlock = {
  id: string;
  label: string;
  text: string;
};

/**
 * Conversation shape shared by main and the chat panel. The `context` data
 * part carries what was scraped and sent for a turn, so the panel's context
 * chip is attached to the message it actually applied to.
 */
type GitMasteryUIMessage = import("ai").UIMessage<
  never,
  { context: AiContextBlock[] }
>;

type AiChatChunk = import("ai").UIMessageChunk;

type AiChatStartResult = { ok: true } | { ok: false; error: string };

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
