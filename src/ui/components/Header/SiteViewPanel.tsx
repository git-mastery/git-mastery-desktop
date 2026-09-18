import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { LoadingState } from "../ui/States";
import { cx } from "../../utils/cx";
import {
  readDesktopSiteViewPrefs,
  writeDesktopSiteViewPrefs,
} from "../../utils/siteViewPrefs";
import { useTheme } from "../../contexts/ThemeContext";
import {
  useCustardUIConfig,
  type CustardUIConfigFile,
  type ToggleMode,
} from "../../hooks/query/useCustardUIConfig";

type FormState = {
  placeholders: Record<string, string>;
  tabs: Record<string, string>;
  toggles: Record<string, ToggleMode>;
  tabNavsVisible: boolean;
  theme: SitePageTheme;
};

const THEME_MODES: { id: SitePageTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const TOGGLE_MODES: { id: ToggleMode; label: string }[] = [
  { id: "show", label: "Show" },
  { id: "peek", label: "Peek" },
  { id: "hide", label: "Hide" },
];

const FIELD_LABEL =
  "text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted";
const INPUT =
  "h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand-400 focus:ring-2 focus:ring-focus-ring focus:outline-none";

function readerPlaceholders(config: CustardUIConfigFile) {
  return (config.config?.placeholders ?? []).filter(
    (item) => !item.siteManaged,
  );
}

function defaultsFromConfig(config: CustardUIConfigFile): FormState {
  const placeholders: Record<string, string> = {};
  for (const item of readerPlaceholders(config)) {
    placeholders[item.name] = "";
  }

  const tabs: Record<string, string> = {};
  for (const group of config.config?.tabGroups ?? []) {
    tabs[group.groupId] = group.default ?? group.tabs[0]?.tabId ?? "";
  }

  const toggles: Record<string, ToggleMode> = {};
  for (const toggle of config.config?.toggles ?? []) {
    toggles[toggle.toggleId] = toggle.default ?? "hide";
  }

  return { placeholders, tabs, toggles, tabNavsVisible: true, theme: "system" };
}

function toggleModeFromState(
  id: string,
  state: CustardUIState,
  fallback: ToggleMode,
): ToggleMode {
  if (state.shownToggles?.includes(id)) return "show";
  if (state.peekToggles?.includes(id)) return "peek";
  if (state.hiddenToggles?.includes(id)) return "hide";
  return fallback;
}

function mergePrefsIntoForm(
  config: CustardUIConfigFile,
  prefs: SiteViewPrefs,
): FormState {
  const base = defaultsFromConfig(config);
  const { state } = prefs;

  for (const item of readerPlaceholders(config)) {
    const value = state.placeholders?.[item.name];
    if (typeof value === "string") base.placeholders[item.name] = value;
  }
  for (const group of config.config?.tabGroups ?? []) {
    const value = state.tabs?.[group.groupId];
    if (value && group.tabs.some((tab) => tab.tabId === value)) {
      base.tabs[group.groupId] = value;
    }
  }
  for (const toggle of config.config?.toggles ?? []) {
    base.toggles[toggle.toggleId] = toggleModeFromState(
      toggle.toggleId,
      state,
      toggle.default ?? "hide",
    );
  }
  base.tabNavsVisible = prefs.tabNavsVisible;
  base.theme = prefs.theme ?? "system";
  return base;
}

function formToPrefs(form: FormState): SiteViewPrefs {
  const shownToggles: string[] = [];
  const peekToggles: string[] = [];
  const hiddenToggles: string[] = [];
  for (const [id, mode] of Object.entries(form.toggles)) {
    if (mode === "show") shownToggles.push(id);
    else if (mode === "peek") peekToggles.push(id);
    else hiddenToggles.push(id);
  }

  const placeholders: Record<string, string> = {};
  for (const [key, value] of Object.entries(form.placeholders)) {
    if (value.trim()) placeholders[key] = value.trim();
  }

  return {
    state: {
      shownToggles,
      peekToggles,
      hiddenToggles,
      tabs: form.tabs,
      placeholders,
    },
    tabNavsVisible: form.tabNavsVisible,
    theme: form.theme,
  };
}

export const SiteViewPanel = ({ onClose }: { onClose?: () => void }) => {
  const { data: config, isPending, isError, refetch } = useCustardUIConfig();
  const { setPreference } = useTheme();
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const seed = async () => {
      const desktop = readDesktopSiteViewPrefs();
      const site =
        desktop?.theme != null ? null : await window.electron.getSitePrefs();
      const prefs = desktop
        ? { ...desktop, theme: desktop.theme ?? site?.theme }
        : site;
      const next = prefs
        ? mergePrefsIntoForm(config, prefs)
        : defaultsFromConfig(config);
      if (cancelled) return;
      setForm(next);
      setSaved(next);
    };

    void seed();
    return () => {
      cancelled = true;
    };
  }, [config]);

  const dirty = useMemo(() => {
    if (!form || !saved) return false;
    return JSON.stringify(form) !== JSON.stringify(saved);
  }, [form, saved]);

  if (isPending || (config && !form)) {
    return (
      <div className="h-48">
        <LoadingState message="Loading site options…" />
      </div>
    );
  }

  if (isError || !config || !form) {
    return (
      <div className="flex flex-col gap-3 text-sm text-fg">
        <p>
          Could not load the Git-Mastery site options. Check your connection and
          try again.
        </p>
        <div>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const placeholders = readerPlaceholders(config);
  const tabGroups = config.config?.tabGroups ?? [];
  const toggles = config.config?.toggles ?? [];

  const save = async (next: FormState, close = false) => {
    setSaving(true);
    try {
      const prefs = formToPrefs(next);
      writeDesktopSiteViewPrefs(prefs);
      await window.electron.setSitePrefs({ ...prefs, reload: true });
      if (prefs.theme) setPreference(prefs.theme);
      setForm(next);
      setSaved(next);
      if (close) onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[min(70vh,36rem)] flex-col gap-6 overflow-y-auto text-sm text-fg">
      <p>Colour for the desktop app, the lesson pages, and the terminal.</p>

      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Colour</span>
        <div role="radiogroup" aria-label="Colour" className="flex gap-1">
          {THEME_MODES.map((mode) => {
            const active = form.theme === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setForm({ ...form, theme: mode.id })}
                className={cx(
                  "rounded-md px-2.5 py-1 text-[13px] font-medium hover:cursor-pointer",
                  "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {placeholders.length > 0 && (
        <section className="flex flex-col gap-3">
          {placeholders.map((item) => (
            <div key={item.name} className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                {item.settingsLabel ?? item.name}
              </span>
              <input
                type="text"
                value={form.placeholders[item.name] ?? ""}
                placeholder={item.settingsHint}
                onChange={(event) =>
                  setForm({
                    ...form,
                    placeholders: {
                      ...form.placeholders,
                      [item.name]: event.target.value,
                    },
                  })
                }
                className={INPUT}
              />
            </div>
          ))}
        </section>
      )}

      {tabGroups.length > 0 && (
        <section className="flex flex-col gap-3">
          {tabGroups.map((group) => (
            <div key={group.groupId} className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>{group.label}</span>
              <select
                value={form.tabs[group.groupId] ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    tabs: { ...form.tabs, [group.groupId]: event.target.value },
                  })
                }
                className={INPUT}
              >
                {group.tabs.map((tab) => (
                  <option key={tab.tabId} value={tab.tabId}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </section>
      )}

      <Checkbox
        label="Show tab bars on lesson pages"
        checked={form.tabNavsVisible}
        onChange={(event) =>
          setForm({ ...form, tabNavsVisible: event.target.checked })
        }
      />

      {toggles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h4 className="font-heading text-base font-semibold text-fg">
            Sections
          </h4>
          {toggles.map((toggle) => (
            <div
              key={toggle.toggleId}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{toggle.label}</span>
                {toggle.description && (
                  <span className="text-[13px] text-muted">
                    {toggle.description}
                  </span>
                )}
              </div>
              <div
                role="radiogroup"
                aria-label={toggle.label}
                className="flex gap-1"
              >
                {TOGGLE_MODES.map((mode) => {
                  const active = form.toggles[toggle.toggleId] === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        setForm({
                          ...form,
                          toggles: {
                            ...form.toggles,
                            [toggle.toggleId]: mode.id,
                          },
                        })
                      }
                      className={cx(
                        "rounded-md px-2.5 py-1 text-[13px] font-medium hover:cursor-pointer",
                        "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-muted hover:bg-hover hover:text-fg",
                      )}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <div>
        <Button
          variant="primary"
          loading={saving}
          disabled={!dirty}
          onClick={() => void save(form, true)}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
