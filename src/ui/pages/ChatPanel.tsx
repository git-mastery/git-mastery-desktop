import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { IconChevronDown, IconSparkles, IconX } from "@tabler/icons-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "../components/ai-elements/message";
import { Composer } from "../components/Chat/Composer";
import { CopyButton } from "../components/Chat/CopyButton";
import { TypingDots } from "../components/Chat/TypingDots";
import { IconButton } from "../components/ui/IconButton";
import { IpcChatTransport } from "../ai/IpcChatTransport";
import { cx } from "../utils/cx";

const VIEW_PAD = 12;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;

/** Openers that model the kind of question that earns a useful hint. */
const SUGGESTIONS = [
  "I'm stuck on the first step",
  "What is this exercise asking for?",
  "Check my understanding",
];

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragKind = "move" | ResizeEdge;

function applyDelta(
  start: ChatPanelRect,
  kind: DragKind,
  dx: number,
  dy: number,
  windowWidth: number,
  windowHeight: number,
): ChatPanelRect {
  let { x, y, width, height } = start;

  if (kind === "move") {
    x += dx;
    y += dy;
  } else {
    if (kind.includes("e")) width += dx;
    if (kind.includes("s")) height += dy;
    if (kind.includes("w")) {
      width -= dx;
      x += dx;
    }
    if (kind.includes("n")) {
      height -= dy;
      y += dy;
    }
  }

  width = Math.max(MIN_WIDTH, width);
  height = Math.max(MIN_HEIGHT, height);
  if (kind !== "move" && kind.includes("w")) {
    x = start.x + start.width - width;
  }
  if (kind !== "move" && kind.includes("n")) {
    y = start.y + start.height - height;
  }

  const maxX = Math.max(VIEW_PAD, windowWidth - width - VIEW_PAD);
  const maxY = Math.max(VIEW_PAD, windowHeight - height - VIEW_PAD);
  x = Math.min(Math.max(x, VIEW_PAD), maxX);
  y = Math.min(Math.max(y, VIEW_PAD), maxY);
  return { x, y, width, height };
}

const EDGE_STYLE: Record<ResizeEdge, string> = {
  n: "top-0 right-3 left-3 h-1.5 cursor-ns-resize",
  s: "right-3 bottom-0 left-3 h-1.5 cursor-ns-resize",
  e: "top-3 right-0 bottom-3 w-1.5 cursor-ew-resize",
  w: "top-3 bottom-3 left-0 w-1.5 cursor-ew-resize",
  ne: "top-0 right-0 h-3 w-3 cursor-nesw-resize",
  nw: "top-0 left-0 h-3 w-3 cursor-nwse-resize",
  se: "right-0 bottom-0 h-3 w-3 cursor-nwse-resize",
  sw: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize",
};

function messageText(message: GitMasteryUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Floating AI hints panel. Rendered in a dedicated transparent WebContentsView
 * (hash #chat), not inside the main app tree, so it can sit above the lesson
 * site without hiding the terminal.
 */
export const ChatPanel = () => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [panel, setPanel] = useState<ChatPanelRect | null>(null);

  const exerciseIdRef = useRef<string | null>(null);
  const titleId = useId();

  const transport = useMemo(() => new IpcChatTransport(exerciseIdRef), []);
  const { messages, sendMessage, setMessages, status, error, stop } =
    useChat<GitMasteryUIMessage>({ transport });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    document.documentElement.classList.add("gm-chat-overlay");
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.classList.remove("gm-chat-overlay");
      document.body.style.background = "";
    };
  }, []);

  useEffect(() => {
    const applySession = (next: ChatSession) => {
      if (exerciseIdRef.current !== next.exerciseId) {
        setMessages([]);
        setContextOpen(false);
      }
      exerciseIdRef.current = next.exerciseId;
      setSession(next);
    };

    void window.electron.getChatSession().then((next) => {
      if (next) applySession(next);
    });
    return window.electron.onChatSession(applySession);
  }, [setMessages]);

  // The blocks main actually sent on the most recent turn, so the chip never
  // claims context that a later scrape failed to collect.
  const context = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const part = messages[i].parts.find(
        (item) => item.type === "data-context",
      );
      if (part) return part.data;
    }
    return [];
  }, [messages]);

  // The assistant turn exists as soon as the stream opens, so "waiting" means
  // the last message is an empty assistant message, not merely that we're busy.
  const last = messages[messages.length - 1];
  const waiting =
    busy && (!last || last.role !== "assistant" || !messageText(last));

  const beginDrag = (kind: DragKind, event: React.PointerEvent) => {
    if (kind === "move" && (event.target as HTMLElement).closest("button")) {
      return;
    }
    event.preventDefault();
    const viewX = event.clientX;
    const viewY = event.clientY;

    void (async () => {
      const info = await window.electron.chatDragBegin();
      const pointerWindowX = info.panel.x - VIEW_PAD + viewX;
      const pointerWindowY = info.panel.y - VIEW_PAD + viewY;
      const startPanel = info.panel;

      flushSync(() => {
        setOverlay(true);
        setPanel(startPanel);
      });

      const onMove = (ev: PointerEvent) => {
        setPanel(
          applyDelta(
            startPanel,
            kind,
            ev.clientX - pointerWindowX,
            ev.clientY - pointerWindowY,
            info.windowWidth,
            info.windowHeight,
          ),
        );
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const next = applyDelta(
          startPanel,
          kind,
          ev.clientX - pointerWindowX,
          ev.clientY - pointerWindowY,
          info.windowWidth,
          info.windowHeight,
        );
        void window.electron.chatDragEnd(next).then(() => {
          setPanel(next);
          setOverlay(false);
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    })();
  };

  const cardStyle =
    overlay && panel
      ? {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
        }
      : undefined;

  return (
    <div className="relative h-full w-full">
      <section
        role="dialog"
        aria-labelledby={titleId}
        className={cx(
          "flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card",
          overlay ? "absolute" : "absolute inset-[12px]",
        )}
        style={cardStyle}
      >
        {(Object.keys(EDGE_STYLE) as ResizeEdge[]).map((edge) => (
          <div
            key={edge}
            className={cx("absolute z-10", EDGE_STYLE[edge])}
            onPointerDown={(event) => beginDrag(edge, event)}
          />
        ))}

        <header
          className="flex shrink-0 cursor-grab items-center gap-2 border-b border-neutral-200 px-3 py-2 active:cursor-grabbing"
          onPointerDown={(event) => beginDrag("move", event)}
        >
          <IconSparkles size={16} className="text-neutral-500" />
          <h3
            id={titleId}
            className="min-w-0 flex-1 truncate font-heading text-[1.2rem]/[1.4] font-semibold text-[#333]"
          >
            {session ? `Hints: ${session.exerciseTitle}` : "AI Hints"}
          </h3>
          <IconButton
            aria-label="Close"
            size="sm"
            onClick={() => window.electron.chatClose()}
          >
            <IconX size={16} />
          </IconButton>
        </header>

        {context.length > 0 && (
          <div className="shrink-0 border-b border-neutral-200 px-3 py-2">
            <button
              type="button"
              onClick={() => setContextOpen((open) => !open)}
              className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:cursor-pointer hover:bg-neutral-100"
            >
              <span className="truncate">
                Context attached:{" "}
                {context.map((block) => block.label).join(", ")}
              </span>
              <IconChevronDown
                size={14}
                className={cx(
                  "shrink-0 transition-transform duration-150",
                  contextOpen && "rotate-180",
                )}
              />
            </button>
            {contextOpen && (
              <div className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                {context.map((block) => (
                  <div key={block.id}>
                    <div className="text-[11.5px] font-medium tracking-[0.06em] text-neutral-500 uppercase">
                      {block.label}
                    </div>
                    <pre className="mt-1 font-mono text-[12px] leading-5 whitespace-pre-wrap text-[#333]">
                      {block.text}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Conversation className="min-h-0">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100">
                  <IconSparkles size={24} className="text-neutral-500" />
                </div>
                <p className="text-sm font-medium text-[#333]">
                  Ask a question about this exercise
                </p>
                <p className="max-w-xs text-[12.5px] text-neutral-400">
                  I&apos;ll help you think it through. I give hints, not the
                  full solution.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={!session}
                      onClick={() => void sendMessage({ text: suggestion })}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[12px] text-neutral-700 hover:cursor-pointer hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => {
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
                      <div className="-ml-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                        <CopyButton text={text} />
                      </div>
                    )}
                  </Message>
                );
              })
            )}

            {waiting && <TypingDots />}

            {error && (
              <p className="text-[13px] leading-[1.55] text-[#b42318]">
                {error.message}
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="shrink-0 p-3">
          <Composer
            disabled={!session}
            busy={busy}
            onSend={(text) => void sendMessage({ text })}
            onStop={stop}
          />
        </div>
      </section>
    </div>
  );
};
