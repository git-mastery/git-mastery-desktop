import { useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import {
  GIT_PREP_SETUP_URL,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { ExerciseFolderPanel } from "./ExerciseFolderPanel";

const TITLES: Record<Exclude<FirstRunStep, "intro">, string> = {
  tools: "Git-Mastery CLI was not found.",
  folder: "Choose your exercises folder",
};

/**
 * Walks a learner through Start: a short introduction, then the CLI
 * (and Git Bash on Windows), then the exercises folder. The introduction
 * repeats until they check "Don't show this again". Closing it does
 * nothing else; the next Start resumes at whichever step is still missing.
 */
export const FirstStartModal = ({
  step,
  activityName,
  onClose,
  onResolved,
}: {
  step: FirstRunStep;
  activityName: string;
  onClose: () => void;
  /** Called with the next outstanding step, or null when Start can run. */
  onResolved: (step: FirstRunStep | null) => void;
}) => {
  const advance = async () => {
    const result = await window.electron.checkStartPrereqs({ skipIntro: true });
    onResolved(result.step);
    return result;
  };

  const title = step === "intro" ? `Starting ${activityName}` : TITLES[step];

  return (
    <Modal opened onClose={onClose} title={title} size="sm">
      {step === "intro" && (
        <IntroStep
          onContinue={async (hideAgain) => {
            if (hideAgain) await window.electron.hideStartIntro();
            await advance();
          }}
        />
      )}
      {step === "tools" && <ToolsStep onOpenGuide={onClose} />}
      {step === "folder" && (
        <ExerciseFolderPanel
          onSaved={() => void advance()}
          onOpenGuide={onClose}
        />
      )}
    </Modal>
  );
};

const IntroStep = ({
  onContinue,
}: {
  onContinue: (hideAgain: boolean) => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const hideAgainRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4 text-sm text-fg">
      <p>
        You&apos;ll get a folder with starting files. Work on it in the terminal
        on the right, then click Verify to check your answer.
      </p>
      <p>Hands-on practicals work the same way, without a check at the end.</p>
      <Checkbox ref={hideAgainRef} label="Don't show this again" />
      <div className="flex justify-end">
        <Button
          loading={busy}
          onClick={() => {
            setBusy(true);
            void onContinue(Boolean(hideAgainRef.current?.checked)).finally(
              () => setBusy(false),
            );
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

const ToolsStep = ({ onOpenGuide }: { onOpenGuide: () => void }) => {
  const { navigate } = useWebContentsView();

  return (
    <p className="text-sm text-muted">
      Download and set up gitmastery{" "}
      <button
        type="button"
        onClick={() => {
          navigate(GIT_PREP_SETUP_URL);
          onOpenGuide();
        }}
        className="text-accent underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        here
      </button>
      .
    </p>
  );
};
