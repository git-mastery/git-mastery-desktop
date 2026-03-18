import { Box } from "@mantine/core";
import { useEffect, useState } from "react";

// The InfoBar component should subscribe to onGitMasteryTaskData and should display the latest state of it.
export const InfoBar = () => {

  // TODO: check if this will cause a memory leak
  const [data, setData] = useState<{
    [originalCommand: string]: GitMasteryTaskData
  }>({})

  const [latestMessage, setLatestMessage] = useState("");
  const [latestCode, setLatestCode] = useState(200);
  useEffect(() => {
    const unsubscribe = window.electron.onGitMasteryTaskData((originalCommand, data) => {
      setData((prev) => ({ ...prev, [originalCommand]: data }));

      if (data.success?.message) {
        setLatestMessage(data.success.message);
        setLatestCode(200);
      } else if (data.error?.message) {
        setLatestMessage(data.error.message);
        setLatestCode(data.error.code);
      }
    });
    return unsubscribe;
  }, []);

  return <Box>
    {latestMessage}
  </Box>
}