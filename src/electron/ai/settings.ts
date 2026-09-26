import { safeStorage } from "electron";
import { getConfig, saveConfig, type StoredAiProvider } from "../storage.js";
import {
  DEFAULT_PROVIDER,
  getProviderSpec,
  isProviderId,
  listProviderInfo,
  type ProviderConnection,
} from "./llmProviders.js";

function readAi() {
  return getConfig().ai ?? {};
}

function decryptKey(stored: StoredAiProvider | undefined): string {
  if (stored?.apiKeyEnc) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.apiKeyEnc, "base64"));
    } catch (err) {
      console.error("[ai] failed to decrypt API key:", err);
      return "";
    }
  }
  return stored?.apiKeyPlain ?? "";
}

function encryptKey(
  key: string,
): Pick<StoredAiProvider, "apiKeyEnc" | "apiKeyPlain"> {
  if (!key) return {};
  if (safeStorage.isEncryptionAvailable()) {
    return { apiKeyEnc: safeStorage.encryptString(key).toString("base64") };
  }
  return { apiKeyPlain: key };
}

export function getActiveProviderId(): AiProviderId {
  const id = readAi().provider;
  return isProviderId(id) ? id : DEFAULT_PROVIDER;
}

/**
 * The active provider resolved to everything a request needs, or null while
 * it is missing a key, endpoint, or model — which is what "AI is not set up"
 * means everywhere else in the app.
 */
export function getActiveConnection() {
  const spec = getProviderSpec(getActiveProviderId());
  const stored = readAi().providers?.[spec.id];
  const connection: ProviderConnection = {
    apiKey: decryptKey(stored),
    // Only providers without a built-in model let the learner choose one.
    model: spec.defaultModel ?? stored?.model?.trim() ?? "",
    baseUrl: stored?.baseUrl?.trim() ?? "",
  };
  if (spec.keyRequired && !connection.apiKey) return null;
  if (spec.baseUrlRequired && !connection.baseUrl) return null;
  if (!connection.model) return null;
  return { spec, connection };
}

export function isAiConfigured(): boolean {
  return getActiveConnection() !== null;
}

export function getSettingsView(): AiSettingsView {
  const saved: AiSettingsView["saved"] = {};
  for (const [id, stored] of Object.entries(readAi().providers ?? {})) {
    if (!isProviderId(id) || !stored) continue;
    saved[id] = {
      model: stored.model ?? "",
      baseUrl: stored.baseUrl ?? "",
      apiKey: decryptKey(stored),
      keyEncrypted: Boolean(stored.apiKeyEnc),
    };
  }
  return {
    providers: listProviderInfo(),
    activeProvider: getActiveProviderId(),
    saved,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
}

/** Makes `provider` active and replaces its saved key, model and endpoint. */
export function saveProviderSettings(
  provider: AiProviderId,
  { model, baseUrl, apiKey }: ProviderConnection,
): { encrypted: boolean } {
  const ai = readAi();
  const next: StoredAiProvider = {
    model: (!getProviderSpec(provider).defaultModel && model) || undefined,
    baseUrl: baseUrl || undefined,
    ...encryptKey(apiKey),
  };
  saveConfig({
    ai: { provider, providers: { ...ai.providers, [provider]: next } },
  });
  return { encrypted: Boolean(next.apiKeyEnc) };
}
