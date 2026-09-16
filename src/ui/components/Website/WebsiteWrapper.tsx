import { useEffect, useRef, useState } from "react";
import {
  LESSONS_HOME_URL,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { LoadingState } from "../ui/States";
import { readDesktopSiteViewPrefs } from "../../utils/siteViewPrefs";

export const WebsiteWrapper = () => {
  const webViewRef = useRef<HTMLDivElement>(null);
  const hasNavigatedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const { navigate } = useWebContentsView();

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    const prefs = readDesktopSiteViewPrefs();
    const go = () => navigate(LESSONS_HOME_URL);
    if (!prefs) {
      go();
      return;
    }
    void window.electron.setSitePrefs({ ...prefs, reload: false }).finally(go);
  }, [navigate]);

  useEffect(() => {
    return window.electron.onWcvLoading(setIsLoading);
  }, []);

  useEffect(() => {
    if (!webViewRef.current) return;

    /**
     * Converts the placeholder element's CSS-pixel bounds to physical pixels
     * and forwards them to the main process so the WebContentsView is
     * positioned correctly.
     *
     * Must be called both on resize AND whenever devicePixelRatio changes
     * (e.g. when the window is dragged to a monitor with different scaling).
     */
    function sendBounds() {
      if (!webViewRef.current) return;
      const { x, y, width, height } =
        webViewRef.current.getBoundingClientRect();

      const dpr = window.devicePixelRatio;
      const physX = Math.round(x * dpr);
      const physY = Math.round(y * dpr);
      const physW = Math.round(width * dpr);
      const physH = Math.round(height * dpr);

      window.electron.setContentsViewSize(physX, physY, physW, physH);
    }

    let boundsRaf = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (boundsRaf) return;
      boundsRaf = requestAnimationFrame(() => {
        boundsRaf = 0;
        sendBounds();
      });
    });
    resizeObserver.observe(webViewRef.current);

    // Re-send bounds when the window moves to a monitor with a different
    // pixel density. matchMedia fires a 'change' event when the media query
    // result flips, so we register a new listener every time the DPR changes
    // (the standard recursive pattern for cross-monitor DPR tracking).
    let dprCleanup: (() => void) | null = null;

    function watchDpr() {
      dprCleanup?.();
      const mql = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      const onChange = () => {
        sendBounds();
        watchDpr(); // re-register for the *next* DPR change
      };
      mql.addEventListener("change", onChange);
      dprCleanup = () => mql.removeEventListener("change", onChange);
    }

    watchDpr();

    return () => {
      cancelAnimationFrame(boundsRaf);
      resizeObserver.disconnect();
      dprCleanup?.();
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full grow flex-col">
      {/* Stays empty apart from the loading state — the native view is painted
          over these bounds, so anything else here would be invisible. */}
      <div
        ref={webViewRef}
        id="webcontentsview-placeholder"
        className="flex h-full w-full grow items-center justify-center"
      >
        {isLoading && <LoadingState message="Loading..." />}
      </div>
    </div>
  );
};
