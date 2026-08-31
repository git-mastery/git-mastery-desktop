import { getCwd } from "../ipc/terminal.js";
import { exerciseBriefProvider } from "./providers/exerciseBrief.js";

export type ContextBlock = AiContextBlock;

export type ContextCollectArgs = {
  exerciseId: string;
  cwd: string;
};

export type ContextProvider = {
  id: string;
  label: string;
  collect: (ctx: ContextCollectArgs) => Promise<string | null>;
};

const MAX_BLOCK_CHARS = 8000;

/**
 * Adding a live signal (git status, verify output, terminal scrollback) means
 * appending one provider here. collectContext, the system prompt, IPC, and the
 * context chip all stay unchanged.
 */
const PROVIDERS: ContextProvider[] = [exerciseBriefProvider];

export async function collectContext(
  exerciseId: string,
): Promise<ContextBlock[]> {
  const cwd = getCwd();
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      try {
        const text = await provider.collect({ exerciseId, cwd });
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

export function buildSystemPrompt(blocks: ContextBlock[]): string {
  const preamble = `You are a teaching assistant for Git-Mastery, a tool that teaches Git through hands-on exercises.

Give hints and ask what the student has already tried. Do not hand over the full sequence of commands that would complete the exercise. Prefer short, stepwise guidance.`;

  if (blocks.length === 0) {
    return `${preamble}

No exercise text could be collected for this session. Answer from the student's question alone.`;
  }

  const attached = blocks
    .map((block) => `## ${block.label}\n${block.text}`)
    .join("\n\n");
  return `${preamble}

The following context is attached for this exercise:

${attached}`;
}
