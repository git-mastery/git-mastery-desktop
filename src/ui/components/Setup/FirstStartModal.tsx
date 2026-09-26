import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import {
  GIT_PREP_SETUP_URL,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { ExerciseFolderPanel } from "./ExerciseFolderPanel";

const TITLES: Record<FirstRunStep, string> = {
  intro: "Before you start",
  tools: "Install the tools",
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
  onClose,
  onResolved,
}: {
  step: FirstRunStep;
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
      {step === "intro" && (
        <IntroStep
          onContinue={async (hideAgain) => {
            if (hideAgain) await window.electron.hideStartIntro();
            await advance();
          }}
        />
      )}
      {step === "tools" && (
        <ToolsStep onRecheck={advance} onOpenGuide={onClose} />
      )}
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

const ToolsStep = ({
  onRecheck,
  onOpenGuide,
}: {
  onRecheck: () => Promise<{ step: FirstRunStep | null; tools: ToolsStatus }>;
  onOpenGuide: () => void;
}) => {
  const { navigate } = useWebContentsView();
  const [tools, setTools] = useState<ToolsStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.electron
      .checkStartPrereqs({ skipIntro: true })
      .then((result) => setTools(result.tools))
      .catch(() => setTools(null));
  }, []);

  const showRecheck = tools !== null && tools.gitBash === null;

  return (
    <div className="flex flex-col gap-4 text-sm text-fg">
      {tools === null ? (
        <Spinner size={20} />
      ) : (
        <ul className="flex flex-col gap-1 text-[13px]">
          <ToolLine label="Git-Mastery CLI" ok={tools.cli} />
          {tools.gitBash !== null && (
            <ToolLine label="Git Bash" ok={tools.gitBash} />
          )}
        </ul>
      )}

      {tools !== null && (
        <p className="text-[13px] text-muted">
          {showRecheck
            ? "Install anything missing, then check again."
            : "Install anything missing, then quit and reopen the app so it can see the new tools."}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {showRecheck && (
          <Button
            variant="secondary"
            loading={checking}
            onClick={() => {
              setChecking(true);
              void onRecheck()
                .then((result) => setTools(result.tools))
                .finally(() => setChecking(false));
            }}
          >
            Check again
          </Button>
        )}
        <Button
          onClick={() => {
            navigate(GIT_PREP_SETUP_URL);
            onOpenGuide();
          }}
        >
          Setup instructions
        </Button>
      </div>
    </div>
  );
};

const ToolLine = ({ label, ok }: { label: string; ok: boolean }) => (
  <li className={ok ? "text-muted" : "text-fg"}>
    {ok ? `${label} is installed.` : `${label} was not found.`}
  </li>
);
