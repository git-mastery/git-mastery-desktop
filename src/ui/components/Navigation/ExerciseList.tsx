import { ActionIcon, Autocomplete, Button, Flex, Modal, Select, Stack, Text } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { useWebContentsView } from "../../context/useWebContentsView"
import { useDisclosure } from "@mantine/hooks";
import { useExercises } from "../../hooks/useExercises";
import { useState } from "react";

export const ExerciseList = () => {
  const { hide, show } = useWebContentsView();

  const [opened, { open, close }] = useDisclosure(false);

  const { query } = useExercises();

  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(null)

  console.log(query.data)
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
  return <>
    <Stack w="100%">
      <Flex justify={'space-between'} align={'center'} w="100%">

        <Text variant="subheading" style={{ flexGrow: 1 }}> LESSONS </Text>
        <ActionIcon size="xs">
          <IconPlus onClick={onAddSelected} />
        </ActionIcon>
      </Flex>


    </Stack>
    <Modal opened={opened} onClose={onFinishAdding} title="Add Exercises" centered>

      <Select
        label="Select an exercise to download"
        placeholder="Pick value"
        data={Object.keys(query.data || {})}
        onChange={onSelectExercise}
        searchable
      />

      <Flex justify={"end"} mt="md">

        <Button disabled={!selectedExerciseKey} onClick={onFinishAdding}> Download </Button>
      </Flex>
    </Modal>
  </>
}