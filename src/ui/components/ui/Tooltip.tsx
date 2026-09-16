import { useId, useState, type ReactNode } from "react";
import { cx } from "../../utils/cx";

const POSITIONS = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
} as const;

/**
 * Hover / focus tooltip.
 *
 * The wrapper owns the pointer events rather than the child, so a tooltip still
 * appears over a disabled control — which is exactly where one is needed most.
 */
export const Tooltip = ({
  label,
  position = "top",
  disabled = false,
  width,
  children,
  className,
}: {
  label: string;
  position?: keyof typeof POSITIONS;
  /** Suppresses the tooltip without unmounting the child. */
  disabled?: boolean;
  width?: number;
  children: ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const visible = open && !disabled;

  return (
    <span
      className={cx("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={visible ? id : undefined} className="inline-flex">
        {children}
      </span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={width ? { width } : undefined}
          className={cx(
            "pointer-events-none absolute z-[400] rounded-md bg-tooltip px-2 py-1 text-xs leading-snug text-tooltip-fg shadow-card",
            !width && "whitespace-nowrap",
            POSITIONS[position],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
};
