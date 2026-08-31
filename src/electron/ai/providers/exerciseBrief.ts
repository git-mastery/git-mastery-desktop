import type { ContextProvider } from "../context.js";
import { getExerciseText } from "../../ipc/webContentsView.js";

export const exerciseBriefProvider: ContextProvider = {
  id: "exercise-brief",
  label: "Exercise brief",
  async collect({ exerciseId }) {
    return getExerciseText(exerciseId);
  },
};
