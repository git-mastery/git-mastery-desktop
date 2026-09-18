import { useCallback } from "react";
import { useElectronStream } from "../../hooks/useElectronStream";
import { useLocalExercises } from "../../hooks/query/useLocalExercises";

const isDownloadCommand = (cmd: string) => cmd.startsWith("download");

/**
 * Globally mounted listener for exercise download streams. Keeps history
 * refresh working wherever a download starts from. Progress lives in the
 * terminal; the start-exercise toast owns loading and failure.
 */
export const DownloadExerciseListener = () => {
  const { downloadedExerciseData, patchExerciseStatus } = useLocalExercises();

  const onExerciseDownloadComplete = useCallback(
    (_originalCommand: string, data: GitMasteryTaskData) => {
      const exerciseIdentifier = data.exerciseIdentifier;
      if (exerciseIdentifier && !downloadedExerciseData?.[exerciseIdentifier]) {
        patchExerciseStatus(exerciseIdentifier, "downloaded");
      }
    },
    [downloadedExerciseData, patchExerciseStatus],
  );

  useElectronStream({
    condition: isDownloadCommand,
    onData: () => {},
    onSuccessExit: onExerciseDownloadComplete,
    onFailedExit: () => {},
  });

  return null;
};
