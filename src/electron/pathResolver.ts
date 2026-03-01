import { app } from "electron";
import path from "path";
import { isDev } from "./util.js";

export function getPreloadPath() {
  // reference the video at 52 minutes.
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "dist-electron",
    "preload.cjs"
  )
}