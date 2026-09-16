import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { useEmbeddedSuppressed } from "../../hooks/useEmbeddedSuppressed";
import { cx } from "../../utils/cx";
import { IconButton } from "./IconButton";

const SIZES = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" } as const;

/** Every modal currently on screen, oldest first, so Escape only closes the top one. */
const openModals: string[] = [];

export const Modal = ({
  opened,
  onClose,
  title,
  size = "md",
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) => {
  const id = useId();
  // Kept in a ref so a caller passing a fresh closure each render does not
  // re-run the effect below, which would reorder this modal in the stack.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The embedded site is a native view painted above the whole React DOM, so a
  // modal is only visible while that view is collapsed.
  useEmbeddedSuppressed(opened);

  useEffect(() => {
    if (!opened) return;
    openModals.push(id);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openModals[openModals.length - 1] !== id) return;
      event.stopPropagation();
      onCloseRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.indexOf(id);
      if (index !== -1) openModals.splice(index, 1);
    };
  }, [opened, id]);

  if (!opened) return null;

  return (
    // Opens and closes instantly: the native view underneath cannot animate with
    // the DOM, so any transition here only reads as a flicker.
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-overlay p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "w-full rounded-2xl border border-border bg-surface shadow-card",
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <h3 className="font-heading text-[1.2rem]/[1.4] font-semibold text-fg">
            {title}
          </h3>
          <IconButton
            aria-label="Close"
            size="sm"
            onClick={onClose}
            className="-mt-0.5"
          >
            <IconX size={16} />
          </IconButton>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
};
