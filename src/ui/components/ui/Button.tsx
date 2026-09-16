import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils/cx";
import { Spinner } from "./Spinner";

type ButtonVariant =
  "primary" | "outline" | "secondary" | "danger" | "dangerOutline";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  outline: "border border-brand-600 text-accent hover:bg-accent-soft",
  secondary: "border border-border bg-surface text-fg hover:bg-hover",
  danger: "bg-danger-solid text-white shadow-sm hover:bg-danger-solid-hover",
  dangerOutline: "border border-danger-border text-danger hover:bg-danger-soft",
};

const SIZES = {
  sm: "px-2.5 py-1 text-[13px] gap-1.5",
  md: "px-3 py-1.5 text-sm gap-2",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  /** Swaps the leading icon for a spinner without resizing the button. */
  loading?: boolean;
  leftIcon?: ReactNode;
};

export const Button = ({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cx(
      "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap hover:cursor-pointer",
      "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-brand-400 focus-visible:outline-none",
      VARIANTS[variant],
      SIZES[size],
      (disabled || loading) && "pointer-events-none opacity-50",
      className,
    )}
    {...rest}
  >
    {loading ? (
      <Spinner size={14} className="text-current" />
    ) : (
      leftIcon && <span className="flex shrink-0 items-center">{leftIcon}</span>
    )}
    {children}
  </button>
);
