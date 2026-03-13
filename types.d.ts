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
}

/**
 * Two-way channels (Renderer -> Main -> Renderer).
 * Used with ipcInvoke.
 * Each entry has a typed request payload and a typed response value.
 */
type IpcInvokeChannelMapping = {
  "select-folder": { request: null, response: string | null },
  "select-file": { request: string, response: string | null },
}