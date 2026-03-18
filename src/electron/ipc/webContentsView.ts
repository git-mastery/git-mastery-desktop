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
