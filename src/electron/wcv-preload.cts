import { ipcRenderer } from "electron";

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
 * NOTE: Do NOT expose ipcRenderer directly. Only expose the minimum surface needed.
 */

// Use a type-only interface so we don't import from shared dirs
// (Electron build boundary rule: no cross-directory imports from src/electron/)
interface WcvBridge {
  send: (channel: string, data: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    wcvBridge: WcvBridge;
  }
}

window.wcvBridge = {
  send: (channel: string, data: Record<string, unknown>) => {
    ipcRenderer.send(channel, data);
  },
};
