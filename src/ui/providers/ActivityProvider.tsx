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
import { useToast, type ToastOptions } from "../contexts/ToastContext";
import { ActivityContext } from "../contexts/ActivityContext";
import { isHandsOnIdentifier } from "../utils/format";
import { FirstStartModal } from "../components/Setup/FirstStartModal";

const isVerifyCommand = (cmd: string) => cmd.startsWith("verify");

const verifyToastId = (exerciseIdentifier?: string) =>
  `verify-${exerciseIdentifier ?? "exercise"}`;

const startToastId = (exerciseIdentifier?: string) =>
  `start-${exerciseIdentifier ?? "exercise"}`;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { showToast, updateToast, hideToast } = useToast();

  const { downloadedExerciseData, patchExerciseStatus } = useLocalExercises();

  /** Loading toasts currently on screen, so settle can update them in place. */
  const openActionToasts = useRef<Set<string>>(new Set());

  const [gate, setGate] = useState<{
    exerciseIdentifier: string;
    step: FirstRunStep;
  } | null>(null);

  const startExercise = (exercise: Exercise) => {
    void window.electron.startExercise(exercise.identifier);
  };

  const showLoadingToast = (id: string, title: string) => {
    if (openActionToasts.current.has(id)) return;
    openActionToasts.current.add(id);
    showToast({
      id,
      title,
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });
  };

  const settleToast = (id: string, patch: Omit<ToastOptions, "id">) => {
    // Loading toasts set `autoClose: false`; an update merges over them, so the
    // countdown has to be handed back to the tone default explicitly.
    const settled = {
      loading: false,
      withCloseButton: true,
      autoClose: undefined,
      ...patch,
    };
    if (openActionToasts.current.delete(id)) {
      updateToast(id, settled);
    } else {
      showToast({ id, ...settled });
    }
  };

  const onStartExerciseStarted = (payload: StartExerciseStarted) => {
    showLoadingToast(
      startToastId(payload.exerciseIdentifier),
      "Starting exercise...",
    );
  };

  /**
   * The main process reports every start, whether it came from the app or from
   * the button injected into the embedded lesson page. Success is visible as a
   * `cd` in the terminal, so the loading toast is dismissed rather than
   * restated. Failures that are not CLI output still need a one-line toast.
   */
  const onStartExerciseResult = (result: StartExerciseResult) => {
    const id = startToastId(result.exerciseIdentifier);
    if (result.firstRunStep && result.exerciseIdentifier) {
      openActionToasts.current.delete(id);
      hideToast(id);
      setGate({
        exerciseIdentifier: result.exerciseIdentifier,
        step: result.firstRunStep,
      });
      return;
    }
    setGate(null);
    if (result.ok) {
      openActionToasts.current.delete(id);
      hideToast(id);
      return;
    }

    settleToast(id, {
      title: "Could not start exercise",
      message: result.needsRestart
        ? "Delete that folder and start the exercise again for a clean copy."
        : undefined,
      tone: "danger",
    });
  };

  const onStartExerciseStartedRef = useRef(onStartExerciseStarted);
  const onStartExerciseResultRef = useRef(onStartExerciseResult);
  const onVerifyBlockedRef = useRef((payload: VerifyBlocked) => {
    settleToast(verifyToastId(payload.exerciseIdentifier), {
      title: "Not in the exercise folder",
      tone: "info",
    });
  });
  useEffect(() => {
    onStartExerciseStartedRef.current = onStartExerciseStarted;
    onStartExerciseResultRef.current = onStartExerciseResult;
    onVerifyBlockedRef.current = (payload: VerifyBlocked) => {
      settleToast(verifyToastId(payload.exerciseIdentifier), {
        title: "Not in the exercise folder",
        tone: "info",
      });
    };
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
    () =>
      window.electron.onVerifyBlocked((payload) =>
        onVerifyBlockedRef.current(payload),
      ),
    [],
  );

  const _onExerciseVerifyData = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    showLoadingToast(verifyToastId(data.exerciseIdentifier), "Verifying...");
  };

  const _onExerciseVerifiedSuccess = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    const { incorrect, correct } = (data.completed?.data ?? {}) as {
      correct?: boolean;
      incorrect?: boolean;
    };

    const id = verifyToastId(data.exerciseIdentifier);
    if (correct) {
      settleToast(id, {
        title: "Exercise answer correct",
        tone: "success",
      });
    } else if (incorrect) {
      settleToast(id, {
        title: "Exercise answer incorrect",
        tone: "danger",
      });
    } else {
      settleToast(id, {
        title: "Verification complete",
        tone: "success",
      });
    }

    const exerciseIdentifier = data.exerciseIdentifier;
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
    settleToast(verifyToastId(data.exerciseIdentifier), {
      title: "Verification failed",
      message: message && message.length <= 200 ? message : undefined,
      tone: "danger",
    });
  };

  useElectronStream({
    condition: isVerifyCommand,
    onData: _onExerciseVerifyData,
    onSuccessExit: _onExerciseVerifiedSuccess,
    onFailedExit: _onExerciseVerifiedFailure,
  });

  const onGateResolved = (step: FirstRunStep | null) => {
    if (!gate) return;
    if (step === null) {
      const exerciseIdentifier = gate.exerciseIdentifier;
      setGate(null);
      void window.electron.startExercise(exerciseIdentifier);
      return;
    }
    setGate({ exerciseIdentifier: gate.exerciseIdentifier, step });
  };

  return (
    <ActivityContext.Provider
      value={{
        startExercise,
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
    </ActivityContext.Provider>
  );
}
