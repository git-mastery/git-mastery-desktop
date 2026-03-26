import { useState, useCallback, createContext, useContext, type ReactNode } from "react"
import type { Lesson } from "../../types/Tour"
import type { Exercise } from "../../types/Exercise";

type WebContentsViewState = {
  currentUrl: string | null;
  breadcrumbs: string[];
  setBreadcrumbs: (crumbs: string[]) => void;
  navigate: (url: string) => void;
  hide: () => void;
  show: () => void;
}

const WebContentsViewContext = createContext<WebContentsViewState | null>(null);

export function WebContentsViewProvider({ children }: { children: ReactNode }) {
  const [currentUrl, setCurrentUrl] = useState<string | null>("https://git-mastery.org")
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(false);

  const navigate = useCallback((url: string) => {
    setBreadcrumbs(url.replace("https://git-mastery.org/", "").split("/"))
    setCurrentUrl(url)
    window.electron.navigate(url)

    console.log("navigate called", url)

    show();
  }, [])

  const hide = useCallback(() => {
    setIsVisible(false)
    window.electron.hide()
  }, [])

  const show = useCallback(() => {
    setIsVisible(true)
    window.electron.show()
  }, [])

  return (
    <WebContentsViewContext.Provider value={{ currentUrl, breadcrumbs, setBreadcrumbs, navigate, hide, show }
    }>
      {children}
    </WebContentsViewContext.Provider>
  )
}

/**
 * Hook that tracks the current URL displayed in the Electron WebContentsView
 * and exposes a `navigate(url)` function that updates the state and sends
 * an IPC message to tell the main process to load the new URL.
 */
export function useWebContentsView() {
  const context = useContext(WebContentsViewContext)
  if (!context) {
    throw new Error("useWebContentsView must be used within a WebContentsViewProvider")
  }
  return context;
}

export function buildLessonUrl(lesson: Lesson) {
  return `https://git-mastery.org/${lesson.path}`
}

export function buildExerciseUrl(exercise: Exercise) {

  if (exercise.lesson) {
    console.log(`[webview] navigating to exercise ${exercise.lesson?.path}/${exercise.identifier}`)
    return `https://git-mastery.org/${exercise.lesson?.path}/exercise-${exercise.identifier}`

  }

  if (exercise.detour) {
    console.log(`[webview] navigating to detour ${exercise.detour?.lesson?.path}/${exercise.identifier}`)
    return `https://git-mastery.org/${exercise.detour?.lesson?.path}/exercise-${exercise.identifier}`
  }

  return `https://git-mastery.org`
}