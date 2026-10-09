import { useCallback, useEffect, useMemo, useState } from "react";

type ChatSession = AiSession & {
  pendingPrompt?: { id: string; text: string };
  consumedPromptIds: string[];
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
    consumedPromptIds: [],
  };
}

/**
 * In-memory store of AI conversations, keyed by source. The pane shows at most
 * one of them. Closing hides the pane without dropping history; switching
 * sources selects another entry. Persistence to disk is a later phase.
 */
export function useAiHintsSession() {
  const [state, setState] = useState<ChatState>({
    paneOpen: false,
    activeSourceKey: null,
    sessionsBySource: {},
  });

  useEffect(
    () =>
      window.electron.onAiHintsOpen((payload) => {
        setState((current) => {
          const { source, pendingPrompt } = payload;
          const existing = current.sessionsBySource[source.sourceKey];
          const alreadyQueued =
            pendingPrompt &&
            (existing?.pendingPrompt?.id === pendingPrompt.id ||
              existing?.consumedPromptIds.includes(pendingPrompt.id));
          const session: ChatSession = existing
            ? {
                ...existing,
                source: {
                  ...existing.source,
                  title: source.title || existing.source.title,
                },
                updatedAt: new Date().toISOString(),
                pendingPrompt: alreadyQueued
                  ? existing.pendingPrompt
                  : (pendingPrompt ?? existing.pendingPrompt),
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
    setState((current) => {
      const key = current.activeSourceKey;
      if (!key) return current;
      const session = current.sessionsBySource[key];
      if (!session) return current;
      return {
        ...current,
        sessionsBySource: {
          ...current.sessionsBySource,
          [key]: {
            ...session,
            conversationId: newConversationId(),
            updatedAt: new Date().toISOString(),
            messages: [],
            pendingPrompt: undefined,
            consumedPromptIds: [],
          },
        },
      };
    });
  }, []);

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

  const consumePendingPrompt = useCallback(
    (sourceKey: string, promptId: string) => {
      setState((current) => {
        const session = current.sessionsBySource[sourceKey];
        if (!session || session.pendingPrompt?.id !== promptId) return current;
        return {
          ...current,
          sessionsBySource: {
            ...current.sessionsBySource,
            [sourceKey]: {
              ...session,
              pendingPrompt: undefined,
              consumedPromptIds: [...session.consumedPromptIds, promptId],
            },
          },
        };
      });
    },
    [],
  );

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
    consumePendingPrompt,
  };
}
