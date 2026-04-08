import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal preload script for the WebContentsView (wcv-preload.cts).
 *
 * This is intentionally separate from the main preload.cts:
 * - The WCV loads external pages (e.g. git-mastery.org) that have no
 *   access to the main app's contextBridge / window.electron API.
 * - This preload exposes only what injected JS needs: a single `send`
 *   function to fire IPC events back to the main process.
 *
 * Communication pattern:
 *   Injected JS  →  window.wcvBridge.send(channel, data)
 *               →  ipcRenderer.send(channel, data)
 *               →  wcv.webContents.on("ipc-message", ...)  [main process]
 *
 * WHY contextBridge instead of window.wcvBridge = ...:
 *   Electron enables contextIsolation by default. In an isolated context, the
 *   preload's `window` is a separate object from the page's `window`, so direct
 *   property assignment is invisible to page JS. contextBridge.exposeInMainWorld
 *   is the only way to safely cross that boundary.
 *
 * NOTE: Do NOT expose ipcRenderer directly. Only expose the minimum surface needed.
 */

contextBridge.exposeInMainWorld("wcvBridge", {
  send: (channel: string, data: Record<string, unknown>) => {
    ipcRenderer.send(channel, data);
  },
});
