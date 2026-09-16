import type { InputHTMLAttributes, Ref } from "react";
import { cx } from "../../utils/cx";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Callers read `.checked` off this on submit rather than tracking state. */
  ref?: Ref<HTMLInputElement>;
};

export const Checkbox = ({ label, className, ref, ...rest }: CheckboxProps) => (
  <label className={cx("flex items-center gap-2 text-sm text-fg", className)}>
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-border accent-brand-600 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      {...rest}
    />
    {label}
  </label>
);
