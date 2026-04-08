import { app } from "electron";
import path from "path";
import { isDev } from "./utils/util.js";

export function getPreloadPath() {
  // reference the video at 52 minutes.
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "dist-electron",
    "preload.cjs"
  )
}

/**
 * Returns the path to the WebContentsView-specific preload script.
 * This is a separate, minimal preload used only for the WCV (external pages).
 * It exposes window.wcvBridge.send() so injected JS can fire IPC events.
 */
export function getWcvPreloadPath() {
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "dist-electron",
    "wcv-preload.cjs"
  )
}


export function getUIPath() {
  return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getAssetPath() {
  return path.join(app.getAppPath(), isDev() ? '.' : '..', '/src/assets');
}