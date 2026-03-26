// This context handles the current "Activity" state of the application.
// -- An activity can either be an active `Lessson` or an active `Exercise`.
// The responsibility of this context is to: 
// 1. Keep track of the current activity
// 2. Start and end activities
// -- Communicate to the backend to set the working directory, etc.
// 3. Track activity duration (TODO)
// 4. Verify `Exercise` correctness and handle notifications
// 5. Handle downloading exercises (TODO)

import { useState, createContext, useContext, type ReactNode, useRef } from "react";
import type { Lesson } from "../../types/Tour";
import type { Exercise } from "../../types/Exercise";
import { useLocalStorage } from "@mantine/hooks";
import { useElectronModals } from "../hooks/useElectronModals";
import { Button, Checkbox, Flex, Stack, Text } from "@mantine/core";
import { formatExerciseTitle } from "../utils/format";
import { showNotification, updateNotification } from "@mantine/notifications";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { useElectronStream } from "../hooks/useElectronStream";

type ActivityState = {
  currentLesson: Lesson | null;
  currentExercise: Exercise | null;
  isDoingActivity: boolean;
  startExercise: (exercise: Exercise) => void;
  endExercise: () => void;
  startLesson: (lesson: Lesson) => void;
  endLesson: () => void;
  getActivityText: () => string;
  endActivity: () => void;
  verifyExercise: ({ showProgress, callback }: { showProgress?: boolean, callback?: () => void }) => boolean;
};

const ActivityContext = createContext<ActivityState | null>(null);

// temporary map to store data
const activeNotifications: Record<string, any> = {}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { openConfirmModal, open, close } = useElectronModals();
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  const [showOnboardingLesson, setShowOnboardingLesson] = useLocalStorage({
    key: 'showOnboardingLesson',
    defaultValue: true,
  });

  const [showOnboardingExercise, setShowOnboardingExercise] = useLocalStorage({
    key: 'showOnboardingExercise',
    defaultValue: true,
  });



  const startExercise = (exercise: Exercise) => {
    // other logic

    // TODO: we can add a "timer" too!!
    setCurrentExercise(exercise)


    const modalId = open({
      title: "Exercise",
      children: (
        <Stack>
          <Text> You are about to begin doing an exericse. Blah blah blah.</Text>

          <Checkbox
            label="Don't show this again"
            checked={!showOnboardingExercise}
            onChange={(event) => setShowOnboardingExercise(event.currentTarget.checked)}
          />
          <Flex justify={"end"}>

            <Button onClick={() => close(modalId)}>
              Start
            </Button>
          </Flex>
        </ Stack>
      ),

    })

  }

  const startLesson = (lesson: Lesson) => {
    setCurrentLesson(lesson)
    setCurrentExercise(null)
  }

  const endExercise = () => {
    setCurrentExercise(null)
  }

  const endLesson = () => {
    setCurrentLesson(null)
  }

  const endActivity = () => {
    setCurrentLesson(null)
    setCurrentExercise(null)
  }

  const getExerciseText = () => {
    if (currentExercise) {
      return formatExerciseTitle(currentExercise)
    }
    return ""
  }
  const getLessonText = () => {
    return "" // TODO
  }

  const getActivityText = () => {
    if (currentExercise) {
      return getExerciseText()
    }
    if (currentLesson) {
      return getLessonText()
    }
    return ""
  }

  const isDoingActivity =
    currentLesson !== null || currentExercise !== null


  const showProgressRef = useRef<boolean>(true);
  const exerciseVerifyCallbackRef = useRef<() => void>(null);


  /**
   * Begins the process of verifying the current exercise.
   * 
   * @param [showProgress=true] - Whether to show the progress toast
   * @param callback - Callback function to be called when the exercise is verified
   * 
   * @returns true if exercise has began verifying, false if not
   */
  const verifyExercise = ({ showProgress = true, callback = () => { } }: { showProgress?: boolean, callback?: () => void }) => {
    if (!currentExercise) {
      return false
    }
    showProgressRef.current = showProgress;
    exerciseVerifyCallbackRef.current = callback;
    window.electron.startGitMasteryTask(`verify ${currentExercise.identifier}`)

    if (!activeNotifications[currentExercise.identifier]) {
      activeNotifications[currentExercise.identifier] =
        showNotification({
          id: 'currentExercise.identifier',
          title: "Verifying",
          message: "Verifying...",
          loading: true,
          autoClose: false,
          withCloseButton: false,
        })
    }
    return true
  }

  const _onExerciseVerifyData = (originalCommand: string, data: GitMasteryTaskData) => {
    if (!currentExercise) {
      return
    }
    updateNotification({
      id: activeNotifications[currentExercise.identifier],
      message: data.success!.message,
    })
  }

  const _onExerciseVerifiedSuccess = (originalCommand: string, data: GitMasteryTaskData) => {
    if (!currentExercise) {
      return
    }

    // check to see if it was success or failure

    // const isSuccess = 
    updateNotification({
      id: activeNotifications[currentExercise.identifier],
      title: "Verification complete.",
      message: "",
      loading: false,
      color: "gm-green",
      icon: <IconInfoCircle size={18} />,
      autoClose: 5000,
      withCloseButton: true,
    })

    // cleanup
    delete activeNotifications[currentExercise.identifier];

    // callback
    exerciseVerifyCallbackRef.current?.();
    exerciseVerifyCallbackRef.current = null;

    checkVerificationStatus(data.completed!.stdout!)
  }

  const _onExerciseVerifiedFailure = (originalCommand: string, data: GitMasteryTaskData) => {
    // TODO: Show a toast OR show a success
  }
  const { } = useElectronStream({
    condition: (cmd: string) => cmd.startsWith("verify"),
    onData: _onExerciseVerifyData,
    onSuccessExit: _onExerciseVerifiedSuccess,
    onFailedExit: _onExerciseVerifiedFailure,
  });

  return (
    <ActivityContext.Provider value={{ currentLesson, currentExercise, startExercise, endExercise, startLesson, endLesson, getActivityText, isDoingActivity, endActivity, verifyExercise }}>
      {children}
    </ActivityContext.Provider>
  );
}

/**
 * Hook that tracks the current activity (lesson and exercise)
 */
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return context;
}

const checkVerificationStatus = (stdout: string) => {
  console.log({ stdout })
}