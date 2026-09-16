import { useCallback, useRef } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useElectronStream } from "../../hooks/useElectronStream";
import { useToast } from "../../contexts/ToastContext";
import { useLocalExercises } from "../../hooks/query/useLocalExercises";

const isDownloadCommand = (cmd: string) => cmd.startsWith("download");

/**
 * Globally mounted listener for exercise download streams. Keeps progress
 * notifications and history refresh working wherever a download starts from.
 * Entering the exercise directory is handled by the main process, which reports
 * it separately on `start-exercise-result`.
 */
export const DownloadExerciseListener = () => {
  const { downloadedExerciseData, patchExerciseStatus } = useLocalExercises();
  const { showToast, updateToast } = useToast();
  // Presence of a command means its notification is already on screen; the
  // value is the tail of its output shown in that notification.
  const progressRef = useRef<Map<string, string[]>>(new Map());

  const onExerciseDownloadProgress = useCallback(
    (originalCommand: string, data: GitMasteryTaskData) => {
      let lines = progressRef.current.get(originalCommand);
      if (!lines) {
        lines = [];
        progressRef.current.set(originalCommand, lines);
        showToast({
          id: originalCommand,
          title: "Downloading",
          message: "Downloading...",
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });
      }

      lines.push(data.success!.message);
      if (lines.length > 4) {
        lines.shift();
      }

      updateToast(originalCommand, { message: lines.join("\n") });
    },
    [showToast, updateToast],
  );

  const onExerciseDownloadComplete = useCallback(
    (originalCommand: string, data: GitMasteryTaskData) => {
      const exerciseIdentifier = data.exerciseIdentifier;
      if (exerciseIdentifier && !downloadedExerciseData?.[exerciseIdentifier]) {
        patchExerciseStatus(exerciseIdentifier, "downloaded");
      }

      updateToast(originalCommand, {
        title: "Download complete",
        message: "",
        loading: false,
        tone: "success",
        icon: <IconCheck size={18} className="text-brand-600" />,
        autoClose: 5000,
        withCloseButton: true,
      });

      progressRef.current.delete(originalCommand);
    },
    [downloadedExerciseData, patchExerciseStatus, updateToast],
  );

  const onExerciseDownloadFailure = useCallback(
    (originalCommand: string, data: GitMasteryTaskData) => {
      console.log("[info] download completed but with errors.");

      updateToast(originalCommand, {
        title: "Download failed",
        message:
          data.completed?.message ?? data.error?.message ?? "Download failed",
        loading: false,
        tone: "danger",
        icon: <IconX size={18} className="text-danger" />,
        autoClose: 5000,
        withCloseButton: true,
      });

      progressRef.current.delete(originalCommand);
    },
    [updateToast],
  );

  useElectronStream({
    condition: isDownloadCommand,
    onData: onExerciseDownloadProgress,
    onSuccessExit: onExerciseDownloadComplete,
    onFailedExit: onExerciseDownloadFailure,
  });

  return null;
};
