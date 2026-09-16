import { IconCheck } from "@tabler/icons-react";
import { cx } from "../../utils/cx";

/**
 * Short progress rail for the first-run flow. Steps already passed can be
 * revisited; steps ahead cannot be jumped to.
 */
export const Stepper = ({
  active,
  steps,
  onStepClick,
  className,
}: {
  active: number;
  steps: string[];
  onStepClick?: (index: number) => void;
  className?: string;
}) => (
  <div className={cx("flex items-start", className)}>
    {steps.map((label, index) => {
      const done = index < active;
      const current = index === active;
      const selectable = index <= active && Boolean(onStepClick);

      return (
        <div key={label} className="flex flex-1 items-start last:flex-none">
          <div className="flex w-[92px] shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={!selectable}
              aria-current={current ? "step" : undefined}
              onClick={() => onStepClick?.(index)}
              className={cx(
                "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-medium",
                "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
                selectable && "hover:cursor-pointer",
                done && "bg-brand-600 text-white",
                current && "border-2 border-brand-600 text-accent",
                !done &&
                  !current &&
                  "cursor-default border border-border text-faint",
              )}
            >
              {done ? <IconCheck size={16} /> : index + 1}
            </button>
            <span
              className={cx(
                "text-center text-[13px]",
                current || done ? "text-fg" : "text-faint",
              )}
            >
              {label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cx(
                "mt-[15px] h-px flex-1",
                done ? "bg-brand-600" : "bg-border",
              )}
            />
          )}
        </div>
      );
    })}
  </div>
);
