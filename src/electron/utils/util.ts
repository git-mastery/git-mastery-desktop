import { ipcMain, WebFrameMain } from "electron";
import { pathToFileURL } from "url";
import { getUIPath } from "../pathResolver.js";

export function isDev() {
  return process.env.NODE_ENV === "development";
}

export function ipcMainHandle<Key extends keyof IpcInvokeChannelMapping>(
  key: Key,
  handler: (payload: IpcInvokeChannelMapping[Key]["request"]) => any
) {
  ipcMain.handle(key, (event, payload) => {
    validateEventFrame(event.senderFrame!);
    return handler(payload);
  });
}

export function ipcMainOn<Key extends keyof IpcHandlerChannelMapping>(
  key: Key,
  handler: (payload: IpcHandlerChannelMapping[Key]) => void
) {
  ipcMain.on(key, (event, payload) => {
    validateEventFrame(event.senderFrame!);
    return handler(payload);
  });
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === 'localhost:5123') {
    return;
  }
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error('Malicious event');
  }
}