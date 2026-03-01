import electron from "electron";

electron.contextBridge.exposeInMainWorld("electron", {
  testImplementation: () => {
    console.log("testImplementation");
  }
})
