import { ActionIcon, Autocomplete, Button, Flex, Modal, Select, Stack, Text } from "@mantine/core"
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react"
import { buildExerciseUrl, buildLessonUrl, useWebContentsView } from "../../context/useWebContentsView"
import { useDisclosure } from "@mantine/hooks";
import { useExercises } from "../../hooks/useExercises";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGitMasteryTask } from "../../contexts/GitMasteryTaskContext";
import { showNotification, updateNotification } from "@mantine/notifications";
import { NavigationButton } from "./NavigationButton/NavigationButton";
import type { Exercise } from "../../../types/Exercise";
import { useActivity } from "../../context/useActivity";
import { useElectronModals } from "../../hooks/useElectronModals";
import { useElectronStream } from "../../hooks/useElectronStream";

// temporary map to store data
const activeNotifications: Record<string, any> = {}

export const ExerciseList = () => {

  const { openConfirmModal, close, closeAll } = useElectronModals();
  const [isCurrentlyAdding, setIsCurrentlyAdding] = useState(false);

  const { query: exercisesQuery } = useExercises();
  const { startExercise } = useActivity();

  const { navigate } = useWebContentsView();
  const selectedExerciseRef = useRef<Exercise | null>(null);

  const { data: downloadedExerciseNames, refetch: rescanDownloadedExercises } = useQuery({
    queryKey: ['downloaded-exercises'],
    queryFn: () => window.electron.getDownloadedExercises(),

  })

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

    return downloadedExerciseNames?.map(name => Object.values(exercisesQuery.data || {}).find(exercise => exercise.identifier === name)).filter(Boolean) as Exercise[] || []
  }, [downloadedExerciseNames, exercisesQuery.data])

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


  const onStartAdding = () => {

    // use a ref to prevent stale data from closures
    const currentActiveExercise = selectedExerciseRef.current;
    console.log("------ downloading ------");
    console.log({ currentActiveExercise });

    window.electron.startGitMasteryTask(`download ${currentActiveExercise?.identifier}`)

    closeAll();

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
      navigate(buildExerciseUrl(selectedExercise))
      startExercise(selectedExercise)
    }

    selectedExerciseRef.current = null;
    setIsCurrentlyAdding(false);
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
  }

  const { } = useElectronStream({
    condition: (cmd: string) => cmd.startsWith("download"),
    onData: onExerciseDownloadProgress,
    onSuccessExit: onExerciseDownloadComplete,
    onFailedExit: onExerciseDownloadFailure,
  })


  // useEffect(() => {
  //   const condition = (cmd: string) => cmd.startsWith("download");

  //   const historyLines: string[] = [] // max 4
  //   const callback = (originalCommand: string, data: GitMasteryTaskData) => {
  //     setIsCurrentlyAdding(true);
  //     console.log(`[callback - download] ${originalCommand}: ${data}`)

  //     if (!activeNotifications[originalCommand]) {
  //       activeNotifications[originalCommand] = showNotification({
  //         id: originalCommand,
  //         title: "Downloading",
  //         message: "Downloading...",
  //         loading: true,
  //         autoClose: false,
  //         withCloseButton: false,
  //       })
  //     }

  //     if (data.success) {
  //       // partial success
  //       const message = data.success.message;

  //       historyLines.push(message);
  //       if (historyLines.length > 4) {
  //         historyLines.shift();
  //       }

  //       updateNotification({
  //         id: originalCommand,
  //         message: historyLines.join("\n"),
  //       })
  //     }

  //     if (data.completed?.status === "success") {
  //       // reached the last thing, refetch query
  //       console.log("[info] download completed, refetching downloaded exercises")
  //       rescanDownloadedExercises()

  //       updateNotification({
  //         id: originalCommand,
  //         title: "Download complete",
  //         message: "",
  //         loading: false,
  //         color: "green",
  //         icon: <IconCheck size={18} />,
  //         autoClose: 5000,
  //         withCloseButton: true,
  //       })

  //       // close modal
  //       // TODO: be more specific in which modal we're closing
  //       closeAll();

  //       // redirect to the exercise
  //       const selectedExercise = selectedExerciseRef.current;
  //       if (selectedExercise) {
  //         navigate(buildExerciseUrl(selectedExercise))
  //         startExercise(selectedExercise)
  //       }

  //       selectedExerciseRef.current = null;
  //       setIsCurrentlyAdding(false);


  //     } else if (data.completed?.status === "failure") {
  //       // error
  //       console.log("[info] download completed but with errors.")

  //       updateNotification({
  //         id: originalCommand,
  //         title: "Download failed",
  //         message: data.completed?.message,
  //         loading: false,
  //         color: "red",
  //         icon: <IconX size={18} />,
  //         autoClose: 5000,
  //         withCloseButton: true,
  //       })

  //       selectedExerciseRef.current = null;
  //       setIsCurrentlyAdding(false);
  //     }
  //   }
  //   const unsubscribe = addListener(condition, callback);
  //   return unsubscribe;
  // }, [])


  return <>
    <Stack w="100%">
      <Flex justify={'space-between'} align={'center'} w="100%">

        <Text variant="subheading" style={{ flexGrow: 1 }}> Lessons </Text>
        <ActionIcon size="xs">
          <IconPlus onClick={onAddSelectedClicked} />
        </ActionIcon>
      </Flex>

      <Stack>
        {downloadedExercises?.map(exercise => (
          <DownloadedExercise key={exercise.identifier} exercise={exercise} />
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

export const DownloadedExercise = ({ exercise }: { exercise: Exercise }) => {
  const { navigate } = useWebContentsView();

  return <Flex style={{ width: "100%" }}>
    <NavigationButton title={exercise.identifier} onClick={() => { navigate(buildExerciseUrl(exercise)) }} />
  </Flex >
}