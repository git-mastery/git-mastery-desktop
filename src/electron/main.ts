import { app, BrowserWindow } from "electron";
import path from "path";
import { isDev } from "./utils/util.js";
import { getPreloadPath } from "./pathResolver.js";
import { setupTerminalIpc } from "./ipc/terminal.js";
import { setupGitmasteryIpc } from "./ipc/gitmastery.js";
import { setupWebContentsViewIpc } from "./ipc/webContentsView.js";
import { setupConfigIpc } from "./ipc/config.js";
import { setupPrereqIpc } from "./ipc/setupPrereq.js";
import { setupChatViewIpc } from "./ipc/chatView.js";
import { setupAiIpc } from "./ipc/ai.js";
import { setupStartPrereqIpc } from "./startPrereqs.js";
import {
  readStoredThemePreference,
  resolveFromOs,
  setupTheme,
  THEME_BACKGROUND,
} from "./theme.js";

let mainWindow: BrowserWindow | null = null;

export function getMainWindow() {
  if (!mainWindow) {
    throw new Error("Main window not found");
  }
  return mainWindow;
}

app.on("ready", () => {
  const themePreference = readStoredThemePreference();
  const resolvedTheme = resolveFromOs(themePreference);

  mainWindow = new BrowserWindow({
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: THEME_BACKGROUND[resolvedTheme],
    webPreferences: {
      preload: getPreloadPath(),
    },
  });
  setupTheme(mainWindow);
  setupTerminalIpc(mainWindow);
  setupGitmasteryIpc(mainWindow);
  setupWebContentsViewIpc(mainWindow);
  setupConfigIpc(mainWindow);
  setupPrereqIpc();
  setupStartPrereqIpc();
  setupChatViewIpc(mainWindow);
  setupAiIpc();

  console.log("isDev: ", isDev());
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"));
  }
});
