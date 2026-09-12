import { exerciseBriefProvider } from "./providers/exerciseBrief.js";
import { gitStateProvider } from "./providers/gitState.js";

export type ContextBlock = AiContextBlock;

export type ContextCollectArgs = {
  exerciseId: string;
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
const PROVIDER_TIMEOUT_MS = 1500;

/**
 * Adding a live signal (verify output, terminal scrollback) means appending one
 * provider here. collectContext, the system prompt, IPC, and the context chip
 * all stay unchanged.
 */
const PROVIDERS: ContextProvider[] = [exerciseBriefProvider, gitStateProvider];

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
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      if (signal?.aborted) return null;
      try {
        const text = await withTimeout(
          provider.collect({ exerciseId }),
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

/**
 * Wraps block text in a fence long enough to survive its own content. Blocks
 * carry Markdown-significant text — porcelain status lines start with `##`, and
 * the scraped exercise brief has its own headings — which would otherwise be
 * read as structure of the surrounding prompt.
 */
function fence(text: string): string {
  const longestRun = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const ticks = "`".repeat(Math.max(3, longestRun + 1));
  return `${ticks}\n${text}\n${ticks}`;
}

export function buildSystemPrompt(blocks: ContextBlock[]): string {
  const preamble = `You are a Git tutor inside Git-Mastery, a course that teaches Git through hands-on exercises.

Read the attached repository state before you answer. It is a live snapshot of the student's exercise repo, captured the moment they sent this message, and it already tells you what they have done: their branch, their commits, what is staged, what is modified, what is untracked. Infer their progress from it, and refer to it concretely — "you have README.md staged but not committed" — rather than in generalities. Never ask the student what they have already tried or already run; you can see it.

If the state genuinely does not settle the question, say what you can see, name what is ambiguous, and ask one specific question.

Keep answers short and stepwise. Give the next step, not the full sequence of commands that would complete the exercise.`;

  if (blocks.length === 0) {
    return `${preamble}

No exercise or repository context could be collected for this turn, so you cannot see the student's repository. Tell them that rather than guessing at what they have done, and answer from their question alone.`;
  }

  const attached = blocks
    .map((block) => `## ${block.label}\n${fence(block.text)}`)
    .join("\n\n");

  return `${preamble}

The following context is attached for this exercise:

${attached}`;
}
