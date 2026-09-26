import { useCallback, useEffect, useState } from "react";

/**
 * Which exercise the AI Hints pane is for, and whether it is showing. Main
 * announces a session when an AI Hints button on the lesson page is clicked;
 * closing only hides the pane, so reopening the same exercise picks the
 * conversation up where it was.
 */
export function useAiHintsSession() {
  const [session, setSession] = useState<AiHintsSession | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      window.electron.onAiHintsOpen((next) => {
        setSession(next);
        setOpen(true);
      }),
    [],
  );

  const close = useCallback(() => setOpen(false), []);

  return { session, open, close };
}
