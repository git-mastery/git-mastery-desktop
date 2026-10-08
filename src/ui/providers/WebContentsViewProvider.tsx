import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { WebContentsViewContext } from "../contexts/WebContentsViewContext";
import { writeLastEmbeddedUrl } from "../utils/lastEmbeddedUrl";

export function WebContentsViewProvider({ children }: { children: ReactNode }) {
  const currentUrlRef = useRef<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  // The WebContentsView is a native child view that always paints above the
  // React DOM, so anything rendered in the DOM (modals, full page React views)
  // is only visible while the native view is collapsed. Visibility is derived
  // from these two values alone: every caller either declares whether the
  // embedded site belongs on screen, or claims a suppression while it needs
  // the DOM on top.
  const [embeddedVisible, setEmbeddedVisible] = useState(false);
  const [suppressionCount, setSuppressionCount] = useState(0);
  const visible = embeddedVisible && suppressionCount === 0;

  useEffect(() => {
    if (visible) {
      window.electron.show();
    } else {
      window.electron.hide();
    }
  }, [visible]);

  // Every overlay that needs to be seen — modal, onboarding, settings panel —
  // claims one of these for as long as it is mounted, via `useEmbeddedSuppressed`.
  const suppressEmbedded = useCallback(() => {
    setSuppressionCount((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setSuppressionCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const rememberUrl = useCallback((url: string) => {
    currentUrlRef.current = url;
    setCurrentUrl(url);
    writeLastEmbeddedUrl(url);
  }, []);

  const navigate = useCallback(
    (url: string) => {
      if (currentUrlRef.current === url) return;
      rememberUrl(url);
      window.electron.navigate(url);
    },
    [rememberUrl],
  );

  useEffect(() => {
    return window.electron.onWcvUrlChanged(rememberUrl);
  }, [rememberUrl]);

  return (
    <WebContentsViewContext.Provider
      value={{
        currentUrl,
        navigate,
        setEmbeddedVisible,
        suppressEmbedded,
      }}
    >
      {children}
    </WebContentsViewContext.Provider>
  );
}
