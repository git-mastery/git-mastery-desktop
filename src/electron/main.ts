import { app, BrowserWindow } from "electron";
import path from 'path';
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";

type test = string;

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath()
    }
  });
  console.log("isDev: ", isDev())
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"))
  }
})
