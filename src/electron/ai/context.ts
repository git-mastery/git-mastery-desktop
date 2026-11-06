import { locateExercise, type ExerciseLocation } from "./availability.js";
import { exerciseFolderProvider } from "./context/exerciseFolder.js";
import { exerciseFilesProvider } from "./context/exerciseFiles.js";
import { gitStateProvider } from "./context/gitState.js";
import { githubStateProvider } from "./context/githubState.js";
import { instructionsProvider } from "./context/instructions.js";

export type ContextBlock = AiContextBlock;

export type ContextCollectArgs = {
  exerciseId: string;
  /** Null when the exercise is not on disk; workspace providers then skip. */
  location: ExerciseLocation | null;
  signal?: AbortSignal;
};

export type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: ContextCollectArgs) => Promise<string | ContextBlock[] | null>;
};

const MAX_BLOCK_CHARS = 8000;

/**
 * Ceiling on how long any one provider may hold up a message send. Every
 * provider reaches out to something that can stall — a WebContentsView that is
 * mid-navigation, a git subprocess — and collection gates the turn, so a
 * provider without a deadline is a hung chat panel.
 */
const PROVIDER_TIMEOUT_MS = 2500;

/**
 * Adding a live signal (verify output, terminal scrollback) means appending one
 * provider here. collectContext, the system prompt, IPC, and the context chip
 * all stay unchanged.
 */
const PROVIDERS: ContextProvider[] = [
  instructionsProvider,
  exerciseFilesProvider,
  exerciseFolderProvider,
  gitStateProvider,
  githubStateProvider,
];

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => void,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onTimeout();
      resolve(null);
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * Collects every provider's block, dropping any that fails, times out, or is
 * empty. Cancellation reaches Git subprocesses and discards late results;
 * other providers may still settle at their deadline.
 */
export async function collectContext(
  exerciseId: string,
  signal?: AbortSignal,
): Promise<ContextBlock[]> {
  const location = locateExercise(exerciseId);
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      if (signal?.aborted) return null;
      try {
        const result = await withTimeout(
          provider.collect({ exerciseId, location, signal }),
          PROVIDER_TIMEOUT_MS,
          () =>
            console.warn(
              `[ai] context provider ${provider.id} timed out after ${PROVIDER_TIMEOUT_MS}ms`,
            ),
        );
        if (!result || signal?.aborted) return [];
        const blocks =
          typeof result === "string"
            ? [{ id: provider.id, label: provider.label, text: result }]
            : result;
        return blocks
          .filter((block) => block.text.trim())
          .map((block) => ({
            ...block,
            text:
              block.text.length > MAX_BLOCK_CHARS
                ? `${block.text.slice(0, MAX_BLOCK_CHARS - 100)}\n[Truncated: omitted evidence is unknown, not absent.]`
                : block.text.trim(),
          }));
      } catch (err) {
        console.warn(`[ai] context provider ${provider.id} failed:`, err);
        return null;
      }
    }),
  );
  return results.flatMap((blocks) => blocks ?? []);
}
