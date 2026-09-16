import TerminalComponent from "./components/Terminal/Terminal";
import { WebsiteWrapper } from "./components/Website/WebsiteWrapper";
import { Header } from "./components/Header/Header";
import { LessonsPanelToggle, ToursPanel } from "./components/Header/ToursMenu";
import { useEffect, useState } from "react";
import { Onboarding } from "./pages/Onboarding";
import { ResizeHandle } from "./components/ResizeHandle";
import { DownloadExerciseListener } from "./components/Exercise/DownloadExerciseListener";
import {
  getSiteSection,
  useWebContentsView,
} from "./contexts/WebContentsViewContext";
import { useLocalStorage } from "./hooks/useLocalStorage";

const MIN_MAIN = 320;
const MIN_ASIDE = 280;
const ASIDE_WIDTH_VAR = "--gm-aside-width";

function App() {
  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage({
    key: "onboarding-completed",
    defaultValue: false,
  });
  const { setEmbeddedVisible, currentUrl } = useWebContentsView();
  const [asideWidth, setAsideWidth] = useState(512);
  const [lessonsPanelOpened, setLessonsPanelOpened] = useState(false);

  const onLessons = getSiteSection(currentUrl) === "lessons";
  const showLessonsPanel = onLessons && lessonsPanelOpened;

  // The embedded lesson site is the only thing the main pane ever shows, so it
  // stays visible for the life of the app. Overlays that need the DOM on top
  // claim a suppression instead, via `useEmbeddedSuppressed`.
  useEffect(() => {
    setEmbeddedVisible(true);
  }, [setEmbeddedVisible]);

  // The aside reads its width from a custom property so a drag can resize the
  // pane — and with it the native view's bounds — without a React render.
  useEffect(() => {
    document.documentElement.style.setProperty(
      ASIDE_WIDTH_VAR,
      `${asideWidth}px`,
    );
  }, [asideWidth]);

  if (!onboardingCompleted)
    return (
      <Onboarding onCompleteOnboarding={() => setOnboardingCompleted(true)} />
    );

  return (
    <>
      <DownloadExerciseListener />
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="relative z-[200] h-16 shrink-0 overflow-visible border-b border-border bg-surface px-4">
          <Header />
        </header>

        <div className="flex min-h-0 min-w-0 flex-1">
          {showLessonsPanel && (
            <nav className="w-[300px] min-w-0 shrink-0 border-r border-border bg-surface">
              <ToursPanel onClose={() => setLessonsPanelOpened(false)} />
            </nav>
          )}

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {onLessons && !lessonsPanelOpened && (
              <div className="flex h-9 shrink-0 items-center border-b border-border bg-surface px-2">
                <LessonsPanelToggle
                  opened={false}
                  onToggle={() => setLessonsPanelOpened(true)}
                />
              </div>
            )}
            <WebsiteWrapper />
          </main>

          <aside className="relative min-w-0 shrink-0 border-l border-border w-[var(--gm-aside-width)]">
            <TerminalComponent />
            <ResizeHandle
              width={asideWidth}
              min={MIN_ASIDE}
              max={() => window.innerWidth - MIN_MAIN}
              cssVars={[ASIDE_WIDTH_VAR]}
              invert
              onChange={setAsideWidth}
            />
          </aside>
        </div>
      </div>
    </>
  );
}

export default App;
