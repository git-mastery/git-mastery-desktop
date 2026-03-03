import { Box, Flex, Stack } from "@mantine/core"
import { TourList } from "./TourList"
import { LessonList } from "./LessonList"

export const LeftBarWrapper = () => {
  return <Stack h="100%">
    {/* Tours */}
    <TourList />

    {/* Lessons (scrollable) */}
    <Flex flex={1}>
      <LessonList />

    </Flex>

    {/* User profile (fixed)*/}

    <Box h={128}>Hi, user!</Box>
  </Stack>
}