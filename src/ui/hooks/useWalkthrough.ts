import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type WalkthroughStep = "lessons" | "terminal";

export const WALKTHROUGH_STEPS: WalkthroughStep[] = ["lessons", "terminal"];

/**
 * The app walkthrough: runs once on first launch, and again whenever Help is
 * clicked. Null `step` means the app behaves as normal.
 */
export function useWalkthrough() {
  const [seen, setSeen] = useLocalStorage({
    key: "gm-walkthrough-seen",
    defaultValue: false,
  });
  const [index, setIndex] = useState<number | null>(() => (seen ? null : 0));
  const step = index === null ? null : WALKTHROUGH_STEPS[index];

  const start = useCallback(() => setIndex(0), []);

  const finish = useCallback(() => {
    setIndex(null);
    setSeen(true);
  }, [setSeen]);

  const next = useCallback(() => {
    if (index === null) return;
    if (index >= WALKTHROUGH_STEPS.length - 1) finish();
    else setIndex(index + 1);
  }, [index, finish]);

  const back = useCallback(() => {
    if (index === null) return;
    setIndex(Math.max(0, index - 1));
  }, [index]);

  // The lesson page is a native view, so it is dimmed from inside the page
  // rather than by a DOM overlay.
  useEffect(() => {
    window.electron.setEmbeddedDimmed(step === "terminal");
  }, [step]);

  return { step, index, start, next, back };
}
