import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  spawn: (cols: number, rows: number) => ipcSend('pty-spawn', { cols, rows }),
  write: (data: string) => ipcSend('pty-write', { data }),
  onData: (callback: (data: string) => void) => ipcOn('pty-data', callback),
  resize: (cols: number, rows: number) => ipcSend('pty-resize', { cols, rows }),
  navigate: (url: string) => ipcSend('wcv-navigate', { url }),
  setContentsViewSize: (x: number, y: number, width: number, height: number) => ipcSend('wcv-size', { x, y, width, height }),
  hide: () => ipcSend('wcv-hide', null),
  show: () => ipcSend('wcv-show', null),

  setExeLocation: (location: string) => ipcSend('set-exe-location', { location }),
  setExerciseDirectory: (directory: string) => ipcSend('set-exercise-directory', { directory }),
  selectFolder: () => ipcInvoke('select-folder', null),
  selectFile: () => ipcInvoke('select-file', "exe"),

  startGitMasteryTask: (command: string) => ipcInvoke('gitmastery-start-task', { command }),
  // onGitMasteryTaskData is a subscription, so it returns a cleanup function
  // GM_TASK_DATA_CHANNEL is inlined here (not imported) due to the Electron build boundary rule
  onGitMasteryTaskData: (callback: (originalCommand: string, data: GitMasteryTaskData) => void) => ipcOn('gitmastery-task-data', (payload) => callback(payload.originalCommand, payload.data)),
} satisfies Window['electron'])

// Note: you canNOT import external files into the preload script, due to Electron sandboxing
/**
 * Bidirectional / Two-Way communication (Request-Response).
 * Used for fetching data from the system or performing tasks that return a value.
 * Returns a Promise.
 */
function ipcInvoke<Key extends keyof IpcInvokeChannelMapping>(
  key: Key,
  payload: IpcInvokeChannelMapping[Key]["request"]
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
  callback: (payload: IpcHandlerChannelMapping[Key]) => void
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
  payload: IpcHandlerChannelMapping[Key]
) {
  ipcRenderer.send(key, payload);
}