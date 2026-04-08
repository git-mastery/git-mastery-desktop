import { Box, Button, Collapse, Flex, Stack, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { Lesson, Tour, TourData } from "../../../types/Tour"
import { useCustomQuery } from "../../hooks/query/useCustomQuery"
import { buildLessonUrl, useWebContentsView } from "../../context/useWebContentsView"
import { IconChevronCompactDown, IconChevronDown } from "@tabler/icons-react"

import classes from './TourList.module.css'
import { NavigationButton } from "./NavigationButton/NavigationButton"

export const TourList = () => {

  const { data: tourList, isLoading } = useCustomQuery<TourData>({ queryKey: ["tour_list"], queryUrl: "https://git-mastery.org/lessons/lessons.json" })
  return <Stack>
    <Text variant="subheading"> Tours </Text>
    {tourList ? Object.values(tourList).map((tour, index) => <TourItem key={index} tour={tour} index={index} />) : "No data"}
  </Stack>
}

const TourItem = ({ tour, index }: { tour: Tour, index: number }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { navigate } = useWebContentsView();

  return <Flex direction={"column"} key={tour.title}>
    <Tooltip label={tour.title} position="bottom-start" withArrow multiline w="200">

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

        } >
        <Flex gap={4} align="center">
          <Box style={{ flexShrink: 0 }}>

            <IconChevronDown className={classes['icon']} style={{
              transform: opened ? "rotate(180deg)" : "none"
            }} size={12} />
          </Box>
          {tour.title}
        </Flex>
      </Button>
    </Tooltip >
    <Collapse in={opened} p="8px" w={"100%"}>
      {buildLesson({ path: `lessons/trail/${tour.folder}`, title: "Tour Home" }, navigate)}
      {Object.values(tour.lessons).map(lesson => buildLesson(lesson, navigate))}
    </Collapse>
  </Flex >
}

const buildLesson = (lesson: Lesson, navigate: (url: string) => void) => {
  return <NavigationButton title={lesson.title} onClick={() => navigate(buildLessonUrl(lesson))} />
}