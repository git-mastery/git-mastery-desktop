import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import { cx } from "../../utils/cx";

const MAX_HEIGHT = 160;

type ComposerProps = {
  disabled?: boolean;
  busy?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
  onStop: () => void;
};

/**
 * Single rounded field with the action tucked inside, the shape people expect
 * from a chat composer. Built on the house input recipe rather than on
 * AI Elements' PromptInput, which carries attachments, screenshot capture, and
 * a model picker that a hints panel has no use for.
 */
export const Composer = ({
  disabled = false,
  busy = false,
  autoFocus = false,
  placeholder = "Ask for a hint…",
  onSend,
  onStop,
}: ComposerProps) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy || disabled) return;
    setValue("");
    onSend(text);
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <form
      className={cx(
        "flex items-end gap-2 rounded-3xl border border-border bg-surface py-2 pr-2 pl-4",
        "focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-focus-ring",
        disabled && "opacity-50",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Message"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Shift+Enter keeps the newline; plain Enter sends.
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
        className="max-h-[160px] min-h-8 flex-1 resize-none self-center bg-transparent py-1 text-sm leading-[1.5] text-fg placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
      />
      {busy ? (
        <button
          type="button"
          aria-label="Stop generating"
          onClick={onStop}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-surface hover:cursor-pointer hover:opacity-85 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          <IconPlayerStopFilled size={12} />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={cx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:cursor-pointer hover:bg-brand-700",
            "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
            !canSend && "pointer-events-none opacity-40",
          )}
        >
          <IconArrowUp size={16} />
        </button>
      )}
    </form>
  );
};
