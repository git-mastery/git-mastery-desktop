import { net } from "electron";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel, streamText } from "ai";

/**
 * Chromium's network stack, not Node's undici. Node does not load macOS
 * Keychain CAs, so corporate TLS inspection fails with
 * UNABLE_TO_GET_ISSUER_CERT_LOCALLY while curl and the embedded site succeed.
 */
export const chromiumFetch: typeof fetch = (input, init) =>
  net.fetch(input instanceof URL ? input.toString() : input, init);

export type ProviderConnection = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

type ValidationResult = { ok: true } | { ok: false; error: string };

export type ProviderSpec = AiProviderInfo & {
  createModel: (connection: ProviderConnection) => LanguageModel;
  /** Cheap authenticated read, so a bad key fails in Settings, not mid-hint. */
  validate: (connection: ProviderConnection) => Promise<ValidationResult>;
  providerOptions?: Parameters<typeof streamText>[0]["providerOptions"];
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Tried in order: OpenRouter moves to the next when one is down, rate-limited,
 * or no longer free. `openrouter/free` is deliberately absent, even as a last
 * resort: it picks any zero-cost model, including ~2B agent-tuned ones that
 * answer in raw tool-call tokens and a safety classifier that answers "User
 * Safety: safe". A clear rate-limit error beats that. Free-tier membership
 * changes without notice; revisit this list when these stop answering.
 */
const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

/** Optional OpenRouter attribution headers. */
const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://git-mastery.org",
  "X-Title": "Git-Mastery Desktop",
};

/** Walks `cause` so Chromium `net::ERR_*` and undici codes show up in the log. */
function formatNetworkError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 4; depth += 1) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      parts.push(
        `${current.name}: ${current.message}${code ? ` [${String(code)}]` : ""}`,
      );
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" <- ");
}

async function probe(
  label: string,
  url: string,
  headers: Record<string, string>,
  {
    rejected = [401, 403],
    accepted = [],
  }: { rejected?: number[]; accepted?: number[] } = {},
): Promise<ValidationResult> {
  try {
    const response = await chromiumFetch(url, { method: "GET", headers });
    if (response.ok || accepted.includes(response.status)) return { ok: true };
    if (rejected.includes(response.status)) {
      return {
        ok: false,
        error: `${label} rejected that key. Check it and try again.`,
      };
    }
    return {
      ok: false,
      error: `${label} returned ${response.status}. Try again in a moment.`,
    };
  } catch (error) {
    console.error(`[ai] ${label} key check failed:`, formatNetworkError(error));
    return {
      ok: false,
      error: `Could not reach ${label}. Check your connection and try again.`,
    };
  }
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

const SPECS: ProviderSpec[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "Free models with a free account. Recommended if you don't already pay for an AI API.",
    defaultModel: OPENROUTER_FREE_MODELS[0],
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-v1-…",
    keyRequired: true,
    baseUrlRequired: false,
    baseUrlPlaceholder: null,
    createModel: ({ apiKey, model }) =>
      createOpenAICompatible({
        name: "openrouter",
        baseURL: OPENROUTER_BASE_URL,
        apiKey,
        headers: OPENROUTER_HEADERS,
        fetch: chromiumFetch,
      }).chatModel(model),
    validate: ({ apiKey }) =>
      probe("OpenRouter", `${OPENROUTER_BASE_URL}/key`, {
        Authorization: `Bearer ${apiKey}`,
      }),
    providerOptions: { openrouter: { models: OPENROUTER_FREE_MODELS } },
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Uses your OpenAI API account. Billed per use by OpenAI.",
    defaultModel: "gpt-5-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    keyRequired: true,
    baseUrlRequired: false,
    baseUrlPlaceholder: null,
    createModel: ({ apiKey, model }) =>
      createOpenAI({ apiKey, fetch: chromiumFetch })(model),
    validate: ({ apiKey }) =>
      probe("OpenAI", "https://api.openai.com/v1/models", {
        Authorization: `Bearer ${apiKey}`,
      }),
    // Reasoning tokens count against the output cap. At the default effort a
    // short hint can spend the whole budget thinking and arrive empty.
    providerOptions: { openai: { reasoningEffort: "low" } },
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description:
      "Uses your Anthropic API account. Billed per use by Anthropic.",
    defaultModel: "claude-haiku-4-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
    keyRequired: true,
    baseUrlRequired: false,
    baseUrlPlaceholder: null,
    createModel: ({ apiKey, model }) =>
      createAnthropic({ apiKey, fetch: chromiumFetch })(model),
    validate: ({ apiKey }) =>
      probe("Anthropic", "https://api.anthropic.com/v1/models", {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      }),
  },
  {
    id: "google",
    label: "Google Gemini",
    description:
      "Uses a Google AI Studio key, which has a free tier with daily limits.",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    keyRequired: true,
    baseUrlRequired: false,
    baseUrlPlaceholder: null,
    createModel: ({ apiKey, model }) =>
      createGoogleGenerativeAI({ apiKey, fetch: chromiumFetch })(model),
    // An invalid Gemini key is a 400 ("API key not valid"), not a 401.
    validate: ({ apiKey }) =>
      probe(
        "Google",
        "https://generativelanguage.googleapis.com/v1beta/models",
        { "x-goog-api-key": apiKey },
        { rejected: [400, 401, 403] },
      ),
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    description:
      "Any endpoint that speaks the OpenAI chat API: Ollama, LM Studio, Groq, a course proxy, and so on.",
    defaultModel: null,
    keyUrl: null,
    keyPlaceholder: "Leave empty if the endpoint needs no key",
    keyRequired: false,
    baseUrlRequired: true,
    baseUrlPlaceholder: "http://localhost:11434/v1",
    createModel: ({ apiKey, model, baseUrl }) =>
      createOpenAICompatible({
        name: "custom",
        baseURL: trimSlash(baseUrl),
        apiKey: apiKey || undefined,
        fetch: chromiumFetch,
      }).chatModel(model),
    // Not every compatible server lists models (Gemini's layer returns 404),
    // so only an explicit auth failure or no answer at all counts as broken.
    validate: ({ apiKey, baseUrl }) =>
      probe(
        "That endpoint",
        `${trimSlash(baseUrl)}/models`,
        apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        { accepted: [404] },
      ),
  },
];

export const DEFAULT_PROVIDER: AiProviderId = "openrouter";

export function getProviderSpec(id: AiProviderId | undefined): ProviderSpec {
  return SPECS.find((spec) => spec.id === id) ?? getProviderSpec("openrouter");
}

export function isProviderId(value: unknown): value is AiProviderId {
  return SPECS.some((spec) => spec.id === value);
}

export function listProviderInfo(): AiProviderInfo[] {
  return SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    defaultModel: spec.defaultModel,
    keyUrl: spec.keyUrl,
    keyPlaceholder: spec.keyPlaceholder,
    keyRequired: spec.keyRequired,
    baseUrlRequired: spec.baseUrlRequired,
    baseUrlPlaceholder: spec.baseUrlPlaceholder,
  }));
}
