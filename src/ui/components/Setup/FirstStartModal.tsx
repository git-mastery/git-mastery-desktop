import { Modal } from "../ui/Modal";
import {
  GIT_PREP_SETUP_URL,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { ExerciseFolderPanel } from "./ExerciseFolderPanel";

type SetupStep = Exclude<FirstRunStep, "intro">;

const TITLES: Record<SetupStep, string> = {
  tools: "Git-Mastery CLI was not found.",
  folder: "Choose your exercises folder",
};

/**
 * Walks a learner through missing Start prerequisites: the CLI (and Git Bash
 * on Windows), then the exercises folder. The activity modal owns the
 * introduction and download progress.
 */
export const FirstStartModal = ({
  step,
  onClose,
  onResolved,
}: {
  step: SetupStep;
  onClose: () => void;
  /** Called with the next outstanding step, or null when Start can run. */
  onResolved: (step: FirstRunStep | null) => void;
}) => {
  const advance = async () => {
    const result = await window.electron.checkStartPrereqs({ skipIntro: true });
    onResolved(result.step);
    return result;
  };

  return (
    <Modal opened onClose={onClose} title={TITLES[step]} size="sm">
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
