import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconRefresh,
} from "@tabler/icons-react";
import { useElectronStream } from "../../hooks/useElectronStream";
import { IconButton } from "../ui/IconButton";
import { Spinner } from "../ui/Spinner";
import { Tooltip } from "../ui/Tooltip";

type CheckResult = { ok: boolean; detail: string };

type SetupItem = {
  key: string;
  label: string;
  /** Shown until the check has something more specific to report. */
  description: string;
  check: () => Promise<CheckResult>;
  /** Fixes the item from inside the app. */
  install?: { label: string; run: () => Promise<unknown> };
};

type RowState = {
  status: "checking" | "ok" | "missing";
  detail?: string;
  busy?: boolean;
};

const isSetupCommand = (cmd: string) => cmd.startsWith("setup");
const noop = () => {};

/**
 * The prerequisites GitMastery needs, as a checklist that reports its own
 * progress inline. Deliberately notification-free: each row owns its spinner,
 * result and retry, so it can be shown during first run or from settings.
 */
export const SetupChecklist = ({
  onReadyChange,
}: {
  /** Called whenever every item is, or stops being, satisfied. */
  onReadyChange?: (ready: boolean) => void;
}) => {
  const [rows, setRows] = useState<Record<string, RowState>>({});

  // `gitmastery setup` reports completion over the task stream rather than from
  // its invoke call, so the row waits on this resolver before re-checking.
  const setupDoneRef = useRef<(() => void) | null>(null);

  const settleSetup = useCallback(() => {
    const resolve = setupDoneRef.current;
    setupDoneRef.current = null;
    resolve?.();
  }, []);

  useElectronStream({
    condition: isSetupCommand,
    onData: noop,
    onSuccessExit: settleSetup,
    onFailedExit: settleSetup,
  });

  const createExerciseFolder = useCallback(
    () =>
      new Promise<void>((resolve) => {
        setupDoneRef.current = resolve;
        window.electron.startGitMasteryTask("setup").catch(() => {
          setupDoneRef.current = null;
          resolve();
        });
      }),
    [],
  );

  const items = useMemo<SetupItem[]>(
    () => [
      {
        key: "gitmastery-cli",
        label: "Git-Mastery CLI",
        description: "Downloads exercises and runs verify.",
        check: async () => {
          const {
            version,
            latest,
            path: binaryPath,
          } = await window.electron.getGitMasteryVersion();
          if (!version) {
            return {
              ok: false,
              detail: "Not found. If you just installed it, restart the app.",
            };
          }
          const location = binaryPath ? ` — ${binaryPath}` : "";
          return {
            ok: true,
            detail:
              latest && latest !== version
                ? `Version ${version} installed, ${latest} available${location}`
                : `Version ${version}${location}`,
          };
        },
        install: {
          label: "Download Git-Mastery CLI",
          run: () => window.electron.downloadGitMasteryApp(),
        },
      },
      {
        key: "exercise-folder",
        label: "Exercise folder",
        description: "Where your exercise files are created.",
        check: async () => {
          const status = await window.electron.checkExerciseFolder();
          if (!status.dataDirectory) {
            return { ok: false, detail: "Choose a save location first" };
          }
          return {
            ok: status.ready,
            detail: status.ready
              ? status.exercisesPath!
              : "Not created yet in your save location",
          };
        },
        install: { label: "Create folder", run: createExerciseFolder },
      },
    ],
    [createExerciseFolder],
  );

  const patchRow = useCallback((key: string, patch: Partial<RowState>) => {
    setRows((prev) => {
      const current: RowState = prev[key] ?? { status: "checking" };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  }, []);

  const runCheck = useCallback(
    async (item: SetupItem) => {
      patchRow(item.key, { status: "checking" });
      try {
        const { ok, detail } = await item.check();
        patchRow(item.key, { status: ok ? "ok" : "missing", detail });
      } catch (error) {
        patchRow(item.key, {
          status: "missing",
          detail: error instanceof Error ? error.message : "Check failed",
        });
      }
    },
    [patchRow],
  );

  const checkAll = useCallback(() => {
    items.forEach((item) => void runCheck(item));
  }, [items, runCheck]);

  useEffect(() => {
    checkAll();
  }, [checkAll]);

  const allReady = items.every((item) => rows[item.key]?.status === "ok");
  useEffect(() => {
    onReadyChange?.(allReady);
  }, [allReady, onReadyChange]);

  const runInstall = async (item: SetupItem) => {
    if (!item.install) return;
    patchRow(item.key, { busy: true });
    try {
      await item.install.run();
      await runCheck(item);
    } finally {
      patchRow(item.key, { busy: false });
    }
  };

  return (
    <div className="flex flex-col gap-2 text-sm text-fg">
      <p>Install the required tools to run Git-Mastery.</p>

      <div className="mt-2 flex flex-col">
        {items.map((item, index) => {
          const state = rows[item.key];
          const status = state?.status ?? "checking";

          return (
            <div
              key={item.key}
              className={
                index > 0
                  ? "flex items-center justify-between gap-3 border-t border-border py-3"
                  : "flex items-center justify-between gap-3 py-3"
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusIcon status={status} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-[13px] break-all text-muted">
                    {state?.detail ?? item.description}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {item.install && status !== "ok" && (
                  <Tooltip label={item.install.label}>
                    <IconButton
                      variant="soft"
                      size="sm"
                      aria-label={item.install.label}
                      loading={state?.busy}
                      disabled={status === "checking"}
                      onClick={() => void runInstall(item)}
                    >
                      <IconDownload size={16} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip label="Check again">
                  <IconButton
                    size="sm"
                    aria-label={`Check ${item.label} again`}
                    disabled={status === "checking" || state?.busy}
                    onClick={() => void runCheck(item)}
                  >
                    <IconRefresh size={16} />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: RowState["status"] }) => {
  if (status === "checking") return <Spinner size={20} />;
  if (status === "ok")
    return (
      <IconCircleCheck
        size={20}
        className="shrink-0 text-brand-600"
        aria-label="Installed"
      />
    );
  return (
    <IconCircleX
      size={20}
      className="shrink-0 text-danger"
      aria-label="Not found"
    />
  );
};
