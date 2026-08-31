import type { ChatTransport, UIMessageChunk } from "ai";

function nextStreamId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Bridges `useChat` to the Electron main process.
 *
 * The OpenRouter key never leaves main, so there is no HTTP endpoint for
 * `DefaultChatTransport` to post to. Main runs `streamText` and pushes the AI
 * SDK's own UI message chunks over IPC; this reassembles them into the
 * `ReadableStream` the transport contract expects. Swapping in a real endpoint
 * later means swapping this class, and nothing else.
 */
export class IpcChatTransport implements ChatTransport<GitMasteryUIMessage> {
  /**
   * Held as a ref rather than a value so switching exercises does not rebuild
   * the transport and orphan an in-flight stream.
   */
  private readonly exerciseIdRef: { current: string | null };

  constructor(exerciseIdRef: { current: string | null }) {
    this.exerciseIdRef = exerciseIdRef;
  }

  sendMessages({
    messages,
    abortSignal,
  }: Parameters<
    ChatTransport<GitMasteryUIMessage>["sendMessages"]
  >[0]): Promise<ReadableStream<UIMessageChunk>> {
    const exerciseId = this.exerciseIdRef.current;
    if (!exerciseId) {
      return Promise.reject(new Error("No exercise is selected."));
    }

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
          exerciseId,
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
    // Streams live only as long as the panel; there is nothing to resume.
    return Promise.resolve(null);
  }
}
