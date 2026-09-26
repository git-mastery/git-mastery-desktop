import { HANDS_ON_PREFIX } from "../exerciseManifest.js";

export type LessonBrief = {
  /** Null for exercises, whose identifier is already their display name. */
  title: string | null;
  text: string | null;
};

type SessionRecord = AiHintsSession & { instructions: string | null };

/**
 * One entry per exercise a hint panel has been opened for, for the life of the
 * app. The lesson page is the only source of an exercise's instructions and
 * the student is free to navigate away from it mid-conversation, so the last
 * successful scrape is kept as a fallback.
 */
const sessions = new Map<string, SessionRecord>();

export const kindOf = (exerciseId: string): AiHintsKind =>
  exerciseId.startsWith(HANDS_ON_PREFIX) ? "hands-on" : "exercise";

function fallbackTitle(exerciseId: string): string {
  if (kindOf(exerciseId) === "exercise") return exerciseId;
  const words = exerciseId.slice(HANDS_ON_PREFIX.length).split("-");
  const text = words.filter(Boolean).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeSession(exerciseId: string): AiHintsSession {
  const cached = sessions.get(exerciseId);
  return {
    exerciseId,
    kind: kindOf(exerciseId),
    title: cached?.title ?? fallbackTitle(exerciseId),
  };
}

/** Records a fresh scrape, keeping earlier values for anything it lacks. */
export function rememberBrief(
  exerciseId: string,
  brief: LessonBrief | null,
): AiHintsSession {
  const previous = sessions.get(exerciseId);
  const record: SessionRecord = {
    exerciseId,
    kind: kindOf(exerciseId),
    title: brief?.title || previous?.title || fallbackTitle(exerciseId),
    instructions: brief?.text || previous?.instructions || null,
  };
  sessions.set(exerciseId, record);
  return describeSession(exerciseId);
}

export function getCachedInstructions(exerciseId: string): string | null {
  return sessions.get(exerciseId)?.instructions ?? null;
}
