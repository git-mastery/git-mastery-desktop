import { fallbackWorkspaceTitle, workspaceSource } from "./source.js";

export type LessonBrief = {
  /** Null for exercises, whose identifier is already their display name. */
  title: string | null;
  text: string | null;
};

type SessionRecord = {
  source: AiSource;
  instructions: string | null;
};

/**
 * One entry per workspace source a hint panel has been opened for, for the
 * life of the app. The lesson page is the only source of an exercise's
 * instructions and the student is free to navigate away from it
 * mid-conversation, so the last successful scrape is kept as a fallback.
 *
 * Renderer conversations live in a separate source-keyed store; this cache is
 * only titles and instruction text for the model.
 */
const sessions = new Map<string, SessionRecord>();

/** Records a fresh scrape, keeping earlier values for anything it lacks. */
export function rememberBrief(
  exerciseId: string,
  brief: LessonBrief | null,
): AiSource {
  const source = workspaceSource(exerciseId);
  const previous = sessions.get(source.sourceKey);
  const record: SessionRecord = {
    source: workspaceSource(
      exerciseId,
      brief?.title ||
        previous?.source.title ||
        fallbackWorkspaceTitle(exerciseId),
    ),
    instructions: brief?.text || previous?.instructions || null,
  };
  sessions.set(source.sourceKey, record);
  return record.source;
}

export function getCachedInstructions(exerciseId: string): string | null {
  return (
    sessions.get(workspaceSource(exerciseId).sourceKey)?.instructions ?? null
  );
}
