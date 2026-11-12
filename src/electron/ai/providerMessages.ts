import { convertToModelMessages, type ModelMessage } from "ai";
import type { ContextBlock } from "./context.js";
import { formatAttachedContext } from "./prompt.js";

/**
 * Provider-only window: the current user message plus this many complete
 * earlier turns. The UI and disk keep the full transcript.
 */
export const MAX_PROVIDER_TURNS = 2;

function textOf(message: GitMasteryUIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

/**
 * Keeps the latest user message and at most {@link MAX_PROVIDER_TURNS}
 * preceding user/assistant turns. Older diagnoses stay in the UI only.
 */
export function selectProviderHistory(messages: GitMasteryUIMessage[]): {
  prior: GitMasteryUIMessage[];
  latest: GitMasteryUIMessage | null;
} {
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  if (lastUserIndex < 0) return { prior: [], latest: null };

  const latest = messages[lastUserIndex];
  const rest = messages.slice(0, lastUserIndex);
  let assistants = 0;
  let start = 0;
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    if (rest[i].role === "assistant") assistants += 1;
    if (assistants >= MAX_PROVIDER_TURNS && rest[i].role === "user") {
      start = i;
      break;
    }
  }
  let prior = rest.slice(start);
  while (prior[0]?.role === "assistant") prior = prior.slice(1);
  return { prior, latest };
}

/**
 * Provider payload: sliced history, then one user turn that carries fresh
 * workspace evidence (when collected) followed by the student's question.
 */
export async function assembleProviderMessages(options: {
  source: AiSource;
  messages: GitMasteryUIMessage[];
  blocks: ContextBlock[];
}): Promise<ModelMessage[]> {
  const { prior, latest } = selectProviderHistory(options.messages);
  const history = prior.length ? await convertToModelMessages(prior) : [];
  const question = latest ? textOf(latest) : "";

  if (options.source.kind === "lesson") {
    return question
      ? [...history, { role: "user", content: question }]
      : history;
  }

  const attached = formatAttachedContext(options.blocks);
  const content = question
    ? `${attached}\n\n# Student message\n\n${question}`
    : attached;
  return [...history, { role: "user", content }];
}
