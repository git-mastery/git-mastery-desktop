import { useEffect, useState } from "react";
import { useGitMasteryTask } from "../contexts/GitMasteryTaskContext";

export const useElectronStream = ({ condition, onData, onSuccessExit, onFailedExit }: {
  condition: (cmd: string) => boolean;
  onData: (originalCommand: string, data: GitMasteryTaskData) => void;
  onSuccessExit: (originalCommand: string, data: GitMasteryTaskData) => void;
  onFailedExit: (originalCommand: string, data: GitMasteryTaskData) => void;
}) => {

  const { addListener } = useGitMasteryTask();

  useEffect(() => {

    const _onMessage = (originalCommand: string, data: GitMasteryTaskData) => {
      if (!condition(originalCommand)) return;

      if (data.completed?.status === "success") {
        onSuccessExit(originalCommand, data);
        return;
      }
      if (data.completed?.status === 'failure') {
        onFailedExit(originalCommand, data);
        return;
      }

      if (data.success) {
        // intermediate step was successfull
        onData(originalCommand, data);
        return;
      }
    }
    const unsubscribe = addListener(condition, _onMessage);

    return () => unsubscribe()
  }, [condition, onData, onSuccessExit, onFailedExit]);

  return { condition, onData, onSuccessExit, onFailedExit }

}