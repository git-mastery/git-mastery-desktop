import { dialog, ipcMain, BrowserWindow } from 'electron';
import { saveConfig } from '../storage.js';

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

  ipcMain.on('set-exe-location', (_, { location }) => {
    saveConfig({ exeLocation: location });
  });

  ipcMain.on('set-exercise-directory', (_, { directory }) => {
    console.log("[info] set-exercise-directory event: ", directory)
    saveConfig({ exerciseDirectory: directory });
  });
}
