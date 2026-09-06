import type { ContextProvider } from "../context.js";
import { buildCurriculumText } from "../curriculum.js";

export const curriculumProvider: ContextProvider = {
  id: "curriculum",
  label: "Course position",
  async collect({ exerciseId }) {
    // Synchronous by construction: the exercise->lesson map is fetched once at
    // startup and read here, never awaited, so a slow or failed fetch costs the
    // student this block rather than delaying their message.
    return buildCurriculumText(exerciseId);
  },
};
