import { Button, Collapse, Flex, Stack, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { Lesson, Tour, TourData } from "../../../types/Tour"
import { useCustomQuery } from "../../hooks/useCustomQuery"
import { buildUrl, useWebContentsView } from "../../context/useWebContentsView"

export const TourList = () => {

  const { data: tourList, isLoading } = useCustomQuery<TourData>({ queryKey: ["tour_list"], queryUrl: "https://git-mastery.org/lessons/lessons.json" })
  return <Stack>
    <Text variant="subheading"> TOURS </Text>
    {tourList ? Object.values(tourList).map((tour, index) => <TourItem key={index} tour={tour} index={index} />) : "No data"}
  </Stack>
}

const TourItem = ({ tour, index }: { tour: Tour, index: number }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { navigate } = useWebContentsView();

  return <Flex direction={"column"}>
    <Tooltip label={tour.title} position="right" withArrow>

      <Button
        onClick={toggle}
        variant="subtle"
        color="dark"
        w="100%"
        styles={
          {
            label: {
              // whiteSpace: "pre-wrap",
              textAlign: "left", width: "100%"
            },
            root: {
              height: 'auto',
              padding: "8px",
              lineHeight: "1.5em"
            },
          }

        } >{tour.title} </Button>
    </Tooltip>
    <Collapse in={opened} p="8px" w={"100%"}>
      {buildLesson({ path: `lessons/trail/${tour.folder}`, title: "Tour Home" }, navigate)}
      {Object.values(tour.lessons).map(lesson => buildLesson(lesson, navigate))}
    </Collapse>
  </Flex>
}

const buildLesson = (lesson: Lesson, navigate: (url: string) => void) => {
  return <Button variant="subtle" color="dark" size="sm" w="100%"
    onClick={() => navigate(buildUrl(lesson))}
    styles={
      {
        label: { whiteSpace: "pre-wrap", textAlign: "left", width: "100%" },
        root: {
          height: 'auto',
          padding: "8px",
          lineHeight: "1.5em"
        },
      }

    } > {lesson.title} </Button>
}