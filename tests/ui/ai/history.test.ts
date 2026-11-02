import { describe, expect, it } from "vitest";
import {
  MAX_STORED_MESSAGE_CHARS,
  toStoredHistory,
  toStoredSession,
  toUiMessages,
} from "../../../src/ui/ai/history.js";

type UiMessage = Parameters<typeof toStoredSession>[0]["messages"][number];

const source: AiSource = {
  sourceKey: "exercise:commit-one-file",
  kind: "exercise",
  id: "commit-one-file",
  title: "Commit one file",
};

const textMessage = (
  id: string,
  role: "user" | "assistant",
  text: string,
): UiMessage =>
  ({
    id,
    role,
    parts: [{ type: "text", text }],
  }) as UiMessage;

const session = (messages: UiMessage[]) => ({
  source,
  conversationId: "conversation-1",
  updatedAt: "2026-10-19T00:00:00.000Z",
  messages,
});

describe("AI history conversion", () => {
  it("restores stored messages as text-only UI messages", () => {
    expect(
      toUiMessages([
        { id: "user-1", role: "user", text: "Question" },
        { id: "assistant-1", role: "assistant", text: "Answer" },
      ]),
    ).toEqual([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Question" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Answer" }],
      },
    ]);
  });

  it("stores only user and assistant text", () => {
    const systemMessage = {
      id: "system-1",
      role: "system",
      parts: [{ type: "text", text: "Internal" }],
    } as unknown as UiMessage;
    const mixedMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: "First " },
        { type: "step-start" },
        { type: "text", text: "second" },
      ],
    } as unknown as UiMessage;

    expect(
      toStoredSession(
        session([
          systemMessage,
          textMessage("user-1", "user", "Question"),
          mixedMessage,
        ]),
      ),
    ).toEqual({
      source,
      conversationId: "conversation-1",
      updatedAt: "2026-10-19T00:00:00.000Z",
      messages: [
        { id: "user-1", role: "user", text: "Question" },
        { id: "assistant-1", role: "assistant", text: "First second" },
      ],
    });
  });

  it("does not store an empty conversation", () => {
    expect(toStoredSession(session([]))).toBeNull();
    expect(
      toStoredSession(
        session([
          {
            id: "assistant-1",
            role: "assistant",
            parts: [{ type: "step-start" }],
          } as unknown as UiMessage,
        ]),
      ),
    ).toBeNull();
  });

  it("clips individual messages to the retention limit", () => {
    const text = "x".repeat(MAX_STORED_MESSAGE_CHARS + 50);

    const stored = toStoredSession(
      session([textMessage("user-1", "user", text)]),
    );

    expect(stored?.messages[0].text).toHaveLength(MAX_STORED_MESSAGE_CHARS);
  });

  it("drops complete oldest turns until the session fits", () => {
    const messages = Array.from({ length: 8 }, (_, index) => [
      textMessage(
        `user-${index}`,
        "user",
        "u".repeat(MAX_STORED_MESSAGE_CHARS),
      ),
      textMessage(
        `assistant-${index}`,
        "assistant",
        "a".repeat(MAX_STORED_MESSAGE_CHARS),
      ),
    ]).flat();

    const stored = toStoredSession(session(messages));

    expect(stored).not.toBeNull();
    expect(JSON.stringify(stored).length).toBeLessThanOrEqual(256 * 1024);
    expect(stored?.messages).toHaveLength(12);
    expect(stored?.messages[0].id).toBe("user-2");
    expect(stored?.messages[1].id).toBe("assistant-2");
  });

  it("omits empty sessions from a stored history", () => {
    expect(
      toStoredHistory({
        empty: session([]),
        [source.sourceKey]: session([
          textMessage("user-1", "user", "Question"),
        ]),
      }),
    ).toEqual({
      [source.sourceKey]: {
        source,
        conversationId: "conversation-1",
        updatedAt: "2026-10-19T00:00:00.000Z",
        messages: [{ id: "user-1", role: "user", text: "Question" }],
      },
    });
  });
});
