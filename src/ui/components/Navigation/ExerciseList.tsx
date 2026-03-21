import { ActionIcon, Autocomplete, Button, Flex, Modal, Select, Stack, Text } from "@mantine/core"
import { IconCheck, IconPlus } from "@tabler/icons-react"
import { useWebContentsView } from "../../context/useWebContentsView"
import { useDisclosure } from "@mantine/hooks";
import { useExercises } from "../../hooks/useExercises";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGitMasteryTask } from "../../contexts/GitMasteryTaskContext";
import { showNotification, updateNotification } from "@mantine/notifications";

// temporary map to store data
const activeNotifications: Record<string, any> = {}

export const ExerciseList = () => {
  const { hide, show } = useWebContentsView();

  const [opened, { open, close }] = useDisclosure(false);

  const { query: exercisesQuery } = useExercises();

  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(null)

  const { addListener } = useGitMasteryTask();
  const { data: downloadedExercises, refetch: rescanDownloadedExercises } = useQuery({
    queryKey: ['downloaded-exercises'],
    queryFn: () => window.electron.getDownloadedExercises(),

  })

  const onAddSelected = () => {
    hide()
    open()


  }
  const onSelectExercise = (key: string | null) => {
    setSelectedExerciseKey(key)

    console.log({ key })
    // communicate with the electron backend, starting the task

  }
  const onFinishAdding = () => {
    close()
    show()

    window.electron.startGitMasteryTask(`download ${selectedExerciseKey}`)


    setSelectedExerciseKey(null)

  }


  useEffect(() => {
    const condition = (cmd: string) => cmd.startsWith("download");

    const historyLines: string[] = [] // max 4
    const callback = (originalCommand: string, data: GitMasteryTaskData) => {
      console.log(`[callback - download] ${originalCommand}: ${data}`)

      if (!activeNotifications[originalCommand]) {
        activeNotifications[originalCommand] = showNotification({
          id: originalCommand,
          title: "Downloading",
          message: "Downloading...",
          loading: true,
          autoClose: false,
          withCloseButton: false,
        })
      }

      if (data.success) {
        // partial success
        const message = data.success.message;

        historyLines.push(message);
        if (historyLines.length > 4) {
          historyLines.shift();
        }

        updateNotification({
          id: originalCommand,
          message: historyLines.join("\n"),
        })
      }

      if (data.completed?.status === "success") {
        // reached the last thing, refetch query
        console.log("[info] download completed, refetching downloaded exercises")
        rescanDownloadedExercises()

        updateNotification({
          id: originalCommand,
          title: "Download complete",
          message: historyLines.join("\n"),
          loading: false,
          color: "green",
          icon: <IconCheck size={18} />,
        })
      }
    }
    const unsubscribe = addListener(condition, callback);
    return unsubscribe;
  }, [])


  return <>
    <Stack w="100%">
      <Flex justify={'space-between'} align={'center'} w="100%">

        <Text variant="subheading" style={{ flexGrow: 1 }}> LESSONS </Text>
        <ActionIcon size="xs">
          <IconPlus onClick={onAddSelected} />
        </ActionIcon>
      </Flex>

      <Stack>
        {downloadedExercises?.map(exercise => (
          <DownloadedExercise key={exercise} exercise={exercise} />
        ))}
      </Stack>


    </Stack>
    <Modal opened={opened} onClose={onFinishAdding} title="Add Exercises" centered>

      <Select
        label="Select an exercise to download"
        placeholder="Pick value"

        // TODO: confirm with prof on the correct naming scheme
        data={Object.keys(exercisesQuery.data || {}).map(key => key.replace(/_/g, "-"))}
        onChange={onSelectExercise}
        searchable
      />

      <Flex justify={"end"} mt="md">

        <Button disabled={!selectedExerciseKey} onClick={onFinishAdding}> Download </Button>
      </Flex>
    </Modal>
  </>
}

export const DownloadedExercise = ({ exercise }: { exercise: string }) => {
  return <Flex>
    <Text>{exercise}</Text>
  </Flex>
}