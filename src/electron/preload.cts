import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  // Terminal
  spawn: (cols: number, rows: number) => ipcSend("pty-spawn", { cols, rows }),
  write: (data: string) => ipcSend("pty-write", { data }),
  onData: (callback: (data: string) => void) => ipcOn("pty-data", callback),
  resize: (cols: number, rows: number) => ipcSend("pty-resize", { cols, rows }),

  // WebContentsView
  navigate: (url: string) => ipcSend("wcv-navigate", { url }),
  setContentsViewSize: (x: number, y: number, width: number, height: number) =>
    ipcSend("wcv-size", { x, y, width, height }),
  hide: () => ipcSend("wcv-hide", null),
  show: () => ipcSend("wcv-show", null),
  onWcvLoading: (callback: (loading: boolean) => void) =>
    ipcOn("wcv-loading", ({ loading }) => callback(loading)),
  onWcvUrlChanged: (callback: (url: string) => void) =>
    ipcOn("wcv-url-changed", ({ url }) => callback(url)),
  getSitePrefs: () => ipcInvoke("wcv-get-site-prefs", null),
  setSitePrefs: (prefs: SiteViewPrefs & { reload: boolean }) =>
    ipcInvoke("wcv-set-site-prefs", prefs),
  setAppTheme: (payload: {
    preference: SitePageTheme;
    resolved: "light" | "dark";
  }) => ipcSend("set-app-theme", payload),

  // Config
  selectFolder: () => ipcInvoke("select-folder", null),
  getExerciseRoot: () => ipcInvoke("get-exercise-root", null),
  setExerciseRoot: (directory: string) =>
    ipcInvoke("set-exercise-root", { directory }),
  clearExerciseRoot: () => ipcInvoke("clear-exercise-root", null),
  checkStartPrereqs: () => ipcInvoke("check-start-prereqs", null),
  markStartIntroSeen: () => ipcInvoke("mark-start-intro-seen", null),

  // GitMastery
  getDownloadedExercises: () => ipcInvoke("get-downloaded-exercises", null),

  startGitMasteryTask: (command: string) =>
    ipcInvoke("gitmastery-start-task", { command }),
  // onGitMasteryTaskData is a subscription, so it returns a cleanup function
  // GM_TASK_DATA_CHANNEL is inlined here (not imported) due to the Electron build boundary rule
  onGitMasteryTaskData: (
    callback: (originalCommand: string, data: GitMasteryTaskData) => void,
  ) =>
    ipcOn("gitmastery-task-data", (payload) =>
      callback(payload.originalCommand, payload.data),
    ),
  startExercise: (exerciseIdentifier: string) =>
    ipcInvoke("gitmastery-start-exercise", { exerciseIdentifier }),
  onStartExerciseStarted: (callback: (payload: StartExerciseStarted) => void) =>
    ipcOn("start-exercise-started", callback),
  onStartExerciseResult: (callback: (result: StartExerciseResult) => void) =>
    ipcOn("start-exercise-result", callback),
  onVerifyBlocked: (callback: (payload: VerifyBlocked) => void) =>
    ipcOn("verify-blocked", callback),

  // Shell
  openExternal: (url: string) => ipcSend("open-external", { url }),

  // OpenRouter key
  setOpenRouterKey: (key: string) => ipcInvoke("set-openrouter-key", { key }),
  getOpenRouterKey: () => ipcInvoke("get-openrouter-key", null),
  hasOpenRouterKey: () => ipcInvoke("has-openrouter-key", null),
  clearOpenRouterKey: () => ipcInvoke("clear-openrouter-key", null),
  validateOpenRouterKey: (key?: string) =>
    ipcInvoke("validate-openrouter-key", { key }),

  // AI hints chat
  chatDragBegin: () => ipcInvoke("chat-drag-begin", null),
  chatDragEnd: (rect: ChatPanelRect) => ipcInvoke("chat-drag-end", rect),
  chatClose: () => ipcSend("chat-close", null),
  getChatSession: () => ipcInvoke("get-chat-session", null),
  onChatSession: (callback: (session: ChatSession) => void) =>
    ipcOn("chat-session", callback),

  // AI SDK UI message stream
  aiChatStart: (payload: {
    streamId: string;
    exerciseId: string;
    messages: GitMasteryUIMessage[];
  }) => ipcInvoke("ai-chat-start", payload),
  aiChatAbort: (streamId: string) => ipcSend("ai-chat-abort", { streamId }),
  onAiChatChunk: (callback: (streamId: string, chunk: AiChatChunk) => void) =>
    ipcOn("ai-chat-chunk", ({ streamId, chunk }) => callback(streamId, chunk)),
  onAiChatEnd: (callback: (streamId: string) => void) =>
    ipcOn("ai-chat-end", ({ streamId }) => callback(streamId)),
} satisfies Window["electron"]);

// Note: you canNOT import external files into the preload script, due to Electron sandboxing
/**
 * Bidirectional / Two-Way communication (Request-Response).
 * Used for fetching data from the system or performing tasks that return a value.
 * Returns a Promise.
 */
function ipcInvoke<Key extends keyof IpcInvokeChannelMapping>(
  key: Key,
  payload: IpcInvokeChannelMapping[Key]["request"],
): Promise<IpcInvokeChannelMapping[Key]["response"]> {
  return ipcRenderer.invoke(key, payload);
}

/**
 * Subscription / Listener (Main -> Renderer).
 * Used for waiting for the Main process to trigger events spontaneously.
 * Returns a cleanup function to unsubscribe and prevent memory leaks.
 */
function ipcOn<Key extends keyof IpcHandlerChannelMapping>(
  key: Key,
  callback: (payload: IpcHandlerChannelMapping[Key]) => void,
) {
  const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on(key, cb);
  return () => ipcRenderer.off(key, cb);
}

/**
 * Unidirectional / One-Way communication (Renderer -> Main).
 * "Fire and forget" - used for telling the Main process to perform an action
 * where the UI doesn't need to wait for a result.
 */
function ipcSend<Key extends keyof IpcHandlerChannelMapping>(
  key: Key,
  payload: IpcHandlerChannelMapping[Key],
) {
  ipcRenderer.send(key, payload);
}
