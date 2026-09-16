import { cx } from "../../utils/cx";

const TONE_CLASSES: Record<ProgressState, string> = {
  downloaded: "border-border bg-subtle text-muted",
  "in-progress": "border-warning-border bg-warning-soft text-warning",
  completed: "border-accent-border bg-accent-soft text-accent",
};

const STATUS_LABELS: Record<ProgressState, string> = {
  downloaded: "Downloaded",
  "in-progress": "In progress",
  completed: "Completed",
};

export const StatusPill = ({ status }: { status: ProgressState }) => {
  const label = STATUS_LABELS[status];
  return (
    <span
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASSES[status],
      )}
    >
      {label}
    </span>
  );
};
