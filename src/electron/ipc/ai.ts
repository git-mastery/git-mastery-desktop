import type { BrowserWindow } from "electron";
import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import { sendToRenderer } from "./ipcUtils.js";
import { onAiHintsRequested, scrapeLessonBrief } from "./webContentsView.js";
import { abortChat, runChat } from "../ai/chat.js";
import { collectContext } from "../ai/context.js";
import {
  locateExercise,
  notifyAiHintsPageStateChanged,
} from "../ai/availability.js";
import { getProviderSpec, isProviderId } from "../ai/llmProviders.js";
import { rememberBrief } from "../ai/session.js";
import {
  getActiveConnection,
  getSettingsView,
  saveProviderSettings,
} from "../ai/settings.js";

const NOT_CONFIGURED = "Set up AI hints in Settings first.";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function saveSettings(input: AiSettingsInput): Promise<AiSaveResult> {
  if (!isProviderId(input.provider)) {
    return { ok: false, error: "Choose a provider." };
  }
  const spec = getProviderSpec(input.provider);
  const connection = {
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
    baseUrl: spec.baseUrlRequired ? input.baseUrl.trim() : "",
  };

  if (spec.baseUrlRequired && !isHttpUrl(connection.baseUrl)) {
    return {
      ok: false,
      error:
        "Enter the endpoint's base URL, starting with http:// or https://.",
    };
  }
  if (!spec.defaultModel && !connection.model) {
    return { ok: false, error: "Enter the model to use." };
  }

  // An empty required key is how the learner removes one, so it skips the
  // check and simply leaves AI hints switched off.
  if (connection.apiKey || !spec.keyRequired) {
    const check = await spec.validate(connection);
    if (!check.ok) return check;
  }

  const { encrypted } = saveProviderSettings(spec.id, connection);
  notifyAiHintsPageStateChanged();
  return { ok: true, encrypted };
}

/**
 * Opens the docked panel for an AI Hints click on the lesson page. The page
 * disables the button when these checks would fail, but its state can be a
 * moment stale — the exercise folder may have just been deleted — so they
 * are repeated here, and a failure refreshes the page's buttons instead.
 */
async function openHints(mainWindow: BrowserWindow, exerciseId: string) {
  if (!locateExercise(exerciseId) || !getActiveConnection()) {
    notifyAiHintsPageStateChanged();
    return;
  }
  const brief = await scrapeLessonBrief(exerciseId);
  sendToRenderer(mainWindow, "ai-hints-open", rememberBrief(exerciseId, brief));
}

export function setupAiIpc(mainWindow: BrowserWindow) {
  onAiHintsRequested((exerciseId) => void openHints(mainWindow, exerciseId));

  ipcMainHandle("ai-get-settings", async () => getSettingsView());

  ipcMainHandle("ai-save-settings", saveSettings);

  ipcMainHandle("ai-preview-context", async ({ exerciseId }) =>
    collectContext(exerciseId),
  );

  // Resolves as soon as the turn is accepted. Everything the panel renders
  // arrives on `ai-chat-chunk`, so the transport's ReadableStream can start
  // producing before the model has finished.
  ipcMainHandle("ai-chat-start", async ({ streamId, exerciseId, messages }) => {
    const active = getActiveConnection();
    if (!active) return { ok: false, error: NOT_CONFIGURED };

    void runChat({
      streamId,
      exerciseId,
      spec: active.spec,
      connection: active.connection,
      messages,
      onChunk: (chunk) =>
        sendToRenderer(mainWindow, "ai-chat-chunk", { streamId, chunk }),
    })
      .catch((err) => console.error("[ai] chat stream failed:", err))
      // The renderer's stream stays open until this arrives, so it has to be
      // sent even when the turn fell over.
      .finally(() => sendToRenderer(mainWindow, "ai-chat-end", { streamId }));

    return { ok: true };
  });

  ipcMainOn("ai-chat-abort", ({ streamId }) => abortChat(streamId));

  // Exercise folders can be created or deleted outside the app; coming back
  // to the window is the cheapest moment to notice.
  mainWindow.on("focus", notifyAiHintsPageStateChanged);
}
