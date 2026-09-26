import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  streamText,
  type UIMessageChunk,
} from "ai";
import { collectContext } from "./context.js";
import type { ProviderConnection, ProviderSpec } from "./llmProviders.js";
import { buildSystemPrompt } from "./prompt.js";
import { describeSession } from "./session.js";

/**
 * Only the most recent turns are sent. Older ones cost quota on every send,
 * and the repository snapshot is rebuilt each turn anyway.
 */
const MAX_HISTORY_MESSAGES = 20;

/**
 * A safety cap, not a length target — the prompt asks for brevity. It is set
 * well above a short hint because reasoning models spend output tokens
 * thinking, and a tight cap arrives as an empty answer.
 */
const MAX_OUTPUT_TOKENS = 2000;

/**
 * One entry per in-flight send. The renderer owns stream ids, so an abort that
 * races a newly started stream cannot cancel the wrong one.
 */
const running = new Map<string, AbortController>();

function toUserMessage(error: unknown, label: string, model: string): string {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return `${label} rejected the API key. Update it in Settings → AI hints.`;
      case 402:
        return `${label} says the account is out of credit. Top it up, or switch provider in Settings → AI hints.`;
      case 404:
        return `${label} could not find the model "${model}". Check the model name in Settings → AI hints.`;
      case 429:
        return `${label} is rate-limiting requests (free tiers allow only a few per minute). Wait a moment and try again.`;
    }
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Stopped.";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ERR_/i.test(error.message)) {
      return `Could not reach ${label}. Check your connection and try again.`;
    }
    return error.message;
  }
  return "Something went wrong while answering. Try again.";
}

export function abortChat(streamId: string) {
  running.get(streamId)?.abort();
  running.delete(streamId);
}

/**
 * Runs one turn and hands each UI message chunk to `onChunk`, which ships it to
 * the renderer. The renderer reassembles the chunks into a ReadableStream for
 * `useChat`, so this is the AI SDK's own stream protocol carried over IPC
 * instead of over HTTP.
 */
export async function runChat(options: {
  streamId: string;
  exerciseId: string;
  spec: ProviderSpec;
  connection: ProviderConnection;
  messages: GitMasteryUIMessage[];
  onChunk: (chunk: UIMessageChunk) => void;
}) {
  const { streamId, exerciseId, spec, connection, messages, onChunk } = options;

  const controller = new AbortController();
  running.set(streamId, controller);

  const stream = createUIMessageStream<GitMasteryUIMessage>({
    onError: (error) => toUserMessage(error, spec.label, connection.model),
    execute: async ({ writer }) => {
      // Collected per send, not per panel open, so the git-state provider sees
      // the repo as it is after the student's latest attempt.
      const context = await collectContext(exerciseId, controller.signal);
      writer.write({ type: "data-context", id: "context", data: context });

      const result = streamText({
        model: spec.createModel(connection),
        system: buildSystemPrompt(describeSession(exerciseId), context),
        messages: await convertToModelMessages(
          messages.slice(-MAX_HISTORY_MESSAGES),
        ),
        abortSignal: controller.signal,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        providerOptions: spec.providerOptions,
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  try {
    for await (const chunk of stream) {
      onChunk(chunk);
    }
  } finally {
    if (running.get(streamId) === controller) running.delete(streamId);
  }
}
