// The current "Activity" state of the application — an activity is an active
// `Exercise`. The behaviour lives in `ActivityProvider`; this module holds only
// the shape and the consumer hook.

import { createContext, useContext } from "react";
import type { Exercise } from "../../types/Exercise";

export type ActivityFocusNotice =
  | {
      kind: "start";
      exerciseIdentifier: string;
      activityName: string;
      activityKind: "exercise" | "hands-on";
      status: "downloading" | "ready" | "failed";
      message?: string;
      open: boolean;
    }
  | {
      kind: "verify";
      exerciseIdentifier: string;
      activityName: string;
      result: "correct" | "incorrect" | "complete" | "failed";
      message?: string;
      open: boolean;
    };

export type ActivityState = {
  startExercise: (exercise: Exercise) => void;
  focusNotice: ActivityFocusNotice | null;
  dismissFocusNotice: () => void;
};

export const ActivityContext = createContext<ActivityState | null>(null);

/**
 * Hook that tracks the current activity (exercise)
 */
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return context;
}
