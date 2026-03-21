import { app, BrowserView, BrowserWindow } from "electron";
import path from 'path';
import { isDev } from "./utils/util.js";
import { getPreloadPath } from "./pathResolver.js";
import { setupTerminalIpc } from "./ipc/terminal.js";
import { setupGitmasteryIpc } from "./ipc/gitmastery.js";
import { setupWebContentsViewIpc } from "./ipc/webContentsView.js";
import { setupConfigIpc } from "./ipc/config.js";

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath()
    }
  });
  setupTerminalIpc(mainWindow);
  setupGitmasteryIpc(mainWindow);
  setupWebContentsViewIpc(mainWindow);
  setupConfigIpc(mainWindow);

  console.log("isDev: ", isDev())
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"))
  }
})
