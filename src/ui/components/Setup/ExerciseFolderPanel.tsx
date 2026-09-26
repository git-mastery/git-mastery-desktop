import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconFolder, IconX } from "@tabler/icons-react";
import {
  GIT_PREP_SETUP_URL,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { DOWNLOADED_EXERCISES_QUERY_KEY } from "../../hooks/query/useLocalExercises";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";

/**
 * Points the app at the exercises folder the learner already created with
 * `gitmastery setup`. Shown from Settings and from the first-Start flow.
 */
export const ExerciseFolderPanel = ({
  onSaved,
  onOpenGuide,
}: {
  onSaved?: () => void;
  /** Closes the panel so the lesson page underneath can be seen. */
  onOpenGuide: () => void;
}) => {
  const { navigate } = useWebContentsView();
  const queryClient = useQueryClient();
  const [root, setRoot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    window.electron
      .getExerciseRoot()
      .then(({ root: saved }) => setRoot(saved))
      .catch(() => setRoot(null));
  }, []);

  const pickFolder = async () => {
    setIsPicking(true);
    setError(null);
    try {
      const directory = await window.electron.selectFolder();
      if (!directory) return;
      const result = await window.electron.setExerciseRoot(directory);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRoot(result.root);
      onSaved?.();
    } finally {
      setIsPicking(false);
    }
  };

  const unlinkFolder = async () => {
    await window.electron.clearExerciseRoot();
    setRoot(null);
    setError(null);
    queryClient.setQueryData(DOWNLOADED_EXERCISES_QUERY_KEY, {});
  };

  const openGuide = () => {
    navigate(GIT_PREP_SETUP_URL);
    onOpenGuide();
  };

  return (
    <div className="flex flex-col gap-4 text-sm text-fg">
      <p>
        Select the folder you ran{" "}
        <code className="font-mono text-[13px]">gitmastery setup</code> in. This
        step does not set up Git-Mastery on your behalf. Follow the{" "}
        <button
          type="button"
          onClick={openGuide}
          className="text-accent underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          Setup Instructions
        </button>{" "}
        to set up Git-Mastery first.
      </p>
      <p className="text-[13px] text-muted">
        Don&apos;t use a folder synced by OneDrive, Dropbox, Google Drive or
        iCloud.
      </p>

      <div className="flex items-center gap-2">
        <IconFolder size={18} className="shrink-0 text-muted" />
        {root ? (
          <>
            <code className="min-w-0 rounded-md bg-subtle px-2 py-1 font-mono text-[13px] break-all text-fg">
              {root}
            </code>
            <IconButton
              aria-label="Unlink folder"
              size="sm"
              onClick={() => void unlinkFolder()}
            >
              <IconX size={14} />
            </IconButton>
          </>
        ) : (
          <span className="text-[13px] text-muted">No folder chosen yet</span>
        )}
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex">
        <Button onClick={() => void pickFolder()} loading={isPicking}>
          {root ? "Change folder" : "Choose folder"}
        </Button>
      </div>
    </div>
  );
};
