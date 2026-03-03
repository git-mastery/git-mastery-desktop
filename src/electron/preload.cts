import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  testImplementation: () => {
    console.log("testImplementation");
  },
  spawn: () => ipcRenderer.send('pty-spawn'),
  write: (data: string) => ipcRenderer.send('pty-write', data),
  onData: (callback: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('pty-data', handler);
    return () => ipcRenderer.removeListener('pty-data', handler);
  },
  resize: (cols: number, rows: number) => ipcRenderer.send('pty-resize', { cols, rows })
})
