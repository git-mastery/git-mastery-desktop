import { dialog, BrowserWindow } from "electron";
import { clearExerciseRoot, getConfig, saveConfig } from "../storage.js";
import { ipcMainHandle } from "../utils/util.js";
import {
  getExerciseProgress,
  resetExerciseProgressCache,
} from "../exerciseProgress.js";
import { resolveExerciseRootPick } from "../startPrereqs.js";

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

  ipcMainHandle("get-exercise-root", async () => {
    return { root: getConfig().exercisesRoot ?? null };
  });

  ipcMainHandle("set-exercise-root", async ({ directory }) => {
    const resolved = resolveExerciseRootPick(directory);
    if (!resolved.ok) return resolved;

    saveConfig({ exercisesRoot: resolved.root });
    resetExerciseProgressCache();
    return resolved;
  });

  ipcMainHandle("clear-exercise-root", async () => {
    clearExerciseRoot();
    resetExerciseProgressCache();
    return true;
  });

  ipcMainHandle("get-downloaded-exercises", async () => {
    return getExerciseProgress();
  });
}
