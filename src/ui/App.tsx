import TerminalComponent from "./components/Terminal/Terminal";
import { WebsiteWrapper } from "./components/Website/WebsiteWrapper";
import { Header } from "./components/Header/Header";
import { LessonsPanelToggle, ToursPanel } from "./components/Header/ToursMenu";
import { useEffect, useRef, useState } from "react";
import { ResizeHandle } from "./components/ResizeHandle";
import { DownloadExerciseListener } from "./components/Exercise/DownloadExerciseListener";
import { AiHintsPanel } from "./components/AiHints/AiHintsPanel";
import {
  getSiteSection,
  useWebContentsView,
} from "./contexts/WebContentsViewContext";
import { useAiHintsSession } from "./hooks/useAiHintsSession";
import { useWalkthrough } from "./hooks/useWalkthrough";
import {
  WalkthroughCard,
  WalkthroughDim,
} from "./components/Walkthrough/Walkthrough";
import { cx } from "./utils/cx";

const MIN_MAIN = 320;
const MIN_ASIDE = 280;
const MIN_HINTS_HEIGHT = 240;
const MIN_TERMINAL_HEIGHT = 160;
const ASIDE_WIDTH_VAR = "--gm-aside-width";
const HINTS_HEIGHT_VAR = "--gm-hints-height";

function App() {
  const { setEmbeddedVisible, currentUrl } = useWebContentsView();
  const [asideWidth, setAsideWidth] = useState(512);
  // Null until the learner drags the divider; until then the CSS default
  // keeps the split proportional to the window height.
  const [hintsHeight, setHintsHeight] = useState<number | null>(null);
  const [lessonsPanelOpened, setLessonsPanelOpened] = useState(true);
  const asideRef = useRef<HTMLElement>(null);

  const hints = useAiHintsSession();
  const showHints = hints.session !== null && hints.open;

  const walkthrough = useWalkthrough();
  const focusLessons = walkthrough.step === "lessons";
  const focusTerminal = walkthrough.step === "terminal";

  const onLessons = getSiteSection(currentUrl) === "lessons";
  const showLessonsPanel = onLessons && lessonsPanelOpened;

  // The embedded lesson site is the only thing the main pane ever shows, so it
  // stays visible for the life of the app. Overlays that need the DOM on top
  // claim a suppression instead, via `useEmbeddedSuppressed`.
  useEffect(() => {
    setEmbeddedVisible(true);
  }, [setEmbeddedVisible]);

  // Pane sizes live in custom properties so a drag can resize them — and with
  // them the native view's bounds — without a React render.
  useEffect(() => {
    document.documentElement.style.setProperty(
      ASIDE_WIDTH_VAR,
      `${asideWidth}px`,
    );
  }, [asideWidth]);

  useEffect(() => {
    if (hintsHeight === null) return;
    document.documentElement.style.setProperty(
      HINTS_HEIGHT_VAR,
      `${hintsHeight}px`,
    );
  }, [hintsHeight]);

  return (
    <>
      <DownloadExerciseListener />
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="relative z-[200] h-16 shrink-0 overflow-visible border-b border-border bg-surface px-4">
          <Header onHelp={walkthrough.start} />
          <WalkthroughDim show={walkthrough.step !== null} />
        </header>

        <div className="flex min-h-0 min-w-0 flex-1">
          {showLessonsPanel && (
            <nav className="relative w-[300px] min-w-0 shrink-0 border-r border-border bg-surface">
              <ToursPanel onClose={() => setLessonsPanelOpened(false)} />
              <WalkthroughDim show={focusTerminal} />
            </nav>
          )}

          <main className="relative flex min-h-0 min-w-[320px] flex-1 flex-col">
            {onLessons && !lessonsPanelOpened && (
              <div className="flex h-9 shrink-0 items-center border-b border-border bg-surface px-2">
                <LessonsPanelToggle
                  opened={false}
                  onToggle={() => setLessonsPanelOpened(true)}
                />
              </div>
            )}
            <WebsiteWrapper />
            <WalkthroughDim show={focusTerminal} />
          </main>

          {/* The work column: AI hints stacked over the terminal, so a hint
              sits next to where it gets acted on and the lesson page keeps
              its width. */}
          <aside
            ref={asideRef}
            className="relative flex min-w-[280px] flex-col border-l border-border w-[var(--gm-aside-width)]"
          >
            {/* Kept mounted while hidden so closing does not lose the
                conversation; only a new exercise or Clear history clears it. */}
            {hints.session && (
              <div
                className={cx(
                  "relative flex min-h-[240px] shrink basis-[var(--gm-hints-height)] flex-col border-b border-border",
                  !showHints && "hidden",
                )}
              >
                <AiHintsPanel session={hints.session} onClose={hints.close} />
                <WalkthroughDim show={focusTerminal} />
                <ResizeHandle
                  axis="y"
                  size={hintsHeight ?? MIN_HINTS_HEIGHT}
                  min={MIN_HINTS_HEIGHT}
                  max={() =>
                    (asideRef.current?.clientHeight ?? window.innerHeight) -
                    MIN_TERMINAL_HEIGHT
                  }
                  cssVars={[HINTS_HEIGHT_VAR]}
                  onChange={setHintsHeight}
                />
              </div>
            )}
            <div className="relative min-h-[160px] flex-1">
              <TerminalComponent />
              {focusTerminal && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-[10] ring-2 ring-brand-600 ring-inset"
                />
              )}
            </div>
            <ResizeHandle
              size={asideWidth}
              min={MIN_ASIDE}
              max={() => window.innerWidth - MIN_MAIN}
              cssVars={[ASIDE_WIDTH_VAR]}
              invert
              onChange={setAsideWidth}
            />
            <WalkthroughDim show={focusLessons} />
            {walkthrough.step !== null && walkthrough.index !== null && (
              <WalkthroughCard
                step={walkthrough.step}
                index={walkthrough.index}
                onNext={walkthrough.next}
                onBack={walkthrough.back}
              />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

export default App;
