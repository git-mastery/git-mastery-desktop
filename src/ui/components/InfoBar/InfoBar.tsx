import { Box } from "@mantine/core";
import { useGitMasteryTask } from "../../contexts/GitMasteryTaskContext";

export const InfoBar = () => {
  const { latestMessage } = useGitMasteryTask();

  return <Box>{latestMessage}</Box>;
}