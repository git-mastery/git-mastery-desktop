import { useEffect, useState } from "react";
import { useGitMasteryTask } from "../contexts/GitMasteryTaskContext";

export const useElectronStream = ({ condition, onData, onComplete }: {
  condition: (cmd: string) => boolean;
  onData: (originalCommand: string, data: GitMasteryTaskData) => void;
  onComplete: (originalCommand: string, data: GitMasteryTaskData) => void;
}) => {

  const { addListener } = useGitMasteryTask();

  useEffect(() => {

    const _onMessage = (originalCommand: string, data: GitMasteryTaskData) => {
      if (!condition(originalCommand)) return;

      if (data.completed?.status === "success") {
        handleComplete(originalCommand, data);
        return;
      }

      if (data.success) {
        // intermediate step was successfull
        handleData(originalCommand, data);
        return;
      }


    }

    const handleData = (originalCommand: string, data: GitMasteryTaskData) => {
      if (condition(originalCommand) && data.success) {
        onData(originalCommand, data);
      }
    };

    const handleComplete = (originalCommand: string, data: GitMasteryTaskData) => {
      if (condition(originalCommand)) {
        onComplete(originalCommand, data);
      }
    };

    const unsubscribe = addListener(condition, _onMessage);

    return () => unsubscribe()
    // window.electron.onGitMasteryTaskComplete(handleComplete);


  }, [condition, onData, onComplete]);

  return { condition, onData, onComplete }

}