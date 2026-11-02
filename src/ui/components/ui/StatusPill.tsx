import { cx } from "../../utils/cx";

const TONE_CLASSES: Record<ProgressState, string> = {
  downloaded: "border-border/60 bg-subtle/40 text-muted",
  "in-progress": "border-warning-border/60 bg-warning-soft/40 text-warning",
  completed: "border-accent-border/60 bg-accent-soft/40 text-accent",
};

const STATUS_LABELS: Record<ProgressState, string> = {
  downloaded: "Downloaded",
  "in-progress": "In progress",
  completed: "Completed",
};

export const StatusPill = ({
  status,
  className,
}: {
  status: ProgressState;
  className?: string;
}) => {
  const label = STATUS_LABELS[status];
  return (
    <span
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-normal whitespace-nowrap",
        TONE_CLASSES[status],
        className,
      )}
    >
      {label}
    </span>
  );
};
