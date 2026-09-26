import { useState } from "react";
import { IconChevronDown, IconEye } from "@tabler/icons-react";
import { Spinner } from "../ui/Spinner";
import { cx } from "../../utils/cx";

/**
 * The student-facing record of what leaves their machine: the exact blocks
 * sent with the latest message (or, before the first one, what would be sent).
 */
export const ContextDisclosure = ({
  blocks,
}: {
  /** Null while the first snapshot is still being read. */
  blocks: AiContextBlock[] | null;
}) => {
  const [open, setOpen] = useState(false);

  if (blocks === null) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-[12px] text-muted">
        <Spinner size={12} className="text-current" />
        Reading your exercise…
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2 text-[12px] text-warning">
        Could not read this exercise&apos;s instructions or folder. Answers will
        be less specific.
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md text-left text-[12px] text-muted hover:cursor-pointer hover:text-fg focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <IconEye size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          AI can see: {blocks.map((block) => block.label).join(" · ")}
        </span>
        <IconChevronDown
          size={14}
          className={cx("shrink-0", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-2 max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border bg-subtle p-3">
          {blocks.map((block) => (
            <div key={block.id}>
              <div className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                {block.label}
              </div>
              <pre className="mt-1 font-mono text-[11.5px] leading-5 whitespace-pre-wrap text-fg">
                {block.text}
              </pre>
            </div>
          ))}
          <p className="text-[11.5px] text-muted">
            Refreshed every time you send a message. File contents are never
            sent.
          </p>
        </div>
      )}
    </div>
  );
};
