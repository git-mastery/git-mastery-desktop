import { curriculumProvider } from "./providers/curriculum.js";
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
const PROVIDERS: ContextProvider[] = [
  exerciseBriefProvider,
  gitStateProvider,
  curriculumProvider,
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
  const preamble = `You are a teaching assistant for Git-Mastery, a tool that teaches Git through hands-on exercises.

Give hints and ask what the student has already tried. Do not hand over the full sequence of commands that would complete the exercise. Prefer short, stepwise guidance.`;

  if (blocks.length === 0) {
    return `${preamble}

No exercise text could be collected for this session. Answer from the student's question alone.`;
  }

  const hasCurriculum = blocks.some((block) => block.id === "curriculum");
  const curriculumRule = hasCurriculum
    ? `

Stay inside the course. The "Course position" block below says where the student has reached and lists the lessons still ahead of them. Never introduce a command or idea from a later lesson, even when it would solve the exercise faster — the student has not met it yet.`
    : "";

  const attached = blocks
    .map((block) => `## ${block.label}\n${fence(block.text)}`)
    .join("\n\n");

  return `${preamble}${curriculumRule}

The following context is attached for this exercise:

${attached}`;
}
