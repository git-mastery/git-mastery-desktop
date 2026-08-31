import { WebContentsView, type BrowserWindow } from "electron";
import { ipcMainHandle, ipcMainOn, isDev } from "../utils/util.js";
import { getPreloadPath, getUIPath } from "../pathResolver.js";

const VIEW_PAD = 12;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 480;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;

let chatView: WebContentsView | null = null;
let hostWindow: BrowserWindow | null = null;
let visible = false;
let panel: ChatPanelRect = {
  x: 24,
  y: 80,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
};
let currentSession: ChatSession | null = null;
let ready: Promise<void> | null = null;

function contentSize(): { width: number; height: number } {
  if (!hostWindow || hostWindow.isDestroyed()) {
    return { width: 1024, height: 680 };
  }
  const bounds = hostWindow.getContentBounds();
  return { width: bounds.width, height: bounds.height };
}

function clampPanel(rect: ChatPanelRect): ChatPanelRect {
  const { width: windowWidth, height: windowHeight } = contentSize();
  const width = Math.max(
    MIN_WIDTH,
    Math.min(rect.width, Math.max(MIN_WIDTH, windowWidth - VIEW_PAD * 2)),
  );
  const height = Math.max(
    MIN_HEIGHT,
    Math.min(rect.height, Math.max(MIN_HEIGHT, windowHeight - VIEW_PAD * 2)),
  );
  const maxX = Math.max(VIEW_PAD, windowWidth - width - VIEW_PAD);
  const maxY = Math.max(VIEW_PAD, windowHeight - height - VIEW_PAD);
  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, VIEW_PAD), maxX),
    y: Math.min(Math.max(rect.y, VIEW_PAD), maxY),
  };
}

function applyBounds() {
  if (!chatView) return;
  if (!visible) {
    chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }
  panel = clampPanel(panel);
  chatView.setBounds({
    x: Math.round(panel.x - VIEW_PAD),
    y: Math.round(panel.y - VIEW_PAD),
    width: Math.round(panel.width + VIEW_PAD * 2),
    height: Math.round(panel.height + VIEW_PAD * 2),
  });
}

function raiseView() {
  if (!hostWindow || hostWindow.isDestroyed() || !chatView) return;
  hostWindow.contentView.addChildView(chatView);
}

function getOrCreateChatView(mainWindow: BrowserWindow): WebContentsView {
  hostWindow = mainWindow;
  if (chatView) return chatView;

  chatView = new WebContentsView({
    webPreferences: {
      preload: getPreloadPath(),
    },
  });
  chatView.setBackgroundColor("#00000000");
  mainWindow.contentView.addChildView(chatView);
  chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  ready = new Promise((resolve) => {
    chatView!.webContents.once("did-finish-load", () => resolve());
  });

  chatView.webContents.on("did-finish-load", () => {
    if (currentSession) sendToChat("chat-session", currentSession);
  });

  chatView.webContents.on("did-fail-load", () => {
    if (!isDev() || !chatView) return;
    setTimeout(() => {
      void chatView?.webContents.loadURL("http://localhost:5123/#chat");
    }, 750);
  });

  if (isDev()) {
    void chatView.webContents.loadURL("http://localhost:5123/#chat");
  } else {
    void chatView.webContents.loadFile(getUIPath(), { hash: "chat" });
  }

  mainWindow.on("resize", () => {
    if (visible) applyBounds();
  });

  return chatView;
}

function formatExerciseTitle(exerciseId: string) {
  return exerciseId
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function sendToChat<Key extends keyof IpcHandlerChannelMapping>(
  channel: Key,
  payload: IpcHandlerChannelMapping[Key],
) {
  if (!chatView || chatView.webContents.isDestroyed()) return;
  chatView.webContents.send(channel, payload);
}

export async function showChat(exerciseId: string) {
  if (!hostWindow) return;
  getOrCreateChatView(hostWindow);
  if (ready) {
    await Promise.race([
      ready,
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  }

  currentSession = {
    exerciseId,
    exerciseTitle: formatExerciseTitle(exerciseId),
  };

  if (!visible) {
    const { width, height } = contentSize();
    panel = clampPanel({
      x: 24,
      y: 80,
      width: DEFAULT_WIDTH,
      height: Math.min(DEFAULT_HEIGHT, height - 104),
    });
    // Keep the default from covering a very narrow window.
    if (panel.x + panel.width > width - 24) {
      panel.x = Math.max(VIEW_PAD, width - panel.width - 24);
    }
  }

  visible = true;
  applyBounds();
  raiseView();
  sendToChat("chat-session", currentSession);
}

export function hideChat() {
  visible = false;
  applyBounds();
}

export function setupChatViewIpc(mainWindow: BrowserWindow) {
  hostWindow = mainWindow;
  getOrCreateChatView(mainWindow);

  ipcMainHandle("chat-drag-begin", async () => {
    const { width, height } = contentSize();
    if (chatView && visible) {
      chatView.setBounds({ x: 0, y: 0, width, height });
      raiseView();
    }
    return {
      windowWidth: width,
      windowHeight: height,
      panel: { ...panel },
    };
  });

  ipcMainHandle("chat-drag-end", async (rect) => {
    panel = clampPanel(rect);
    applyBounds();
  });

  ipcMainOn("chat-close", () => {
    hideChat();
  });

  ipcMainHandle("get-chat-session", async () => currentSession);

  mainWindow.on("closed", () => {
    chatView = null;
    hostWindow = null;
    visible = false;
    currentSession = null;
    ready = null;
  });
}
