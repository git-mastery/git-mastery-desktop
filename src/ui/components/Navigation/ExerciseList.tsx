import { ActionIcon, Autocomplete, Box, Button, Flex, Modal, Select, Stack, Text } from "@mantine/core"
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react"
import { buildExerciseUrl, buildLessonUrl, useWebContentsView } from "../../context/useWebContentsView"
import { useExercises } from "../../hooks/query/useExercises";
import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { showNotification, updateNotification } from "@mantine/notifications";
import { NavigationButton } from "./NavigationButton/NavigationButton";
import type { Exercise } from "../../../types/Exercise";
import { useActivity } from "../../context/useActivity";
import { useElectronModals } from "../../hooks/useElectronModals";
import { useElectronStream } from "../../hooks/useElectronStream";
import { useLocalExercises } from "../../hooks/query/useLocalExercises";

// temporary map to store data
const activeNotifications: Record<string, any> = {}

export const ExerciseList = () => {

  const { openConfirmModal, close, closeAll } = useElectronModals();
  const [isCurrentlyAdding, setIsCurrentlyAdding] = useState(false);

  const { query: exercisesQuery } = useExercises();
  const { startExercise } = useActivity();

  const { navigate } = useWebContentsView();
  const selectedExerciseRef = useRef<Exercise | null>(null);

  const { downloadedExerciseData, rescanDownloadedExercises } = useLocalExercises();

  const downloadedExercises = useMemo(() => {
    // TODO:
    // the problem is that the keys in https://git-mastery.org/exercises-directory/exercises.json are snake_case.
    // but the folder names are saved in kebab-case.
    // We can either:
    // 1. convert folder names to snake_case OR
    // 2. use the `identifier` field in the exercise data.
    // const sensibleServerExercisesData = Object.entries(exercisesQuery.data || {}).map(([key, value]) => {
    //   return value;
    // })

    return Object.keys(downloadedExerciseData || {}).map(
      (exerciseKey) => {
        const exercise = Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === exerciseKey)
        if (!exercise) {
          return null
        }
        return {
          exercise: exercise,

          // TODO: fragile
          status: downloadedExerciseData![exerciseKey].status
        }
      }
    ).filter(Boolean) as { exercise: Exercise, status: ProgressState }[]

    // return downloadedExerciseData?.map(
    //   (data) => ({
    //     exercise: Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === data.exerciseKey),
    //     status: data.status
    //   })
    // ).filter(data => !!data.exercise)

    // return downloadedExerciseData?.map(exerciseData =>
    // ({
    //   ...Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === exerciseData.exerciseKey),
    //   status: exerciseData.status
    // })).filter(Boolean) as {

    //   }[] || []
  }, [downloadedExerciseData, exercisesQuery.data])

  const onAddSelectedClicked = () => {
    // hide()
    // open()

    const modalId = openConfirmModal({
      title: "Download Exercise",
      children: (
        <Select
          label="Select an exercise to download"
          placeholder="Pick value"

          // TODO: confirm with prof on the correct naming scheme
          data={Object.values(exercisesQuery.data || {}).map(exercise => exercise.identifier)}
          onChange={onSelectExercise}
          searchable
        />
      ),
      labels: {
        confirm: "Download",
        cancel: "Cancel",
      },
      onCancel: () => close(modalId),
      onConfirm: () => onStartAdding(),

    })


  }
  const onSelectExercise = (exerciseIdentifier: string | null) => {
    // setSelectedExercise(exercise)
    if (!exerciseIdentifier) {
      return
    }

    console.log(`selected exercise ${exerciseIdentifier}`)
    const exercise = Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === exerciseIdentifier) || null
    console.log({ data: exercisesQuery.data, exercise: exercise })
    selectedExerciseRef.current = exercise

  }


  /**
   * This function is only meant to kick-off the process of downloading.
   * It should not do too much else: The reason is that other places
   * e.g. the backend can also start the process of downloading.
   * 
   * Download status is streamed back to the FE, so minimal logic should be
   * placed here, to ensure that the visual experience is the same whether FE or BE
   * 
   */
  const onStartAdding = () => {

    // use a ref to prevent stale data from closures
    const currentActiveExercise = selectedExerciseRef.current;
    if (!currentActiveExercise) return;
    console.log("------ downloading ------");
    console.log({ currentActiveExercise });

    window.electron.startGitMasteryTask(`download ${currentActiveExercise?.identifier}`)
    closeAll();
    navigate(buildExerciseUrl(currentActiveExercise));


  }

  // don't need to be reactive
  const historyLines: string[] = [] // max 4
  const onExerciseDownloadProgress = (originalCommand: string, data: GitMasteryTaskData) => {
    setIsCurrentlyAdding(true);
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

    const message = data.success!.message;
    const exerciseIdentifier = data.exerciseIdentifier;
    if (exerciseIdentifier && !selectedExerciseRef.current) {
      const exercise = Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === exerciseIdentifier) || null
      selectedExerciseRef.current = exercise
    }


    historyLines.push(message);
    if (historyLines.length > 4) {
      historyLines.shift();
    }

    updateNotification({
      id: originalCommand,
      message: historyLines.join("\n"),
    })

  }

  const onExerciseDownloadComplete = (originalCommand: string, data: GitMasteryTaskData) => {
    console.log("[info] download completed, refetching downloaded exercises")
    rescanDownloadedExercises()

    updateNotification({
      id: originalCommand,
      title: "Download complete",
      message: "",
      loading: false,
      color: "green",
      icon: <IconCheck size={18} />,
      autoClose: 5000,
      withCloseButton: true,
    })

    // close modal
    // TODO: be more specific in which modal we're closing
    closeAll();

    // redirect to the exercise
    const selectedExercise = selectedExerciseRef.current;

    if (selectedExercise) {
      startExercise(selectedExercise)
    }

    selectedExerciseRef.current = null;
    setIsCurrentlyAdding(false);

    activeNotifications[originalCommand] = null
  }

  const onExerciseDownloadFailure = (originalCommand: string, data: GitMasteryTaskData) => {
    console.log("[info] download completed but with errors.")

    updateNotification({
      id: originalCommand,
      title: "Download failed",
      message: data.error!.message,
      loading: false,
      color: "red",
      icon: <IconX size={18} />,
      autoClose: 5000,
      withCloseButton: true,
    })

    closeAll();
    selectedExerciseRef.current = null;
    setIsCurrentlyAdding(false);

    activeNotifications[originalCommand] = null

  }

  const { } = useElectronStream({
    condition: (cmd: string) => cmd.startsWith("download"),
    onData: onExerciseDownloadProgress,
    onSuccessExit: onExerciseDownloadComplete,
    onFailedExit: onExerciseDownloadFailure,
  })




  return <>
    <Stack w="100%">
      <Flex justify={'space-between'} align={'center'} w="100%">

        <Text variant="subheading" style={{ flexGrow: 1 }}> Lessons </Text>
        <ActionIcon size="xs">
          <IconPlus onClick={onAddSelectedClicked} />
        </ActionIcon>
      </Flex>

      <Stack>
        {downloadedExercises?.map(exerciseData => (
          <DownloadedExercise key={exerciseData?.exercise.identifier} exercise={exerciseData.exercise} status={exerciseData.status} />
        ))}


      </Stack>


    </Stack>
    {/* <Modal opened={opened} onClose={onModalClose} title="Add Exercises" centered>

      <Select
        label="Select an exercise to download"
        placeholder="Pick value"

        // TODO: confirm with prof on the correct naming scheme
        data={Object.values(exercisesQuery.data || {}).map(exercise => exercise.identifier)}
        onChange={onSelectExercise}
        searchable
      />

      <Flex justify={"end"} mt="md">

        <Button disabled={!selectedExercise} onClick={onStartAdding}> Download </Button>
      </Flex>
    </Modal> */}
  </>
}

export const DownloadedExercise = ({ exercise, status }: { exercise: Exercise, status: ProgressState }) => {
  const { navigate } = useWebContentsView();
  const { startExercise } = useActivity();

  return <Flex style={{ width: "100%", alignItems: 'center' }}>
    {statusMap[status as keyof typeof statusMap]()}
    <NavigationButton title={exercise.identifier} onClick={() => {
      navigate(buildExerciseUrl(exercise));
      startExercise(exercise);

    }} />
  </Flex >
}



const InProgress = () => {
  return <Box style={{
    backgroundColor: "var(--mantine-color-yellow-5)",
    borderRadius: "var(--mantine-radius-default)",
    // padding: "var(--mantine-spacing-md)",
    width: "12px",
    height: '12px'
  }}>

  </Box>
}

const Correct = () => {
  return <Box style={{
    backgroundColor: "var(--mantine-color-green-5)",
    borderRadius: "var(--mantine-radius-default)",
    // padding: "var(--mantine-spacing-md)",
    width: "12px",
    height: '12px'
  }}>

  </Box>
}

const Incorrect = () => {
  return <Box style={{
    backgroundColor: "var(--mantine-color-red-5)",
    borderRadius: "var(--mantine-radius-default)",
    // padding: "var(--mantine-spacing-md)",
    width: "12px",
    height: '12px'
  }}>

  </Box>
}

const statusMap = {
  "correct": Correct,
  "incorrect": Incorrect,
  "in-progress": InProgress,
  "not-started": InProgress,
}