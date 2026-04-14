import { Box, Title, Space, Group, Button, SimpleGrid, Flex, Divider, Center } from "@mantine/core"
import { useActivity } from "../../context/useActivity"
import { Text } from "@mantine/core"

export const Header = () => {

  const { getActivityText, isDoingActivity, endActivity, verifyExercise } = useActivity()

  return <SimpleGrid cols={3} p="md" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: '64px' }}>
    <Title order={4}> GitMastery </Title>
    <Box >
      {isDoingActivity && <Flex px="md" bg="gm-green" w="100%" h="100%" gap={"lg"} style={{
        borderRadius: "24px",
        paddingTop: "2px",
        paddingBottom: "2px"

      }}>
        <Center>

          <Button size="sm" variant="subtle" c="white" onClick={() => endActivity()} >Quit</Button>
        </Center>
        <Divider orientation="vertical" />
        <Center>

          <Text c="white">
            {getActivityText()}
          </Text>
        </Center>
        <Divider orientation="vertical" />
        <Center>

          <Button size="sm" variant="transparent" c="white"
            onClick={() => {
              verifyExercise({})
            }}
          >Check solution</Button>
        </Center>

      </Flex>}

    </Box>
    <Box></Box>
  </SimpleGrid>


}