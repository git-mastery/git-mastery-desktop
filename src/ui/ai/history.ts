/** Keep in sync with `src/electron/ai/history.ts`. */
export const MAX_STORED_MESSAGE_CHARS = 20_000;
const MAX_SESSION_BYTES = 256 * 1024;

function messageText(message: GitMasteryUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function clipText(text: string) {
  return text.length <= MAX_STORED_MESSAGE_CHARS
    ? text
    : text.slice(0, MAX_STORED_MESSAGE_CHARS);
}

function dropOldestTurn(messages: StoredAiMessage[]) {
  if (messages.length === 0) return messages;
  if (messages[0].role === "user" && messages[1]?.role === "assistant") {
    return messages.slice(2);
  }
  return messages.slice(1);
}

function trimStoredSession(session: StoredAiSession): StoredAiSession {
  let next: StoredAiSession = {
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      text: clipText(message.text),
    })),
  };
  while (
    next.messages.length > 1 &&
    JSON.stringify(next).length > MAX_SESSION_BYTES
  ) {
    next = { ...next, messages: dropOldestTurn(next.messages) };
  }
  return next;
}

export function toUiMessages(
  messages: StoredAiMessage[],
): GitMasteryUIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text" as const, text: message.text }],
  }));
}

export function toStoredSession(session: {
  source: AiSource;
  conversationId: string;
  updatedAt: string;
  messages: GitMasteryUIMessage[];
}): StoredAiSession | null {
  const messages: StoredAiMessage[] = [];
  for (const message of session.messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = clipText(messageText(message));
    if (!text) continue;
    messages.push({ id: message.id, role: message.role, text });
  }
  if (messages.length === 0) return null;
  return trimStoredSession({
    source: session.source,
    conversationId: session.conversationId,
    updatedAt: session.updatedAt,
    messages,
  });
}

export function toStoredHistory(
  sessions: Record<
    string,
    {
      source: AiSource;
      conversationId: string;
      updatedAt: string;
      messages: GitMasteryUIMessage[];
    }
  >,
): Record<string, StoredAiSession> {
  const next: Record<string, StoredAiSession> = {};
  for (const [key, session] of Object.entries(sessions)) {
    const stored = toStoredSession(session);
    if (stored) next[key] = stored;
  }
  return next;
}
