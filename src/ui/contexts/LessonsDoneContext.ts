import { createContext, useContext } from "react";

export type LessonsDoneState = {
  doneLessonNames: string[];
  isLessonDone: (lessonName: string) => boolean;
  setLessonDone: (lessonName: string, done: boolean) => void;
  areAllLessonsDone: (lessonNames: string[]) => boolean;
  setLessonsDone: (lessonNames: string[], done: boolean) => void;
};

export const LessonsDoneContext = createContext<LessonsDoneState | null>(null);

export function useLessonsDone() {
  const context = useContext(LessonsDoneContext);
  if (!context) {
    throw new Error("useLessonsDone must be used within a LessonsDoneProvider");
  }
  return context;
}
