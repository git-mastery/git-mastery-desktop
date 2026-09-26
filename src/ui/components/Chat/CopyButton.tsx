import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { IconButton } from "../ui/IconButton";

/** Ghost copy action with a short confirmed state, no toast. */
export const CopyButton = ({
  text,
  label = "Copy message",
}: {
  text: string;
  label?: string;
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <IconButton
      aria-label={copied ? "Copied" : label}
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? (
        <IconCheck size={14} className="text-brand-600" />
      ) : (
        <IconCopy size={14} />
      )}
    </IconButton>
  );
};
