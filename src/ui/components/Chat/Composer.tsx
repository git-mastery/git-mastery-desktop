import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import { cx } from "../../utils/cx";

const MAX_HEIGHT = 132;

type ComposerProps = {
  disabled?: boolean;
  busy?: boolean;
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
        "flex items-end gap-1.5 rounded-2xl border border-neutral-200 bg-white py-1.5 pr-1.5 pl-2.5",
        "focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100",
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
        placeholder={placeholder}
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
        className="max-h-[132px] min-h-7 flex-1 resize-none self-center bg-transparent py-1 text-[13px] leading-[1.5] text-[#333] placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed"
      />
      {busy ? (
        <button
          type="button"
          aria-label="Stop generating"
          onClick={onStop}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 hover:cursor-pointer hover:bg-neutral-300 focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:outline-none"
        >
          <IconPlayerStopFilled size={12} />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={cx(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:cursor-pointer hover:bg-brand-700",
            "focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:outline-none",
            !canSend && "pointer-events-none opacity-50",
          )}
        >
          <IconArrowUp size={15} />
        </button>
      )}
    </form>
  );
};
