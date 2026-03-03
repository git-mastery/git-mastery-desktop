import { Button, Collapse, Flex, Stack, Text } from "@mantine/core"
import type { Lesson, Tour } from "../../../types/Lesson"
import { TOUR_LIST } from "../../../data/tours"
import { useDisclosure } from "@mantine/hooks"

export const TourList = () => {
  return <Stack>
    <Text variant="subheading"> TOURS </Text>
    {TOUR_LIST.map(buildTour)}
  </Stack>
}

const buildTour = (tour: Tour) => {
  const [opened, { toggle }] = useDisclosure(false);
  return <Flex direction={"column"}>
    <Button
      onClick={toggle}
      variant="subtle"
      color="dark"
      styles={
        {
          label: { whiteSpace: "pre-wrap", textAlign: "left" },
          root: {
            height: 'auto',
            padding: "8px",
            lineHeight: "1.5em"
          },
        }

      } >T{tour.id}: {tour.name} </Button>
    <Collapse in={opened} p="8px" w={"100%"}>
      {tour.lessons.map(buildLesson)}
    </Collapse>
  </Flex >
}

const buildLesson = (lesson: Lesson) => {
  return <Button variant="subtle" color="dark" size="sm" w="100%" styles={
    {
      label: { whiteSpace: "pre-wrap", textAlign: "left", width: "100%" },
      root: {
        height: 'auto',
        padding: "8px",
        lineHeight: "1.5em"
      },
    }

  } > L{lesson.id}: {lesson.name} </Button>
}