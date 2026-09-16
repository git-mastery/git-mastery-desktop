import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils/cx";
import { Spinner } from "./Spinner";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `ghost` for neutral chrome, `soft` for inline fix-it actions. */
  variant?: "ghost" | "soft";
  size?: "sm" | "md";
  loading?: boolean;
  /** Icon-only controls always need a label. */
  "aria-label": string;
  children: ReactNode;
};

const VARIANTS = {
  ghost: "rounded-full text-muted hover:bg-hover hover:text-fg",
  soft: "rounded-md bg-accent-soft text-accent hover:bg-accent-soft-hover",
} as const;

const SIZES = { sm: "h-7 w-7", md: "h-9 w-9" } as const;

export const IconButton = ({
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: IconButtonProps) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cx(
      "inline-flex shrink-0 items-center justify-center hover:cursor-pointer",
      "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
      VARIANTS[variant],
      SIZES[size],
      (disabled || loading) && "pointer-events-none opacity-50",
      className,
    )}
    {...rest}
  >
    {loading ? <Spinner size={16} className="text-current" /> : children}
  </button>
);
