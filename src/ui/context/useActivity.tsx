import { useState, createContext, useContext, type ReactNode } from "react";
import type { Lesson } from "../../types/Tour";
import type { Exercise } from "../../types/Exercise";
import { useLocalStorage } from "@mantine/hooks";
import { useElectronModals } from "../hooks/useElectronModals";
import { Button, Checkbox, Flex, Stack, Text } from "@mantine/core";
import { formatExerciseTitle } from "../utils/format";

type ActivityState = {
  currentLesson: Lesson | null;
  currentExercise: Exercise | null;
  isDoingActivity: boolean;
  startExercise: (exercise: Exercise) => void;
  endExercise: () => void;
  startLesson: (lesson: Lesson) => void;
  endLesson: () => void;
  getActivityText: () => string;
};

const ActivityContext = createContext<ActivityState | null>(null);

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


  return (
    <ActivityContext.Provider value={{ currentLesson, currentExercise, startExercise, endExercise, startLesson, endLesson, getActivityText, isDoingActivity }}>
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
