import type { ChatTransport, UIMessageChunk } from "ai";

function nextStreamId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Bridges `useChat` to the Electron main process.
 *
 * API keys never leave main, so there is no HTTP endpoint for
 * `DefaultChatTransport` to post to. Main runs `streamText` and pushes the AI
 * SDK's own UI message chunks over IPC; this reassembles them into the
 * `ReadableStream` the transport contract expects. Swapping in a real endpoint
 * later means swapping this class, and nothing else.
 *
 * One transport serves one source: the panel is remounted, with a fresh
 * conversation, whenever the source or conversation id changes.
 */
export class IpcChatTransport implements ChatTransport<GitMasteryUIMessage> {
  private readonly source: AiSource;

  constructor(source: AiSource) {
    this.source = source;
  }

  sendMessages({
    messages,
    abortSignal,
  }: Parameters<
    ChatTransport<GitMasteryUIMessage>["sendMessages"]
  >[0]): Promise<ReadableStream<UIMessageChunk>> {
    const source = this.source;
    const streamId = nextStreamId();
    let finish: () => void = () => {};

    const stream = new ReadableStream<UIMessageChunk>({
      start: async (controller) => {
        let done = false;
        const cleanups: (() => void)[] = [];

        finish = () => {
          if (done) return;
          done = true;
          for (const cleanup of cleanups) cleanup();
          try {
            controller.close();
          } catch {
            // Already closed by a cancelled reader.
          }
        };

        // Subscribe before starting the turn so no early chunk is dropped.
        cleanups.push(
          window.electron.onAiChatChunk((id, chunk) => {
            if (id !== streamId || done) return;
            controller.enqueue(chunk);
          }),
        );
        cleanups.push(
          window.electron.onAiChatEnd((id) => {
            if (id === streamId) finish();
          }),
        );

        if (abortSignal) {
          const onAbort = () => {
            window.electron.aiChatAbort(streamId);
            finish();
          };
          if (abortSignal.aborted) {
            onAbort();
            return;
          }
          abortSignal.addEventListener("abort", onAbort);
          cleanups.push(() =>
            abortSignal.removeEventListener("abort", onAbort),
          );
        }

        const result = await window.electron.aiChatStart({
          streamId,
          source,
          messages,
        });

        // Surfaced as a stream error rather than a rejected promise so a
        // missing key reads as a message in the thread, not a thrown dialog.
        if (!result.ok && !done) {
          controller.enqueue({ type: "error", errorText: result.error });
          finish();
        }
      },
      cancel: () => {
        window.electron.aiChatAbort(streamId);
        finish();
      },
    });

    return Promise.resolve(stream);
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    // Streams live only as long as the conversation; there is nothing to resume.
    return Promise.resolve(null);
  }
}
