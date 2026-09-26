import { shell } from "electron";
import { ipcMainOn } from "../utils/util.js";

export const setupPrereqIpc = () => {
  // Open a URL in the system's default browser.
  ipcMainOn("open-external", ({ url }: { url: string }) => {
    shell.openExternal(url);
  });
};
