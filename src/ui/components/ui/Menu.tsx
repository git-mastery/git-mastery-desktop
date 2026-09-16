import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../../utils/cx";

/**
 * Icon trigger plus a labelled item list.
 *
 * Closes on outside click and Escape, and hands focus back to the trigger so
 * keyboard users are not dropped at the top of the document.
 */
export const Menu = ({
  trigger,
  children,
  className,
}: {
  /** Rendered with the props that toggle the panel. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
  }) => ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 z-[300] mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-card"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
    {children}
  </div>
);

export const MenuItem = ({
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) => (
  <button
    type="button"
    role="menuitem"
    className={cx(
      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fg",
      "hover:cursor-pointer hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
      className,
    )}
    {...rest}
  >
    {icon && <span className="flex shrink-0 text-muted">{icon}</span>}
    {children}
  </button>
);
