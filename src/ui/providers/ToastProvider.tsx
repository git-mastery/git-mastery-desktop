import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { IconButton } from "../components/ui/IconButton";
import { Spinner } from "../components/ui/Spinner";
import { cx } from "../utils/cx";
import {
  ToastContext,
  type Toast,
  type ToastOptions,
  type ToastTone,
} from "../contexts/ToastContext";

const ACCENTS: Record<ToastTone, string> = {
  neutral: "border-l-border",
  success: "border-l-brand-600",
  danger: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-info",
};

const DEFAULT_ICONS: Partial<Record<ToastTone, ReactNode>> = {
  success: <IconCheck size={18} className="text-brand-600" />,
  danger: <IconX size={18} className="text-danger" />,
};

const DEFAULT_AUTO_CLOSE = 4000;
const DANGER_AUTO_CLOSE = 8000;

const resolveAutoClose = (toast: Toast) => {
  if (toast.autoClose !== undefined) return toast.autoClose;
  if (toast.loading) return false;
  return toast.tone === "danger" ? DANGER_AUTO_CLOSE : DEFAULT_AUTO_CLOSE;
};

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  // The list lives in a ref rather than in state because callers routinely show
  // a toast and update it again within the same tick (the download stream does
  // exactly that), which a state read would not yet see.
  const store = useRef<Toast[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const publish = useCallback(() => setToasts([...store.current]), []);

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const hideToast = useCallback(
    (id: string) => {
      clearTimer(id);
      store.current = store.current.filter((toast) => toast.id !== id);
      publish();
    },
    [clearTimer, publish],
  );

  /** Restarts the dismissal countdown — an update refreshes the toast's life. */
  const scheduleDismiss = useCallback(
    (toast: Toast) => {
      clearTimer(toast.id);
      const autoClose = resolveAutoClose(toast);
      if (autoClose === false) return;
      timers.current.set(
        toast.id,
        setTimeout(() => hideToast(toast.id), autoClose),
      );
    },
    [clearTimer, hideToast],
  );

  const showToast = useCallback(
    ({ id, ...rest }: ToastOptions) => {
      const toastId = id ?? `toast-${(nextToastId += 1)}`;
      const toast: Toast = { id: toastId, ...rest };
      const index = store.current.findIndex((item) => item.id === toastId);
      if (index === -1) {
        store.current = [...store.current, toast];
      } else {
        store.current = store.current.map((item) =>
          item.id === toastId ? toast : item,
        );
      }
      scheduleDismiss(toast);
      publish();
      return toastId;
    },
    [publish, scheduleDismiss],
  );

  const updateToast = useCallback(
    (id: string, patch: Omit<ToastOptions, "id">) => {
      const current = store.current.find((item) => item.id === id);
      if (!current) return;
      const merged: Toast = { ...current, ...patch };
      store.current = store.current.map((item) =>
        item.id === id ? merged : item,
      );
      scheduleDismiss(merged);
      publish();
    },
    [publish, scheduleDismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, updateToast, hideToast }),
    [showToast, updateToast, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

/**
 * Top-right stack. It deliberately sits below the header and no wider than the
 * terminal aside: anything spilling into the main pane would be painted over by
 * the native web view.
 */
const ToastViewport = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-[76px] right-4 z-[350] flex w-[min(320px,var(--gm-aside-width))] flex-col gap-2">
      {toasts.map((toast) => {
        const icon = toast.icon ?? DEFAULT_ICONS[toast.tone ?? "neutral"];
        return (
          <div
            key={toast.id}
            role="status"
            className={cx(
              "pointer-events-auto flex items-start gap-2 rounded-xl border border-border border-l-4 bg-surface p-3 shadow-card",
              ACCENTS[toast.tone ?? "neutral"],
            )}
          >
            {toast.loading ? (
              <Spinner size={16} className="mt-0.5" />
            ) : (
              icon && <span className="mt-0.5 flex shrink-0">{icon}</span>
            )}
            <div className="min-w-0 flex-1">
              {toast.title && (
                <p className="text-[13px] font-medium text-fg">{toast.title}</p>
              )}
              {toast.message && (
                <p className="text-[13px] break-words whitespace-pre-line text-muted">
                  {toast.message}
                </p>
              )}
            </div>
            {(toast.withCloseButton ?? true) && (
              <IconButton
                aria-label="Dismiss"
                size="sm"
                onClick={() => onDismiss(toast.id)}
              >
                <IconX size={14} />
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  );
};
