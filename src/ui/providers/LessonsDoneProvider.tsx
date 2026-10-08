import { useCallback, type ReactNode } from "react";
import { LessonsDoneContext } from "../contexts/LessonsDoneContext";
import { useLocalStorage } from "../hooks/useLocalStorage";

const KEY = "gm-lessons-done";

function normalizeNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      ),
    ),
  ];
}

export function LessonsDoneProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<string[]>({
    key: KEY,
    defaultValue: [],
  });
  const doneLessonNames = normalizeNames(stored);

  const isLessonDone = useCallback(
    (lessonName: string) => doneLessonNames.includes(lessonName),
    [doneLessonNames],
  );

  const setLessonDone = useCallback(
    (lessonName: string, done: boolean) => {
      const next = new Set(doneLessonNames);
      if (done) next.add(lessonName);
      else next.delete(lessonName);
      setStored([...next]);
    },
    [doneLessonNames, setStored],
  );

  const areAllLessonsDone = useCallback(
    (lessonNames: string[]) =>
      lessonNames.length > 0 &&
      lessonNames.every((name) => doneLessonNames.includes(name)),
    [doneLessonNames],
  );

  const setLessonsDone = useCallback(
    (lessonNames: string[], done: boolean) => {
      const next = new Set(doneLessonNames);
      for (const name of lessonNames) {
        if (done) next.add(name);
        else next.delete(name);
      }
      setStored([...next]);
    },
    [doneLessonNames, setStored],
  );

  return (
    <LessonsDoneContext.Provider
      value={{
        doneLessonNames,
        isLessonDone,
        setLessonDone,
        areAllLessonsDone,
        setLessonsDone,
      }}
    >
      {children}
    </LessonsDoneContext.Provider>
  );
}
