import { safeStorage } from "electron";
import { getConfig, saveConfig } from "./storage.js";

export function isKeyEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function setApiKey(key: string): { encrypted: boolean } {
  const trimmed = key.trim();
  if (!trimmed) {
    clearApiKey();
    return { encrypted: false };
  }

  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(trimmed).toString("base64");
    saveConfig({
      openRouterApiKeyEnc: enc,
      openRouterApiKeyPlain: undefined,
    });
    return { encrypted: true };
  }

  saveConfig({
    openRouterApiKeyPlain: trimmed,
    openRouterApiKeyEnc: undefined,
  });
  return { encrypted: false };
}

export function getApiKey(): string | null {
  const config = getConfig();
  if (config.openRouterApiKeyEnc) {
    try {
      return safeStorage.decryptString(
        Buffer.from(config.openRouterApiKeyEnc, "base64"),
      );
    } catch (err) {
      console.error("[ai] failed to decrypt OpenRouter key:", err);
      return null;
    }
  }
  return config.openRouterApiKeyPlain ?? null;
}

export function clearApiKey(): void {
  saveConfig({
    openRouterApiKeyEnc: undefined,
    openRouterApiKeyPlain: undefined,
  });
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}

export function isStoredKeyEncrypted(): boolean {
  return Boolean(getConfig().openRouterApiKeyEnc);
}
