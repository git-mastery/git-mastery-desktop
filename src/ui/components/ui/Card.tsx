import type { ReactNode } from "react";
import { cx } from "../../utils/cx";

/** Solid panel. `elevated` is for surfaces that float above content. */
export const Card = ({
  elevated = false,
  className,
  children,
}: {
  elevated?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cx(
      "rounded-2xl border border-border bg-surface p-6",
      elevated && "shadow-card",
      className,
    )}
  >
    {children}
  </div>
);
