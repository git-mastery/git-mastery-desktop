import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_KEY_URL = `${OPENROUTER_BASE_URL}/key`;

/**
 * MVP hardcodes OpenRouter's zero-cost router. Membership changes without
 * notice — see the open questions in the tech design.
 */
const MODEL_ID = "openrouter/free";

/** Optional OpenRouter attribution headers. */
const HEADERS = {
  "HTTP-Referer": "https://git-mastery.org",
  "X-Title": "Git-Mastery Desktop",
};

/**
 * Deliberately an OpenAI-compatible client rather than an OpenRouter-specific
 * provider: pointing at Ollama, Azure, or a course-held proxy later is a change
 * of baseURL and model id, not a change of client.
 */
export function getChatModel(apiKey: string): LanguageModel {
  const provider = createOpenAICompatible({
    name: "openrouter",
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    headers: HEADERS,
  });
  return provider.chatModel(MODEL_ID);
}
