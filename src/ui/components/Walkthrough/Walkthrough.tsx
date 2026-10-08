import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "../ui/Button";
import { useEmbeddedSuppressed } from "../../hooks/useEmbeddedSuppressed";
import { cx } from "../../utils/cx";
import {
  WALKTHROUGH_STEPS,
  type WalkthroughStep,
} from "../../hooks/useWalkthrough";
import gitMasteryLogo from "../../../../resources/icon.png";

/** Full-window welcome shown before the two-pane tour steps. */
export const WalkthroughWelcome = ({ onNext }: { onNext: () => void }) => {
  useEmbeddedSuppressed(true);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-canvas p-6"
      role="dialog"
      aria-label="Welcome to Git-Mastery"
    >
      <div className="w-[680px] max-w-[92vw] rounded-2xl border border-border bg-surface p-8 shadow-card">
        <img
          src={gitMasteryLogo}
          alt=""
          width={48}
          height={48}
          className="mb-4 size-12"
        />
        <h1 className="font-heading text-[1.75rem]/[1.3] font-semibold text-fg">
          Welcome to Git-Mastery
        </h1>
        <p className="mt-4 text-sm text-muted">
          Learn, practice, and receive feedback on your journey to Git mastery.
        </p>
        <button
          type="button"
          onClick={onNext}
          autoFocus
          className="mt-4 inline-flex items-center gap-1.5 bg-transparent p-0 text-sm text-accent hover:cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        >
          <IconArrowRight size={17} stroke={1.5} aria-hidden />
          Get Started
        </button>
      </div>
    </div>
  );
};

type PaneWalkthroughStep = Exclude<WalkthroughStep, "welcome">;

const CONTENT: Record<PaneWalkthroughStep, { title: string; body: string[] }> =
  {
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

const shieldClasses =
  "absolute inset-0 z-[20] cursor-default pointer-events-auto";

/** Dulls a DOM pane that is not the focus of the current walkthrough step. */
export const WalkthroughDim = ({ show }: { show: boolean }) =>
  show ? <div aria-hidden className={`${shieldClasses} bg-dim`} /> : null;

/** Captures pointer events without dulling (e.g. the focused lesson pane). */
export const WalkthroughShield = ({ show }: { show: boolean }) =>
  show ? (
    <div aria-hidden className={`${shieldClasses} bg-transparent`} />
  ) : null;

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
  step: PaneWalkthroughStep;
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
