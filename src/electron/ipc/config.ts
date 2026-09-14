import { dialog, BrowserWindow } from "electron";
import { getConfig, saveConfig } from "../storage.js";
import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import {
  getExerciseProgress,
  resetExerciseProgressCache,
} from "../exerciseProgress.js";
import fs from "fs";
import path from "path";

export function setupConfigIpc(mainWindow: BrowserWindow) {
  ipcMainHandle("select-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMainOn("set-data-directory", ({ directory }) => {
    console.log("[info] set-data-directory event: ", directory);
    saveConfig({ dataDirectory: directory });
    resetExerciseProgressCache();
  });

  ipcMainHandle("get-data-directory", async () => {
    return getConfig().dataDirectory || null;
  });

  ipcMainHandle("check-exercise-folder", async () => {
    const dataDirectory = getConfig().dataDirectory || null;
    if (!dataDirectory) {
      return { dataDirectory: null, exercisesPath: null, ready: false };
    }

    const exercisesPath = path.join(dataDirectory, "gitmastery-exercises");
    return {
      dataDirectory,
      exercisesPath,
      ready: fs.existsSync(exercisesPath),
    };
  });

  ipcMainHandle("get-downloaded-exercises", async () => {
    return getExerciseProgress();
  });
}
