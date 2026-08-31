import { IconArrowDown } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { IconButton } from "../ui/IconButton";

/**
 * Trimmed from the AI Elements registry. The stock file's ConversationDownload
 * is unused here, and its scroll button was the only thing importing shadcn's
 * Button — that is now the house IconButton, so this file needs no primitives.
 *
 * StickToBottom is kept: it pins the view to the newest token while streaming
 * but yields the moment the student scrolls up to reread, which is fiddly
 * enough to be worth not reimplementing.
 */

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn("flex flex-col gap-5 px-3.5 py-4", className)}
    {...props}
  />
);

export type ConversationEmptyStateProps = ComponentProps<"div">;

export const ConversationEmptyState = ({
  className,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-2 px-4 py-10 text-center",
      className,
    )}
    {...props}
  />
);

export const ConversationScrollButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <IconButton
      aria-label="Scroll to latest"
      size="sm"
      onClick={handleScrollToBottom}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 border border-neutral-200 bg-white shadow-card hover:bg-neutral-50"
    >
      <IconArrowDown size={15} />
    </IconButton>
  );
};
