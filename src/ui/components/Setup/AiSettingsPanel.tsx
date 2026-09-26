import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconExternalLink,
} from "@tabler/icons-react";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { LoadingState } from "../ui/States";

type Drafts = Partial<Record<AiProviderId, AiProviderSettings>>;

const EMPTY_DRAFT: AiProviderSettings = { model: "", baseUrl: "", apiKey: "" };

const INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand-400 focus:ring-2 focus:ring-focus-ring focus:outline-none disabled:pointer-events-none disabled:opacity-50";

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11.5px] font-medium tracking-[0.06em] text-muted uppercase">
      {label}
    </span>
    {children}
    {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
  </div>
);

/**
 * Chooses the AI provider behind AI Hints and saves its key. Each provider
 * keeps its own key and model, so switching back and forth loses nothing.
 * Shown from Settings.
 */
export const AiSettingsPanel = ({ onSaved }: { onSaved?: () => void }) => {
  const [view, setView] = useState<AiSettingsView | null>(null);
  const [provider, setProvider] = useState<AiProviderId>("openrouter");
  const [drafts, setDrafts] = useState<Drafts>({});
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.electron
      .getAiSettings()
      .then((result) => {
        if (cancelled) return;
        setView(result);
        setProvider(result.activeProvider);
        const initial: Drafts = {};
        for (const [id, saved] of Object.entries(result.saved)) {
          const { model, baseUrl, apiKey } = saved;
          initial[id as AiProviderId] = { model, baseUrl, apiKey };
        }
        setDrafts(initial);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load AI settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  if (!view) {
    return error ? (
      <p className="text-[13px] text-danger">{error}</p>
    ) : (
      <LoadingState message="Loading…" />
    );
  }

  const info =
    view.providers.find((item) => item.id === provider) ?? view.providers[0];
  const draft = drafts[provider] ?? EMPTY_DRAFT;
  const savedKey = view.saved[provider]?.apiKey ?? "";
  const keyEncrypted = view.saved[provider]?.keyEncrypted ?? false;

  const update = (patch: Partial<AiProviderSettings>) => {
    setDrafts((current) => ({
      ...current,
      [provider]: { ...EMPTY_DRAFT, ...current[provider], ...patch },
    }));
    setError(null);
  };

  const copyKey = async () => {
    if (!draft.apiKey) return;
    try {
      await navigator.clipboard.writeText(draft.apiKey);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the key to the clipboard.");
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await window.electron.saveAiSettings({
        provider,
        ...draft,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const showPlaintextNote = draft.apiKey
    ? savedKey === draft.apiKey
      ? !keyEncrypted
      : !view.encryptionAvailable
    : false;

  return (
    <div className="flex flex-col gap-5 text-sm text-fg">
      <p>
        AI Hints helps when you are stuck on an exercise or hands-on, using an
        AI provider you choose. OpenRouter is free and works out of the box.
      </p>

      <Field label="Provider" hint={info.description}>
        <select
          value={provider}
          disabled={saving}
          onChange={(event) => {
            setProvider(event.target.value as AiProviderId);
            setRevealed(false);
            setError(null);
          }}
          className={INPUT_CLASS}
        >
          {view.providers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.id === "openrouter" ? " (default, free)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {info.baseUrlRequired && (
        <Field
          label="Base URL"
          hint="The URL that ends before /chat/completions."
        >
          <input
            type="url"
            value={draft.baseUrl}
            disabled={saving}
            spellCheck={false}
            placeholder={info.baseUrlPlaceholder ?? ""}
            onChange={(event) => update({ baseUrl: event.target.value })}
            className={`${INPUT_CLASS} font-mono`}
          />
        </Field>
      )}

      <Field
        label={info.keyRequired ? "API key" : "API key (optional)"}
        hint={
          info.keyUrl && (
            <>
              Create a key at{" "}
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-accent hover:cursor-pointer hover:underline"
                onClick={() => window.electron.openExternal(info.keyUrl!)}
              >
                {info.keyUrl.replace(/^https:\/\//, "")}
                <IconExternalLink size={13} />
              </button>
              , then paste it here.
            </>
          )
        }
      >
        <div className="flex items-center gap-1">
          <input
            type={revealed ? "text" : "password"}
            value={draft.apiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={info.keyPlaceholder}
            disabled={saving}
            onChange={(event) => update({ apiKey: event.target.value })}
            className={`${INPUT_CLASS} flex-1 font-mono`}
          />
          <IconButton
            aria-label={revealed ? "Hide API key" : "Show API key"}
            size="sm"
            disabled={saving}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </IconButton>
          <IconButton
            aria-label={copied ? "Copied" : "Copy API key"}
            size="sm"
            disabled={!draft.apiKey || saving}
            onClick={copyKey}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </IconButton>
        </div>
      </Field>

      <Field
        label={info.defaultModel ? "Model (optional)" : "Model"}
        hint={
          info.defaultModel ? (
            <>
              Leave empty to use{" "}
              <code className="font-mono text-[12px]">{info.defaultModel}</code>
              .
            </>
          ) : (
            "The model name your endpoint expects, for example llama3.1."
          )
        }
      >
        <input
          type="text"
          value={draft.model}
          disabled={saving}
          spellCheck={false}
          placeholder={info.defaultModel ?? ""}
          onChange={(event) => update({ model: event.target.value })}
          className={`${INPUT_CLASS} font-mono`}
        />
      </Field>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      {showPlaintextNote && (
        <p className="text-[13px] text-muted">
          This computer cannot encrypt the key at rest, so it will be stored in
          plain text in the app config.
        </p>
      )}

      <p className="text-[13px] text-muted">
        When you ask for a hint, the app sends your provider the instructions
        from the lesson page, the names of the files in that exercise&apos;s
        folder, and its Git state: branches, commit messages, tags, and which
        files are staged or changed. It never sends file contents, and never
        looks outside the exercise folder. Open &ldquo;AI can see&rdquo; in the
        hints panel to check exactly what was sent.
      </p>

      <div className="flex gap-2">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
};
