import { WebContentsView, BrowserWindow } from "electron"
import { ipcMainOn } from "../utils/util.js"

let wcv: WebContentsView | null = null

let isHidden = true;
let bounds = { x: 0, y: 0, width: 0, height: 0 }

function getOrCreateWcv(mainWindow: BrowserWindow): WebContentsView {
  if (!wcv) {
    wcv = new WebContentsView()

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

function injectCustomElements(mainWindow: BrowserWindow) {
  const wcv = getOrCreateWcv(mainWindow);
  const handler = async () => {
    // Everything DOM-related must be inside the JS string
    const exerciseIdentifier = await wcv.webContents.executeJavaScript(`
      (function() {
        const el = document.querySelector('div[id^="ex-download-info-"]');
        if (!el) return null;
        const id = el.id.replace("ex-download-info-", "");
        const btn = document.createElement("button");
        btn.textContent = "Start Exercise";
        btn.style.cssText = "padding:8px 16px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer;";
        btn.addEventListener("click", () => console.log("WCV_START_EXERCISE:" + id));
        el.replaceWith(btn);
        return id; // return primitive — this is safe
      })()
    `);
    if (exerciseIdentifier) {
      console.log("[wcv] injected button for exercise:", exerciseIdentifier);
    }
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

  ipcMainOn("wcv-navigate", async ({ url }: { url: string }) => {
    console.log("[info] wcv-navigate event received")
    getOrCreateWcv(mainWindow).webContents.loadURL(url)

    // // inject custom HTML and css
    // // TODO: Investigate whether this can be tied the dom-ready event
    // const exerciseDownloadButton = await getOrCreateWcv(mainWindow).webContents.executeJavaScript(`document.querySelector('div[id^="ex-download-info-"]')`);
    // if (!exerciseDownloadButton) return;

    // const id = exerciseDownloadButton.id;
    // const exerciseIdentifier = id.replace("ex-download-info-", "");

    // // replace with a button
    // const div = document.createElement("div");
    // div.id = "exercise-download-button";
    // div.textContent = "Start Exercise";
    // exerciseDownloadButton.replaceWith(div);
    injectCustomElements(mainWindow)

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
