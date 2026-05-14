import { dialog, ipcMain, BrowserWindow } from 'electron';
import { getConfig, getUserStoragePath, saveConfig } from '../storage.js';
import { ipcMainHandle, ipcMainOn } from '../utils/util.js';
import { getExerciseDirectory } from '../utils/cli/getters.js';
import fs from 'fs';
import path from 'path';

export function setupConfigIpc(mainWindow: BrowserWindow) {
  ipcMainHandle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMainHandle('select-file', async (fileType: string) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: fileType, extensions: [fileType] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMainOn('set-data-directory', ({ directory }) => {
    console.log("[info] set-data-directory event: ", directory)
    saveConfig({ dataDirectory: directory });
  });

  ipcMainHandle('get-data-directory', async () => {
    return getConfig().dataDirectory || null;
  });

  ipcMainHandle('get-downloaded-exercises', async () => {
    const exerciseDirectory = getExerciseDirectory();
    if (!fs.existsSync(exerciseDirectory)) {
      return {};
    }

    // only read folders
    const exercises = fs.readdirSync(exerciseDirectory).filter(file => {
      return fs.statSync(path.join(exerciseDirectory, file)).isDirectory();
    }).filter(exercise => exercise !== "progress");

    // read the progress file
    const progressFilePath = path.join(getUserStoragePath(), "progressData.json");
    // read from filePath and update`progressData`
    // TODO: add validation
    const rawData = fs.readFileSync(progressFilePath, 'utf8');
    let progressData: ProgressData = {}
    try {
      progressData = JSON.parse(rawData);
    } catch (err) {
      console.error("[error] failed to parse progress data: ", err);
    }
    console.log("[info] get-downloaded-exercises event: ", exercises)
    return progressData

    // return exercises.map(exercise => {
    //   return {
    //     exerciseKey: exercise,
    //     status: "not-started"
    //   }
    // });


  })
}
