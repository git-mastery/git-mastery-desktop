import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toStoredHistory, toUiMessages } from "../ai/history";
import { useToast } from "../contexts/ToastContext";

const SAVE_FAIL_TOAST = "ai-history-save-failed";

type ChatSession = AiSession & {
  pendingPrompt?: { id: string; text: string };
};

type ChatState = {
  paneOpen: boolean;
  activeSourceKey: string | null;
  sessionsBySource: Record<string, ChatSession>;
};

function newConversationId() {
  return crypto.randomUUID();
}

function emptySession(source: AiSource): ChatSession {
  return {
    source,
    conversationId: newConversationId(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function fromStored(sessions: Record<string, StoredAiSession>) {
  const next: Record<string, ChatSession> = {};
  for (const [key, session] of Object.entries(sessions)) {
    next[key] = {
      source: session.source,
      conversationId: session.conversationId,
      updatedAt: session.updatedAt,
      messages: toUiMessages(session.messages),
    };
  }
  return next;
}

function mergeSessions(
  loaded: Record<string, ChatSession>,
  current: Record<string, ChatSession>,
) {
  const next = { ...loaded };
  for (const [key, session] of Object.entries(current)) {
    const disk = loaded[key];
    if (!disk || session.messages.length > 0) {
      next[key] = session;
      continue;
    }
    next[key] = {
      ...disk,
      source: {
        ...disk.source,
        title: session.source.title || disk.source.title,
      },
      pendingPrompt: session.pendingPrompt ?? disk.pendingPrompt,
    };
  }
  return next;
}

/**
 * In-memory store of AI conversations, keyed by source, hydrated from
 * ai-history.json. The pane shows at most one of them.
 */
export function useAiHintsSession() {
  const { showToast } = useToast();
  const [state, setState] = useState<ChatState>({
    paneOpen: false,
    activeSourceKey: null,
    sessionsBySource: {},
  });
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  const hydratedRef = useRef(hydrated);

  const saveHistory = useCallback(
    (sessions: Record<string, ChatSession>) => {
      const stored = toStoredHistory(sessions);
      const fail = () =>
        showToast({
          id: SAVE_FAIL_TOAST,
          tone: "warning",
          title: "Couldn't save chat history on this computer.",
        });
      void window.electron.saveAiHistory(stored).then((ok) => {
        if (!ok) fail();
      }, fail);
      return stored;
    },
    [showToast],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    hydratedRef.current = hydrated;
  }, [hydrated]);

  useEffect(() => {
    let cancelled = false;
    void window.electron
      .loadAiHistory()
      .then((history) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          sessionsBySource: mergeSessions(
            fromStored(history.sessions),
            current.sessionsBySource,
          ),
        }));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const stored = toStoredHistory(stateRef.current.sessionsBySource);
    if (Object.keys(stored).length === 0) return;
    saveHistory(stateRef.current.sessionsBySource);
  }, [hydrated, saveHistory]);

  useEffect(
    () =>
      window.electron.onAiHintsOpen((payload) => {
        setState((current) => {
          const { source, pendingPrompt } = payload;
          const existing = current.sessionsBySource[source.sourceKey];
          const session: ChatSession = existing
            ? {
                ...existing,
                source: {
                  ...existing.source,
                  title: source.title || existing.source.title,
                },
                updatedAt: new Date().toISOString(),
                pendingPrompt: pendingPrompt ?? existing.pendingPrompt,
              }
            : {
                ...emptySession(source),
                pendingPrompt,
              };
          return {
            paneOpen: true,
            activeSourceKey: source.sourceKey,
            sessionsBySource: {
              ...current.sessionsBySource,
              [source.sourceKey]: session,
            },
          };
        });
      }),
    [],
  );

  const close = useCallback(() => {
    setState((current) => ({ ...current, paneOpen: false }));
  }, []);

  const clearHistory = useCallback(() => {
    const current = stateRef.current;
    const key = current.activeSourceKey;
    if (!key) return;
    const session = current.sessionsBySource[key];
    if (!session) return;
    const remaining = { ...current.sessionsBySource };
    delete remaining[key];
    setState((latest) => {
      const active = latest.sessionsBySource[key];
      if (!active) return latest;
      const next = { ...latest.sessionsBySource };
      delete next[key];
      return {
        ...latest,
        sessionsBySource: {
          ...next,
          [key]: emptySession(active.source),
        },
      };
    });
    if (hydratedRef.current) {
      saveHistory(remaining);
    }
  }, [saveHistory]);

  const syncMessages = useCallback(
    (
      sourceKey: string,
      conversationId: string,
      messages: GitMasteryUIMessage[],
    ) => {
      setState((current) => {
        const session = current.sessionsBySource[sourceKey];
        if (!session || session.conversationId !== conversationId)
          return current;
        return {
          ...current,
          sessionsBySource: {
            ...current.sessionsBySource,
            [sourceKey]: {
              ...session,
              messages,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    [],
  );

  const persistHistory = useCallback(
    (
      sourceKey: string,
      conversationId: string,
      messages: GitMasteryUIMessage[],
    ) => {
      if (!hydratedRef.current) return;
      const sessions = { ...stateRef.current.sessionsBySource };
      const session = sessions[sourceKey];
      if (session && session.conversationId === conversationId) {
        sessions[sourceKey] = {
          ...session,
          messages,
          updatedAt: new Date().toISOString(),
        };
      }
      const stored = saveHistory(sessions);
      const trimmed = stored[sourceKey];
      if (!session || session.conversationId !== conversationId || !trimmed) {
        return;
      }
      setState((current) => {
        const live = current.sessionsBySource[sourceKey];
        if (!live || live.conversationId !== conversationId) return current;
        return {
          ...current,
          sessionsBySource: {
            ...current.sessionsBySource,
            [sourceKey]: {
              ...live,
              messages: toUiMessages(trimmed.messages),
              updatedAt: trimmed.updatedAt,
            },
          },
        };
      });
    },
    [saveHistory],
  );

  const clearDraft = useCallback((sourceKey: string) => {
    setState((current) => {
      const session = current.sessionsBySource[sourceKey];
      if (!session?.pendingPrompt) return current;
      return {
        ...current,
        sessionsBySource: {
          ...current.sessionsBySource,
          [sourceKey]: {
            ...session,
            pendingPrompt: undefined,
          },
        },
      };
    });
  }, []);

  const session = useMemo(() => {
    if (!state.activeSourceKey) return null;
    return state.sessionsBySource[state.activeSourceKey] ?? null;
  }, [state.activeSourceKey, state.sessionsBySource]);

  return {
    session,
    open: state.paneOpen,
    close,
    clearHistory,
    syncMessages,
    persistHistory,
    clearDraft,
  };
}
