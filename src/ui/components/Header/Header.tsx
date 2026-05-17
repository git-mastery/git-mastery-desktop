import { Title, Button, SimpleGrid, Flex, Box, Divider, Center } from "@mantine/core"
import { useActivity } from "../../context/useActivity"
import { Text } from "@mantine/core"

export const Header = () => {
  
  const { getActivityText, isDoingActivity, endActivity, verifyExercise } = useActivity()

  return <SimpleGrid cols={3} p="md" className="flex items-center justify-between h-16">
    <Title order={4}> GitMastery </Title>
    <Box>
      {isDoingActivity && <Flex px="md" bg="gm-green" w="100%" h="100%" gap="lg" className="rounded-3xl py-0.5">
        <Center>
          <Button size="sm" variant="subtle" c="white" onClick={() => endActivity()}>Quit</Button>
        </Center>
        <Divider orientation="vertical" />
        <Center>
          <Text c="white">
            {getActivityText()}
          </Text>
        </Center>
        <Divider orientation="vertical" />
        <Center>
          <Button size="sm" variant="transparent" c="white" onClick={() => verifyExercise({})}>Check solution</Button>
        </Center>
      </Flex>}
    </Box>
    <Box />
  </SimpleGrid>
}
