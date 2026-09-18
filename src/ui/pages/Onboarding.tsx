import { useState } from "react";
import logo from "../assets/logo.png";
import { useEmbeddedSuppressed } from "../hooks/useEmbeddedSuppressed";
import { FileLocationPanel } from "../components/Setup/FileLocationPanel";
import { SetupChecklist } from "../components/Setup/SetupChecklist";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Stepper } from "../components/ui/Stepper";
import { Tooltip } from "../components/ui/Tooltip";

const STEPS = ["File location", "Setup"];

/**
 * First run only. Walks through the two things that need attention before the
 * app is usable: where exercise files live, then the prerequisite tools. Both
 * panels stay available afterwards from the settings menu, so the second step
 * can be left unfinished.
 */
export const Onboarding = ({
  onCompleteOnboarding,
}: {
  onCompleteOnboarding: () => void;
}) => {
  // The webcontentsview showing the GitMastery webpage is a native view that
  // paints above this React app, so it has to stay collapsed while onboarding
  // is on screen.
  useEmbeddedSuppressed(true);

  const [step, setStep] = useState(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [toolsReady, setToolsReady] = useState(false);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas">
      <Card className="w-[680px] max-w-[92vw] p-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Git-Mastery logo"
              className="h-12 w-12 shrink-0"
            />
            <h1 className="font-heading text-[1.2rem]/[1.4] font-semibold text-fg">
              Set up Git-Mastery
            </h1>
          </div>

          {/* Two steps stretched across the card look lopsided, so the
              separator is kept short and the pair centred. */}
          <Stepper
            className="mx-auto w-1/2"
            active={step}
            steps={STEPS}
            onStepClick={setStep}
          />

          {step === 0 ? (
            <FileLocationPanel onChange={setFolder} />
          ) : (
            <div className="flex flex-col gap-3">
              <SetupChecklist onReadyChange={setToolsReady} />
              <p className="text-[13px] text-muted">
                You can skip anything unfinished and finish it later in
                Settings.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            {step === 0 ? (
              <Tooltip
                label="Pick a save location first."
                disabled={Boolean(folder)}
                width={280}
              >
                <Button disabled={!folder} onClick={() => setStep(1)}>
                  Continue
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                label="Some tools are missing. You can finish setup later in Settings."
                disabled={toolsReady}
                width={280}
              >
                <Button onClick={onCompleteOnboarding}>Finish</Button>
              </Tooltip>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
