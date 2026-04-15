import { app } from "electron";
import path from "path";
import { isDev } from "./utils/util.js";

export function getPreloadPath() {
  return path.join(
    app.getAppPath(),
    "dist-electron",
    "preload.cjs"
  )
}

/**
 * Returns the path to the WebContentsView-specific preload script.
 * This is a separate, minimal preload usåed only for the WCV (external pages).
 * It exposes window.wcvBridge.send() so injected JS can fire IPC events.
 */
export function getWcvPreloadPath() {
  return path.join(
    app.getAppPath(),
    "dist-electron",
    "wcv-preload.cjs"
  )
}


export function getUIPath() {
  return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getAssetPath() {
  return path.join(app.getAppPath(), 'src/assets');
}