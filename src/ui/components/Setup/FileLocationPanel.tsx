import { useEffect, useRef, useState } from "react";
import { IconFolder } from "@tabler/icons-react";
import { Button } from "../ui/Button";

/**
 * Lets the user pick the folder that exercise files are written to. Shown on
 * first run and from Settings. Changing the location is deferred: once the
 * exercise folder exists, the picker is locked and the path is read-only.
 */
export const FileLocationPanel = ({
  onChange,
}: {
  onChange?: (path: string | null) => void;
}) => {
  const [folder, setFolder] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    window.electron
      .checkExerciseFolder()
      .then((status) => {
        setFolder(status.dataDirectory);
        setLocked(status.ready);
        onChange?.(status.dataDirectory);
      })
      .catch(() => setFolder(null));
  }, [onChange]);

  const pickFolder = async () => {
    setIsPicking(true);
    try {
      const path = await window.electron.selectFolder();
      if (!path) return;
      window.electron.setDataDirectory(path);
      setFolder(path);
      onChange?.(path);
      const status = await window.electron.checkExerciseFolder();
      setLocked(status.ready);
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm text-fg">
      <div className="flex flex-col gap-2">
        <p>
          Practising Git means working with real files on your computer.
          GitMastery creates a folder for each exercise, with the starting files
          already set up for you.
        </p>
        {locked ? (
          <p>
            The exercise folder has already been created here, so this location
            cannot be changed.
          </p>
        ) : (
          <p>
            Pick a folder to keep them in — somewhere you can find easily, like
            your Documents or Desktop. Once the exercise folder is created, this
            location cannot be changed.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <IconFolder size={18} className="shrink-0 text-muted" />
        {folder ? (
          <code className="rounded-md bg-subtle px-2 py-1 font-mono text-[13px] break-all text-fg">
            {folder}
          </code>
        ) : (
          <span className="text-[13px] text-muted">No folder chosen yet</span>
        )}
      </div>

      {!locked && (
        <div className="flex">
          <Button
            variant={folder ? "secondary" : "primary"}
            onClick={pickFolder}
            loading={isPicking}
          >
            {folder ? "Change folder" : "Choose folder"}
          </Button>
        </div>
      )}
    </div>
  );
};
