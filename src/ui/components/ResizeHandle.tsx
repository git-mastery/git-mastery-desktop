import { flushSync } from "react-dom";
import { cx } from "../utils/cx";

type ResizeHandleProps = {
  /** `x` resizes a pane's width from a side edge, `y` its height from the bottom edge. */
  axis?: "x" | "y";
  size: number;
  min: number;
  /** Evaluated when a drag starts, so window resizes cannot leave it stale. */
  max: () => number;
  cssVars: string[];
  /** Horizontal only: the handle sits on the pane's left edge. */
  invert?: boolean;
  onChange: (size: number) => void;
};

export const ResizeHandle = ({
  axis = "x",
  size,
  min,
  max,
  cssVars,
  invert = false,
  onChange,
}: ResizeHandleProps) => {
  const vertical = axis === "y";
  return (
    <div
      className={cx(
        "absolute z-100",
        vertical
          ? "bottom-0 left-0 h-1.5 w-full translate-y-1/2 cursor-row-resize"
          : cx(
              "top-0 h-full w-1.5 cursor-col-resize",
              invert ? "left-0" : "right-0",
            ),
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        const start = vertical ? e.clientY : e.clientX;
        // Panes can be squeezed below their set size by flex when the window
        // is small; starting from the rendered size keeps the drag anchored.
        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
        const startSize = rect ? (vertical ? rect.height : rect.width) : size;
        const maxSize = Math.max(min, max());
        let current = startSize;
        let raf = 0;

        const apply = (next: number) => {
          const value = `${next}px`;
          for (const name of cssVars) {
            document.documentElement.style.setProperty(name, value);
          }
        };

        const onMove = (ev: MouseEvent) => {
          const position = vertical ? ev.clientY : ev.clientX;
          const delta =
            !vertical && invert ? start - position : position - start;
          current = Math.min(maxSize, Math.max(min, startSize + delta));
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            apply(current);
          });
        };

        const onUp = () => {
          cancelAnimationFrame(raf);
          // The variable is left in place rather than removed: React state and
          // this drag write the same custom property, so clearing it here would
          // flash the pane back to its default before the commit lands.
          apply(current);
          flushSync(() => onChange(current));
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      }}
    />
  );
};
