// This provider handles the current "Activity" state of the application.
// -- An activity is an active `Exercise`.
// Its responsibility is to:
// 1. Keep track of the current activity
// 2. Start and end activities
// -- Communicate to the backend to set the working directory, etc.
// 3. Report verification progress and results
//
// Verification can also be triggered by the Verify button injected into the
// embedded exercise page, which talks to the main process directly. Everything
// here is therefore keyed off the exercise identifier in the stream payload
// rather than off the current activity.

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Exercise } from "../../types/Exercise";
import { useElectronStream } from "../hooks/useElectronStream";
import { useLocalExercises } from "../hooks/query/useLocalExercises";
import {
  ActivityContext,
  type ActivityFocusNotice,
} from "../contexts/ActivityContext";
import { FirstStartModal } from "../components/Setup/FirstStartModal";
import { VerifyBlockedModal } from "../components/Setup/VerifyBlockedModal";
import { useExercises } from "../hooks/query/useExercises";
import { formatActivityName, isHandsOnIdentifier } from "../utils/format";

const isVerifyCommand = (cmd: string) => cmd.startsWith("verify");

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { downloadedExerciseData, patchExerciseStatus } = useLocalExercises();
  const { query: exercisesQuery } = useExercises();

  const [gate, setGate] = useState<{
    exerciseIdentifier: string;
    step: Exclude<FirstRunStep, "intro">;
  } | null>(null);
  const [verifyBlocked, setVerifyBlocked] = useState(false);
  const [focusNotice, setFocusNotice] = useState<ActivityFocusNotice | null>(
    null,
  );

  const startExercise = (exercise: Exercise) => {
    void window.electron.startExercise(exercise.identifier, {
      skipIntro: true,
    });
  };

  const activityNameFor = (exerciseIdentifier: string) => {
    const exercise = Object.values(exercisesQuery.data ?? {}).find(
      (item) => item.identifier === exerciseIdentifier,
    );
    return formatActivityName(exerciseIdentifier, exercise);
  };

  const onStartExerciseStarted = (payload: StartExerciseStarted) => {
    const { exerciseIdentifier } = payload;
    setFocusNotice({
      kind: "start",
      exerciseIdentifier,
      activityName: activityNameFor(exerciseIdentifier),
      activityKind: isHandsOnIdentifier(exerciseIdentifier)
        ? "hands-on"
        : "exercise",
      status: "downloading",
      open: true,
    });
  };

  /**
   * The main process reports every start, whether it came from the app or from
   * the button injected into the embedded lesson page. The modal stays open
   * while the download runs, but dismissing it never cancels the task.
   */
  const onStartExerciseResult = (result: StartExerciseResult) => {
    if (result.firstRunStep && result.exerciseIdentifier) {
      setFocusNotice(null);
      if (result.firstRunStep === "intro") {
        const exerciseIdentifier = result.exerciseIdentifier;
        void window.electron.hideStartIntro().then(() =>
          window.electron.startExercise(exerciseIdentifier, {
            skipIntro: true,
          }),
        );
        return;
      }
      setGate({
        exerciseIdentifier: result.exerciseIdentifier,
        step: result.firstRunStep,
      });
      return;
    }
    setGate(null);
    if (!result.exerciseIdentifier) return;
    const exerciseIdentifier = result.exerciseIdentifier;
    setFocusNotice((current) => {
      const matching =
        current?.kind === "start" &&
        current.exerciseIdentifier === exerciseIdentifier;
      const base = matching
        ? current
        : {
            kind: "start" as const,
            exerciseIdentifier,
            activityName: activityNameFor(exerciseIdentifier),
            activityKind: isHandsOnIdentifier(exerciseIdentifier)
              ? ("hands-on" as const)
              : ("exercise" as const),
            open: true,
          };
      return {
        ...base,
        status: result.ok ? "ready" : "failed",
        message: result.ok
          ? undefined
          : result.needsRestart
            ? "Delete that folder and start the activity again for a clean copy."
            : result.error,
      };
    });
  };

  const onStartExerciseStartedRef = useRef(onStartExerciseStarted);
  const onStartExerciseResultRef = useRef(onStartExerciseResult);
  const onVerifyBlocked = () => {
    setVerifyBlocked(true);
  };

  const onVerifyBlockedRef = useRef(onVerifyBlocked);
  useEffect(() => {
    onStartExerciseStartedRef.current = onStartExerciseStarted;
    onStartExerciseResultRef.current = onStartExerciseResult;
    onVerifyBlockedRef.current = onVerifyBlocked;
  });
  useEffect(
    () =>
      window.electron.onStartExerciseStarted((payload) =>
        onStartExerciseStartedRef.current(payload),
      ),
    [],
  );
  useEffect(
    () =>
      window.electron.onStartExerciseResult((result) =>
        onStartExerciseResultRef.current(result),
      ),
    [],
  );
  useEffect(
    () => window.electron.onVerifyBlocked(() => onVerifyBlockedRef.current()),
    [],
  );

  const ignoreVerifyProgress = () => {};

  const _onExerciseVerifiedSuccess = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    const { incorrect, correct } = (data.completed?.data ?? {}) as {
      correct?: boolean;
      incorrect?: boolean;
    };

    const exerciseIdentifier = data.exerciseIdentifier;
    if (exerciseIdentifier) {
      setFocusNotice({
        kind: "verify",
        exerciseIdentifier,
        activityName: activityNameFor(exerciseIdentifier),
        result: correct ? "correct" : incorrect ? "incorrect" : "complete",
        open: true,
      });
    }

    if (exerciseIdentifier && isHandsOnIdentifier(exerciseIdentifier)) {
      return;
    }
    if (exerciseIdentifier && correct) {
      patchExerciseStatus(exerciseIdentifier, "completed");
    } else if (exerciseIdentifier && incorrect) {
      const current = downloadedExerciseData?.[exerciseIdentifier]?.status;
      if (current === "downloaded" || current === undefined) {
        patchExerciseStatus(exerciseIdentifier, "in-progress");
      }
    }
  };

  const _onExerciseVerifiedFailure = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    const message = data.completed?.message;
    if (!data.exerciseIdentifier) return;
    setFocusNotice({
      kind: "verify",
      exerciseIdentifier: data.exerciseIdentifier,
      activityName: activityNameFor(data.exerciseIdentifier),
      result: "failed",
      message: message && message.length <= 200 ? message : undefined,
      open: true,
    });
  };

  useElectronStream({
    condition: isVerifyCommand,
    onData: ignoreVerifyProgress,
    onSuccessExit: _onExerciseVerifiedSuccess,
    onFailedExit: _onExerciseVerifiedFailure,
  });

  const onGateResolved = (step: FirstRunStep | null) => {
    if (!gate) return;
    if (step === null) {
      const exerciseIdentifier = gate.exerciseIdentifier;
      setGate(null);
      void window.electron.startExercise(exerciseIdentifier, {
        skipIntro: true,
      });
      return;
    }
    if (step !== "intro") {
      setGate({ exerciseIdentifier: gate.exerciseIdentifier, step });
    }
  };

  return (
    <ActivityContext.Provider
      value={{
        startExercise,
        focusNotice,
        dismissFocusNotice: () =>
          setFocusNotice((current) =>
            current ? { ...current, open: false } : current,
          ),
      }}
    >
      {children}
      {gate && (
        <FirstStartModal
          step={gate.step}
          onClose={() => setGate(null)}
          onResolved={onGateResolved}
        />
      )}
      {verifyBlocked && (
        <VerifyBlockedModal onClose={() => setVerifyBlocked(false)} />
      )}
    </ActivityContext.Provider>
  );
}
