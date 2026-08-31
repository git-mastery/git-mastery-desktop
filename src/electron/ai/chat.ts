import {
  convertToModelMessages,
  createUIMessageStream,
  streamText,
  type UIMessageChunk,
} from "ai";
import { buildSystemPrompt, collectContext } from "./context.js";
import { getChatModel } from "./model.js";

/**
 * One entry per in-flight send. The renderer owns stream ids, so an abort that
 * races a newly started stream cannot cancel the wrong one.
 */
const running = new Map<string, AbortController>();

function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Stopped.";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(error.message)) {
      return "Could not reach OpenRouter. Check your connection and try again.";
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
 * the chat view. The renderer reassembles the chunks into a ReadableStream for
 * `useChat`, so this is the AI SDK's own stream protocol carried over IPC
 * instead of over HTTP.
 */
export async function runChat(options: {
  streamId: string;
  exerciseId: string;
  apiKey: string;
  messages: GitMasteryUIMessage[];
  onChunk: (chunk: UIMessageChunk) => void;
}) {
  const { streamId, exerciseId, apiKey, messages, onChunk } = options;

  const controller = new AbortController();
  running.set(streamId, controller);

  const stream = createUIMessageStream<GitMasteryUIMessage>({
    onError: toUserMessage,
    execute: async ({ writer }) => {
      // Collected per send, not per panel open, so a future git-state provider
      // sees the repo as it is after the student's latest attempt.
      const context = await collectContext(exerciseId);
      writer.write({ type: "data-context", id: "context", data: context });

      const result = streamText({
        model: getChatModel(apiKey),
        system: buildSystemPrompt(context),
        messages: await convertToModelMessages(messages),
        abortSignal: controller.signal,
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
