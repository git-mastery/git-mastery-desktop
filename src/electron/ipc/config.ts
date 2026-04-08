import { dialog, ipcMain, BrowserWindow } from 'electron';
import { getConfig, getUserStoragePath, saveConfig } from '../storage.js';
import { ipcMainHandle } from '../utils/util.js';
import { getExerciseDirectory } from '../utils/cli/getters.js';
import fs from 'fs';
import path from 'path';

export function setupConfigIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('select-file', async (_, fileType: string) => {
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

  // ipcMain.on('set-exe-location', (_, { location }) => {
  //   saveConfig({ exeLocation: location });
  // });

  ipcMain.on('set-exercise-directory', (_, { directory }) => {
    console.log("[info] set-exercise-directory event: ", directory)
    saveConfig({ dataDirectory: directory });
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
