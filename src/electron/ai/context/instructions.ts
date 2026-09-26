import type { ContextProvider } from "../context.js";
import { getCachedInstructions, rememberBrief } from "../session.js";
import { scrapeLessonBrief } from "../../ipc/webContentsView.js";

export const instructionsProvider: ContextProvider = {
  id: "instructions",
  label: "Instructions",
  async collect({ exerciseId }) {
    const live = await scrapeLessonBrief(exerciseId);
    if (live?.text) {
      rememberBrief(exerciseId, live);
      return live.text;
    }
    return getCachedInstructions(exerciseId);
  },
};
