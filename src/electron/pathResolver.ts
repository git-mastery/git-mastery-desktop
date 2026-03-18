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


export function getUIPath() {
  return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getAssetPath() {
  return path.join(app.getAppPath(), isDev() ? '.' : '..', '/src/assets');
}