import { WebContentsView, BrowserWindow } from "electron"
import { ipcMainOn } from "../util.js"

let wcv: WebContentsView | null = null

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

export function setupWebContentsViewIpc(mainWindow: BrowserWindow) {
  ipcMainOn("wcv-display", ({ x, y, width, height }: { x: number, y: number, width: number, height: number }) => {
    console.log("[info] wcv-display event received")
    getOrCreateWcv(mainWindow).setBounds({ x, y, width, height })
  })

  ipcMainOn("wcv-navigate", ({ url }: { url: string }) => {
    console.log("[info] wcv-navigate event received")
    getOrCreateWcv(mainWindow).webContents.loadURL(url)
  })

  // Clean up when the window is closed
  mainWindow.on("closed", () => {
    wcv = null
  })
}
