import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  spawn: (cols: number, rows: number) => ipcSend('pty-spawn', { cols, rows }),
  write: (data: string) => ipcSend('pty-write', { data }),
  onData: (callback: (data: string) => void) => ipcOn('pty-data', callback),
  resize: (cols: number, rows: number) => ipcSend('pty-resize', { cols, rows }),

} satisfies Window['electron'])

// Note: you canNOT import external files into the preload script, due to Electron sandboxing
function ipcInvoke<Key extends keyof IpcHandlerChannelMapping>(
  key: Key
): Promise<IpcHandlerChannelMapping[Key]> {
  return ipcRenderer.invoke(key);
}

function ipcOn<Key extends keyof IpcHandlerChannelMapping>(
  key: Key,
  callback: (payload: IpcHandlerChannelMapping[Key]) => void
) {
  const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on(key, cb);
  return () => ipcRenderer.off(key, cb);
}

function ipcSend<Key extends keyof IpcHandlerChannelMapping>(
  key: Key,
  payload: IpcHandlerChannelMapping[Key]
) {
  ipcRenderer.send(key, payload);
}