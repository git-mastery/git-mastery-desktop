import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";

export type GitMasteryTaskListener = {
  condition: (command: string) => boolean;
  callback: (command: string, data: GitMasteryTaskData) => void;
};

export type GitMasteryTaskState = {
  /** Full message history keyed by command name */
  data: { [originalCommand: string]: GitMasteryTaskData };
  /** Most recent message text (success or error) */
  latestMessage: string;
  /** HTTP-style code: 200 on success, error code otherwise */
  latestCode: number;
  /** Register a callback for incoming task data. Returns an unsubscribe function. */
  addListener: (condition: (command: string) => boolean, callback: (command: string, data: GitMasteryTaskData) => void) => () => void;
};

const GitMasteryTaskContext = createContext<GitMasteryTaskState | null>(null);

/**
 * Mount this provider once near the root of the tree.
 * It registers a single IPC listener for `onGitMasteryTaskData` and
 * distributes the results to any number of consumers via context.
 */
export function GitMasteryTaskProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ [originalCommand: string]: GitMasteryTaskData }>({});
  const [latestMessage, setLatestMessage] = useState("");
  const [latestCode, setLatestCode] = useState(200);

  const listenersRef = useRef<Set<GitMasteryTaskListener>>(new Set());

  const addListener = useCallback((condition: (command: string) => boolean, callback: (command: string, data: GitMasteryTaskData) => void) => {
    const listener = { condition, callback };
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.onGitMasteryTaskData((originalCommand, taskData) => {
      
      // Notify listeners matching the condition
      listenersRef.current.forEach((listener) => {
        if (listener.condition(originalCommand)) {
          listener.callback(originalCommand, taskData);
        }
      });

      setData((prev) => ({ ...prev, [originalCommand]: taskData }));

      if (taskData.success?.message) {
        setLatestMessage(taskData.success.message);
        setLatestCode(200);
      } else if (taskData.error?.message) {
        setLatestMessage(taskData.error.message);
        setLatestCode(taskData.error.code);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <GitMasteryTaskContext.Provider value={{ data, latestMessage, latestCode, addListener }}>
      {children}
    </GitMasteryTaskContext.Provider>
  );
}

/**
 * Consume GitMastery task state from any component inside the provider.
 *
 * @example
 *   const { latestMessage, latestCode } = useGitMasteryTask();
 */
export function useGitMasteryTask(): GitMasteryTaskState {
  const ctx = useContext(GitMasteryTaskContext);
  if (!ctx) {
    throw new Error("useGitMasteryTask must be used inside <GitMasteryTaskProvider>");
  }
  return ctx;
}
