import { WebContentsView, BrowserWindow } from "electron"
import { ipcMainOn } from "../utils/util.js"
import { getWcvPreloadPath } from "../pathResolver.js"

let wcv: WebContentsView | null = null

let isHidden = true;
let bounds = { x: 0, y: 0, width: 0, height: 0 }

function getOrCreateWcv(mainWindow: BrowserWindow): WebContentsView {
  if (!wcv) {
    wcv = new WebContentsView({
      webPreferences: {
        // Loads a minimal preload that exposes window.wcvBridge.send()
        // so injected JS can fire IPC events back to the main process.
        // See: src/electron/wcv-preload.cts
        preload: getWcvPreloadPath(),
      }
    })

    mainWindow.contentView.addChildView(wcv)

    wcv.webContents.on("dom-ready", () => {
      console.log("finished loading internal view")
      wcv!.webContents.insertCSS(`
        nav { display: none !important; }
      `)
    })

  }
  return wcv
}

/**
 * Injects a "Start Exercise" button into the WCV page, replacing the
 * matching download-info div. When clicked, the button uses window.wcvBridge
 * (exposed by wcv-preload.cts) to fire an IPC event back to the main process.
 *
 * Returns a cleanup function that removes the dom-ready listener.
 */
function injectCustomElements(mainWindow: BrowserWindow, onStartExercise: (exerciseId: string) => void) {
  const wcv = getOrCreateWcv(mainWindow);

  // Listen for IPC messages sent from the WCV page via window.wcvBridge.send()
  wcv.webContents.on("ipc-message", (_event, channel, ...args) => {
    if (channel === "wcv-start-exercise") {
      const { exerciseId } = args[0] as { exerciseId: string };
      console.log("[wcv] start exercise clicked:", exerciseId);
      onStartExercise(exerciseId);
    }
  });

  const handler = async () => {
    // All DOM manipulation must live inside the executeJavaScript string —
    // DOM nodes cannot cross the process boundary.
    // window.wcvBridge is available because wcv-preload.cts is loaded.
    await wcv.webContents.executeJavaScript(`
      (function() {
        const el = document.querySelector('div[id^="ex-download-info-"]');
        if (!el) return;
        const id = el.id.replace("ex-download-info-", "");
        const btn = document.createElement("button");
        btn.textContent = "Start Exercise";
        btn.style.cssText = "padding:8px 16px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer;";
        btn.addEventListener("click", () => {
          window.wcvBridge.send("wcv-start-exercise", { exerciseId: id });
        });
        el.replaceWith(btn);
      })()
    `);
  };

  wcv.webContents.addListener("dom-ready", handler);
  return () => wcv.webContents.removeListener("dom-ready", handler);
}
export function setupWebContentsViewIpc(mainWindow: BrowserWindow) {
  ipcMainOn("wcv-size", ({ x, y, width, height }: { x: number, y: number, width: number, height: number }) => {
    console.log("[info] wcv-size event received")
    getOrCreateWcv(mainWindow)
    bounds = { x, y, width, height }
  })

  ipcMainOn("wcv-show", () => {
    console.log("[info] wcv-show event received")
    const wcv = getOrCreateWcv(mainWindow)
    wcv.setBounds(bounds)
    isHidden = false
  })

  ipcMainOn("wcv-navigate", ({ url }: { url: string }) => {
    console.log("[info] wcv-navigate event received")
    getOrCreateWcv(mainWindow).webContents.loadURL(url)
    injectCustomElements(mainWindow, (exerciseId) => {
      // TODO: call your gitmastery start-exercise function here
      console.log("[wcv] TODO: start exercise", exerciseId)
    })
  })

  // Temporarily hide the wcv, whenever we need to display a full screen modal.
  ipcMainOn("wcv-hide", () => {
    // reset to default
    getOrCreateWcv(mainWindow).setBounds({ x: 0, y: 0, width: 0, height: 0 })
    isHidden = true
  })

  // Clean up when the window is closed
  mainWindow.on("closed", () => {
    wcv = null
  })
}
