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

import { type ReactNode, useEffect, useRef } from "react";
import type { Exercise } from "../../types/Exercise";
import { IconInfoCircle } from "@tabler/icons-react";
import { useElectronStream } from "../hooks/useElectronStream";
import { useLocalExercises } from "../hooks/query/useLocalExercises";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useModal } from "../contexts/ModalContext";
import { useToast, type ToastOptions } from "../contexts/ToastContext";
import { ActivityContext } from "../contexts/ActivityContext";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import {
  formatExerciseIdentifier,
  formatHandsOnTitle,
  isHandsOnIdentifier,
} from "../utils/format";

const isVerifyCommand = (cmd: string) => cmd.startsWith("verify");

const verifyNotificationId = (data: GitMasteryTaskData) =>
  `verify-${data.exerciseIdentifier ?? "exercise"}`;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { openModal, closeModal } = useModal();
  const { showToast, updateToast } = useToast();

  const [showOnboardingExercise, setShowOnboardingExercise] = useLocalStorage({
    key: "showOnboardingExercise",
    defaultValue: true,
  });

  const showOnboardingRef = useRef<HTMLInputElement>(null);

  const { downloadedExerciseData, patchExerciseStatus } = useLocalExercises();

  /** Verify notifications currently on screen, keyed by notification id. */
  const openVerifyNotifications = useRef<Set<string>>(new Set());

  /** First-run explainer for the exercise workflow. */
  const showExerciseOnboarding = () => {
    if (showOnboardingExercise) {
      const modalId = openModal({
        title: "Exercise",
        size: "sm",
        children: (
          <div className="flex flex-col gap-4 text-sm text-[#333]">
            <p>
              You are about to begin doing an exercise. Work through the
              exercise in the terminal and click Verify when you think you are
              done.
            </p>

            <Checkbox ref={showOnboardingRef} label="Don't show this again" />
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  closeModal(modalId);
                  if (showOnboardingRef.current) {
                    setShowOnboardingExercise(
                      !showOnboardingRef.current.checked,
                    );
                  }
                }}
              >
                Start
              </Button>
            </div>
          </div>
        ),
      });
    }
  };

  const startExercise = (exercise: Exercise) => {
    void window.electron.startExercise(exercise.identifier);
  };

  /**
   * The main process reports every start, whether it came from the app or from
   * the button injected into the embedded lesson page, once the terminal is in
   * the exercise directory. Verify refuses to run until that has happened, so a
   * failure here has to be surfaced rather than swallowed.
   */
  const onStartExerciseResult = (result: StartExerciseResult) => {
    if (result.ok) {
      const handsOn = isHandsOnIdentifier(result.exerciseIdentifier ?? "");
      if (!handsOn) showExerciseOnboarding();
      const name = result.exerciseIdentifier
        ? handsOn
          ? formatHandsOnTitle(result.exerciseIdentifier)
          : formatExerciseIdentifier(result.exerciseIdentifier)
        : handsOn
          ? "the hands-on"
          : "the exercise";
      showToast({
        title: handsOn
          ? `You are now attempting hands-on ${name}`
          : `You are now attempting exercise ${name}`,
        tone: "info",
        icon: <IconInfoCircle size={18} className="text-[#0369a1]" />,
      });
      return;
    }

    showToast({
      title: "Could not open the exercise folder",
      message: result.needsRestart
        ? `${result.error} Delete that folder and start the exercise again for a clean copy.`
        : (result.error ??
          "Try downloading the exercise again from the exercises list."),
      tone: "danger",
      icon: <IconInfoCircle size={18} className="text-[#b42318]" />,
      autoClose: 8000,
    });
  };

  // Freshly created each render, so it is read through a ref to subscribe once.
  const onStartExerciseResultRef = useRef(onStartExerciseResult);
  useEffect(() => {
    onStartExerciseResultRef.current = onStartExerciseResult;
  });
  useEffect(
    () =>
      window.electron.onStartExerciseResult((result) =>
        onStartExerciseResultRef.current(result),
      ),
    [],
  );

  useEffect(
    () =>
      window.electron.onVerifyBlocked(() => {
        showToast({
          title: "Not in the exercise folder",
          message:
            "Click Start Exercise to enter this exercise's folder, then verify again.",
          tone: "info",
          icon: <IconInfoCircle size={18} className="text-[#0369a1]" />,
        });
      }),
    [showToast],
  );

  /**
   * Closes off a verify notification, creating it first if the run finished
   * before any progress output arrived.
   */
  const settleVerifyNotification = (
    notification: ToastOptions & { id: string },
  ) => {
    if (openVerifyNotifications.current.delete(notification.id)) {
      updateToast(notification.id, notification);
    } else {
      showToast(notification);
    }
  };

  const _onExerciseVerifyData = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    const id = verifyNotificationId(data);

    if (!openVerifyNotifications.current.has(id)) {
      openVerifyNotifications.current.add(id);
      showToast({
        id,
        title: "Verifying",
        message: "Verifying...",
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
    }

    updateToast(id, { message: data.success!.message });
  };

  const _onExerciseVerifiedSuccess = (
    _originalCommand: string,
    data: GitMasteryTaskData,
  ) => {
    const { comments, incorrect, correct } = (data.completed?.data ?? {}) as {
      correct?: boolean;
      incorrect?: boolean;
      comments?: string;
    };

    const commentLine = comments?.trim() ? `\n${comments.trim()}` : "";

    if (correct) {
      settleVerifyNotification({
        id: verifyNotificationId(data),
        title: "Exercise completed successfully!",
        message: `You successfully completed the exercise!${commentLine}`,
        loading: false,
        tone: "success",
        autoClose: 5000,
        withCloseButton: true,
      });
    } else if (incorrect) {
      settleVerifyNotification({
        id: verifyNotificationId(data),
        title: "Exercise solution incorrect",
        message: `Your solution is not correct yet. Keep going and verify again when you are ready.${commentLine}`,
        loading: false,
        tone: "danger",
        withCloseButton: true,
      });
    } else {
      settleVerifyNotification({
        id: verifyNotificationId(data),
        title: "Verification complete.",
        message: "",
        loading: false,
        tone: "success",
        autoClose: 5000,
        withCloseButton: true,
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
    settleVerifyNotification({
      id: verifyNotificationId(data),
      title: "Verification failed",
      message: data.completed?.message ?? "Please try again",
      loading: false,
      tone: "danger",
      withCloseButton: true,
    });
  };

  useElectronStream({
    condition: isVerifyCommand,
    onData: _onExerciseVerifyData,
    onSuccessExit: _onExerciseVerifiedSuccess,
    onFailedExit: _onExerciseVerifiedFailure,
  });

  return (
    <ActivityContext.Provider
      value={{
        startExercise,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}
