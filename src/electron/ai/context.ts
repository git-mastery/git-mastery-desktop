import { locateExercise, type ExerciseLocation } from "./availability.js";
import { exerciseFolderProvider } from "./context/exerciseFolder.js";
import { gitStateProvider } from "./context/gitState.js";
import { instructionsProvider } from "./context/instructions.js";

export type ContextBlock = AiContextBlock;

export type ContextCollectArgs = {
  exerciseId: string;
  /** Null when the exercise is not on disk; workspace providers then skip. */
  location: ExerciseLocation | null;
};

export type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: ContextCollectArgs) => Promise<string | null>;
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
  exerciseFolderProvider,
  gitStateProvider,
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
 * empty. Never rejects, and never outlives `signal`: a partial context is
 * always preferable to a turn that will not start.
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
        const text = await withTimeout(
          provider.collect({ exerciseId, location }),
          PROVIDER_TIMEOUT_MS,
          () =>
            console.warn(
              `[ai] context provider ${provider.id} timed out after ${PROVIDER_TIMEOUT_MS}ms`,
            ),
        );
        if (!text?.trim()) return null;
        return {
          id: provider.id,
          label: provider.label,
          text: text.trim().slice(0, MAX_BLOCK_CHARS),
        };
      } catch (err) {
        console.warn(`[ai] context provider ${provider.id} failed:`, err);
        return null;
      }
    }),
  );
  return results.filter((block): block is ContextBlock => block !== null);
}
