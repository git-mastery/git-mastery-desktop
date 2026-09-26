import { Button } from "../ui/Button";
import { cx } from "../../utils/cx";
import {
  WALKTHROUGH_STEPS,
  type WalkthroughStep,
} from "../../hooks/useWalkthrough";

const CONTENT: Record<WalkthroughStep, { title: string; body: string[] }> = {
  lessons: {
    title: "1. Lessons",
    body: [
      "Go through the lessons in order and follow their instructions.",
      "When a lesson has an exercise or hands-on practical, attempt it.",
    ],
  },
  terminal: {
    title: "2. Terminal",
    body: [
      "Run Git and any other commands here.",
      "It works just like the terminal on your computer.",
    ],
  },
};

/** Dulls a DOM pane that is not the focus of the current walkthrough step. */
export const WalkthroughDim = ({ show }: { show: boolean }) =>
  show ? <div aria-hidden className="absolute inset-0 z-[20] bg-dim" /> : null;

/**
 * The step card. It always sits in the terminal column: anything placed over
 * the lesson pane would be hidden under the native web view.
 */
export const WalkthroughCard = ({
  step,
  index,
  onNext,
  onBack,
}: {
  step: WalkthroughStep;
  index: number;
  onNext: () => void;
  onBack: () => void;
}) => {
  const content = CONTENT[step];
  const isLast = index === WALKTHROUGH_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label={content.title}
      className={cx(
        "absolute inset-x-4 z-[30] flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card",
        step === "lessons" ? "top-1/2 -translate-y-1/2" : "bottom-4",
      )}
    >
      <h2 className="text-[15px] font-semibold text-fg">{content.title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted">
        {content.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="mt-1 flex justify-end gap-2">
        {index > 0 && (
          <Button size="sm" variant="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button size="sm" onClick={onNext} autoFocus>
          {isLast ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
};
