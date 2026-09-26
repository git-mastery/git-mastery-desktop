import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "../ai-elements/message";
import { Composer } from "../Chat/Composer";
import { CopyButton } from "../Chat/CopyButton";
import { TypingDots } from "../Chat/TypingDots";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Tooltip } from "../ui/Tooltip";
import { IpcChatTransport } from "../../ai/IpcChatTransport";
import { ContextDisclosure } from "./ContextDisclosure";

const KIND_LABEL: Record<AiHintsKind, string> = {
  exercise: "Exercise",
  "hands-on": "Hands-on",
};

/** Same openers for exercises and hands-on. */
const SUGGESTIONS = [
  "I'm stuck. What should I do next?",
  "Explain the underlying concepts to me",
];

const DISCLAIMER: Record<AiHintsKind, string> = {
  exercise: "Hints only, never the full solution. AI can make mistakes.",
  "hands-on": "AI can make mistakes. Check important steps against the lesson.",
};

function messageText(message: GitMasteryUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Wraps the conversation so "Clear history" and a change of exercise both start
 * from a clean mount: fresh messages, fresh transport, fresh context snapshot.
 */
export const AiHintsPanel = ({
  session,
  onClose,
}: {
  session: AiHintsSession;
  onClose: () => void;
}) => {
  const [conversation, setConversation] = useState(0);
  return (
    <AiHintsConversation
      key={`${session.exerciseId}:${conversation}`}
      session={session}
      onClose={onClose}
      onNewChat={() => setConversation((count) => count + 1)}
    />
  );
};

const AiHintsConversation = ({
  session,
  onClose,
  onNewChat,
}: {
  session: AiHintsSession;
  onClose: () => void;
  onNewChat: () => void;
}) => {
  const [transport] = useState(() => new IpcChatTransport(session.exerciseId));
  const { messages, sendMessage, status, error, stop, regenerate } =
    useChat<GitMasteryUIMessage>({ transport });
  const [preview, setPreview] = useState<AiContextBlock[] | null>(null);

  const busy = status === "submitted" || status === "streaming";
  const noun = session.kind === "hands-on" ? "hands-on" : "exercise";

  useEffect(() => {
    let cancelled = false;
    window.electron
      .previewAiContext(session.exerciseId)
      .then((blocks) => !cancelled && setPreview(blocks))
      .catch(() => !cancelled && setPreview([]));
    return () => {
      cancelled = true;
    };
  }, [session.exerciseId]);

  // A remount (Clear history, another exercise) must not leave the old turn
  // streaming into a conversation nobody can see.
  useEffect(() => () => void stop(), [stop]);

  // What main actually sent on the most recent turn, so the disclosure never
  // claims context a later snapshot failed to collect. Before the first turn,
  // the preview of what would be sent.
  const context = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const part = messages[i].parts.find(
        (item) => item.type === "data-context",
      );
      if (part) return part.data;
    }
    return preview;
  }, [messages, preview]);

  // The assistant turn exists as soon as the stream opens, so "waiting" means
  // the last message is an empty assistant message, not merely that we're busy.
  const last = messages[messages.length - 1];
  const waiting =
    busy && (!last || last.role !== "assistant" || !messageText(last));

  const send = (text: string) => void sendMessage({ text });

  const newChat = () => {
    void stop();
    onNewChat();
  };

  return (
    <section
      aria-label={`AI Hints for ${session.title}`}
      className="@container flex h-full min-h-0 flex-1 flex-col bg-surface"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-3">
        <IconSparkles
          size={16}
          className="shrink-0 text-accent"
          aria-label="AI Hints"
        />
        <span className="shrink-0 rounded border border-border bg-subtle px-1.5 py-px text-[11px] font-medium text-muted">
          {KIND_LABEL[session.kind]}
        </span>
        <h2
          className="min-w-0 flex-1 truncate text-sm font-semibold text-fg"
          title={session.title}
        >
          {session.title}
        </h2>
        <Tooltip label="Clear history" position="bottom">
          <IconButton aria-label="Clear history" size="sm" onClick={newChat}>
            <IconTrash size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Close" position="bottom">
          <IconButton aria-label="Close AI Hints" size="sm" onClick={onClose}>
            <IconX size={16} />
          </IconButton>
        </Tooltip>
      </header>

      <ContextDisclosure blocks={context} />

      {messages.length === 0 ? (
        // `m-auto` rather than `justify-center`: centred flex content that
        // overflows is clipped at the top, and this pane can be short.
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
          <div className="m-auto flex w-full max-w-lg flex-col items-center gap-3 text-center">
            <h3 className="font-heading text-[1.15rem]/[1.35] font-semibold text-fg">
              Stuck on this {noun}?
            </h3>
            <div className="grid w-full grid-cols-1 gap-2 @sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-[13px] leading-snug text-fg hover:cursor-pointer hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Conversation className="min-h-0">
          <ConversationContent>
            {messages.map((message) => {
              const text = messageText(message);
              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.role === "assistant" ? (
                      text && <MessageResponse>{text}</MessageResponse>
                    ) : (
                      <span className="whitespace-pre-wrap">{text}</span>
                    )}
                  </MessageContent>
                  {message.role === "assistant" && text && !busy && (
                    <div className="-ml-1.5 flex opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                      <CopyButton text={text} />
                      {message.id === last?.id && (
                        <IconButton
                          aria-label="Regenerate answer"
                          size="sm"
                          onClick={() => void regenerate()}
                        >
                          <IconRefresh size={14} />
                        </IconButton>
                      )}
                    </div>
                  )}
                </Message>
              );
            })}

            {waiting && <TypingDots />}

            {error && !busy && (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-[13px] leading-[1.55] text-danger">
                <span>{error.message}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<IconRefresh size={14} />}
                  onClick={() => void regenerate()}
                >
                  Try again
                </Button>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div className="shrink-0 px-3 pt-1 pb-2">
        <Composer
          autoFocus
          busy={busy}
          placeholder={`Ask about this ${noun}…`}
          onSend={send}
          onStop={() => void stop()}
        />
        <p className="mt-1.5 text-center text-[11px] text-faint">
          {DISCLAIMER[session.kind]}
        </p>
      </div>
    </section>
  );
};
