import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconExternalLink,
} from "@tabler/icons-react";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";

const OPENROUTER_KEYS_URL = "https://openrouter.ai/keys";

type KeyStatus = "idle" | "checking" | "verified" | "error" | "missing";

/**
 * Paste, reveal, copy, and save an OpenRouter API key. Shown from Settings.
 */
export const AiKeyPanel = ({
  onConfiguredChange,
}: {
  onConfiguredChange?: (configured: boolean) => void;
}) => {
  const [key, setKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<KeyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [storedEncrypted, setStoredEncrypted] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.electron
      .getOpenRouterKey()
      .then((result) => {
        if (cancelled) return;
        setEncryptionAvailable(result.encryptionAvailable);
        setStoredEncrypted(result.storedEncrypted);
        setHasStoredKey(Boolean(result.key));
        if (result.key) {
          setKey(result.key);
          setStatus("verified");
        } else {
          setStatus("missing");
        }
        onConfiguredChange?.(Boolean(result.key));
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("missing");
        onConfiguredChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onConfiguredChange]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copyKey = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the key to the clipboard.");
    }
  };

  const save = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Paste an OpenRouter API key first.");
      setStatus("error");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus("checking");
    try {
      const check = await window.electron.validateOpenRouterKey(trimmed);
      if (!check.ok) {
        setStatus("error");
        setError(check.error ?? "That key could not be verified.");
        return;
      }
      const saved = await window.electron.setOpenRouterKey(trimmed);
      setStoredEncrypted(saved.encrypted);
      setHasStoredKey(saved.ok);
      setStatus("verified");
      onConfiguredChange?.(saved.ok);
    } catch {
      setStatus("error");
      setError("Could not save the key. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.electron.clearOpenRouterKey();
      setKey("");
      setHasStoredKey(false);
      setStoredEncrypted(false);
      setStatus("missing");
      onConfiguredChange?.(false);
    } catch {
      setError("Could not remove the key. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const showPlaintextNote = hasStoredKey
    ? !storedEncrypted
    : !encryptionAvailable;

  return (
    <div className="flex flex-col gap-4 text-sm text-[#333]">
      <div className="flex flex-col gap-2">
        <p>
          AI hints use a free OpenRouter key that you create and paste here.
        </p>
        <p>
          Create a key at{" "}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline hover:cursor-pointer"
            onClick={() => window.electron.openExternal(OPENROUTER_KEYS_URL)}
          >
            openrouter.ai/keys
            <IconExternalLink size={14} />
          </button>
          , then paste it below. Hints stay unavailable until a key is saved.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-medium tracking-[0.06em] text-neutral-500 uppercase">
          OpenRouter API key
        </span>
        <div className="flex items-center gap-1">
          <input
            type={revealed ? "text" : "password"}
            value={key}
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-or-v1-…"
            onChange={(event) => {
              setKey(event.target.value);
              if (status === "verified" || status === "error") {
                setStatus("idle");
                setError(null);
              }
            }}
            className="h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 font-mono text-sm text-[#333] placeholder:text-neutral-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <IconButton
            aria-label={revealed ? "Hide API key" : "Show API key"}
            size="sm"
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </IconButton>
          <IconButton
            aria-label={copied ? "Copied" : "Copy API key"}
            size="sm"
            disabled={!key}
            onClick={copyKey}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "missing" && (
          <span className="inline-flex items-center rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            Not configured
          </span>
        )}
        {status === "verified" && (
          <span className="inline-flex items-center rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            Key verified
          </span>
        )}
        {status === "checking" && (
          <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Checking key…
          </span>
        )}
        {error && <span className="text-[13px] text-[#b42318]">{error}</span>}
      </div>

      {showPlaintextNote && (
        <p className="text-[13px] text-neutral-500">
          This computer cannot encrypt the key at rest, so it will be stored in
          plain text in the app config.
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} loading={saving} disabled={!key.trim()}>
          Save key
        </Button>
        {hasStoredKey && (
          <Button variant="outline" onClick={remove} disabled={saving}>
            Remove key
          </Button>
        )}
      </div>
    </div>
  );
};
