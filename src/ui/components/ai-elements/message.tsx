import { code } from "@streamdown/code";
import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

/**
 * Trimmed from the AI Elements registry. The stock file also exports
 * MessageAction, MessageBranch*, and MessageToolbar — those were the only
 * things importing shadcn's button, button-group, and tooltip, and this app
 * renders none of them. What is left needs no primitives at all, so the
 * component tree is house-styled Tailwind on top of the registry's layout.
 */

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-1.5",
      from === "user" ? "is-user items-end" : "is-assistant items-start",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

/**
 * Chat convention, and the house rule that surfaces stay solid: the student's
 * turn is a brand-tinted bubble, the assistant's is unboxed body copy so long
 * answers read as prose rather than as a wall of filled panel.
 */
export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex min-w-0 flex-col gap-2 text-[13px] leading-[1.55] text-[#333]",
      "group-[.is-user]:max-w-[88%] group-[.is-user]:rounded-2xl group-[.is-user]:bg-brand-50 group-[.is-user]:px-3.5 group-[.is-user]:py-2",
      "group-[.is-assistant]:w-full",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

// Math and mermaid rendering are dropped from the stock plugin set: hints are
// prose and shell commands, so both would be dead weight in the bundle.
const streamdownPlugins = { code };

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        // Streamdown emits unstyled markdown; these carry the house type scale
        // and neutral ramp into it.
        "[&_p]:my-2 [&_p]:leading-[1.55]",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:font-heading [&_h1]:text-[1.05rem] [&_h1]:font-semibold",
        "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-heading [&_h2]:text-[1rem] [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-[13px] [&_h3]:font-semibold",
        "[&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_strong]:text-[#333]",
        "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:border [&_:not(pre)>code]:border-neutral-200 [&_:not(pre)>code]:bg-neutral-50 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[12px] [&_:not(pre)>code]:text-[#333]",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600",
        className,
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
