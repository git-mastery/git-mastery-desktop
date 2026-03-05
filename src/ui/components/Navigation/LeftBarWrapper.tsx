import { Box, Flex, Stack } from "@mantine/core"
import { TourList } from "./TourList"
import { LessonList } from "./LessonList"

export const LeftBarWrapper = () => {
  return <Stack h="100%" >
    {/* Tours */}
    <Stack style={{
      overflowY: "scroll",

    }}>

      <TourList />

      {/* Lessons (scrollable) */}
      <Flex flex={1}>
        <LessonList />

      </Flex>

    </Stack>
    <Flex style={{ flexGrow: 1 }}>

    </Flex>

    {/* User profile (fixed)*/}

    <Flex h={128} style={{ flexShrink: 0 }}>Hi, user!</Flex>
  </Stack>
}