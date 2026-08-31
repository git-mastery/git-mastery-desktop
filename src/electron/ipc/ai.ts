import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import {
  clearApiKey,
  getApiKey,
  hasApiKey,
  isKeyEncryptionAvailable,
  isStoredKeyEncrypted,
  setApiKey,
} from "../aiKey.js";
import { abortChat, runChat } from "../ai/chat.js";
import { OPENROUTER_KEY_URL } from "../ai/model.js";
import { sendToChat } from "./chatView.js";
import { setAiHintsEnabled } from "./webContentsView.js";

function notifyAiEnabled() {
  setAiHintsEnabled(hasApiKey());
}

async function validateKey(
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: "That key was rejected. Check it and try again.",
      };
    }
    return {
      ok: false,
      error: `OpenRouter returned ${response.status}. Try again in a moment.`,
    };
  } catch {
    return {
      ok: false,
      error: "Could not reach OpenRouter. Check your connection and try again.",
    };
  }
}

export function setupAiIpc() {
  ipcMainHandle("set-openrouter-key", async ({ key }) => {
    const result = setApiKey(key);
    notifyAiEnabled();
    return { ok: hasApiKey(), encrypted: result.encrypted };
  });

  ipcMainHandle("get-openrouter-key", async () => ({
    key: getApiKey(),
    storedEncrypted: isStoredKeyEncrypted(),
    encryptionAvailable: isKeyEncryptionAvailable(),
  }));

  ipcMainHandle("has-openrouter-key", async () => hasApiKey());

  ipcMainHandle("clear-openrouter-key", async () => {
    clearApiKey();
    notifyAiEnabled();
  });

  ipcMainHandle("validate-openrouter-key", async (payload) => {
    const key = payload?.key?.trim() || getApiKey();
    if (!key) {
      return { ok: false, error: "Paste an OpenRouter API key first." };
    }
    return validateKey(key);
  });

  // Resolves as soon as the turn is accepted. Everything the renderer renders
  // arrives on `ai-chat-chunk`, so the transport's ReadableStream can start
  // producing before the model has finished.
  ipcMainHandle("ai-chat-start", async ({ streamId, exerciseId, messages }) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { ok: false, error: "Set up AI features in Settings first." };
    }

    void runChat({
      streamId,
      exerciseId,
      apiKey,
      messages,
      onChunk: (chunk) => sendToChat("ai-chat-chunk", { streamId, chunk }),
    })
      .catch((err) => console.error("[ai] chat stream failed:", err))
      // The renderer's stream stays open until this arrives, so it has to be
      // sent even when the turn fell over.
      .finally(() => sendToChat("ai-chat-end", { streamId }));

    return { ok: true };
  });

  ipcMainOn("ai-chat-abort", ({ streamId }) => abortChat(streamId));
}
