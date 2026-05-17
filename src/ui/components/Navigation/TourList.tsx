import { Button, Collapse, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { Lesson, Tour, TourData } from "../../../types/Tour"
import { useCustomQuery } from "../../hooks/query/useCustomQuery"
import { buildLessonUrl, useWebContentsView } from "../../context/useWebContentsView"
import { IconChevronDown } from "@tabler/icons-react"
import { NavigationButton } from "./NavigationButton/NavigationButton"

export const TourList = () => {

  const { data: tourList, isLoading } = useCustomQuery<TourData>({ queryKey: ["tour_list"], queryUrl: "https://git-mastery.org/lessons/lessons.json" })
  return <div className="flex flex-col gap-2">
    <Text variant="subheading"> Tours </Text>
    {tourList ? Object.values(tourList).map((tour, index) => <TourItem key={index} tour={tour} index={index} />) : "No data"}
  </div>
}

const TourItem = ({ tour, index }: { tour: Tour, index: number }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { navigate } = useWebContentsView();

  return <div className="flex flex-col" key={tour.title}>
    <Tooltip label={tour.title} position="bottom-start" withArrow multiline w="200">
      <Button
        onClick={toggle}
        variant="subtle"
        color="dark"
        w="100%"
        styles={{
          label: { textAlign: "left", width: "100%" },
          root: { height: 'auto', padding: "8px", lineHeight: "1.5em" },
        }}
      >
        <div className="flex gap-1 items-center">
          <IconChevronDown className={`shrink-0 transition-all duration-150 ease-in-out ${opened ? "rotate-180" : ""}`} size={12} />
          {tour.title}
        </div>
      </Button>
    </Tooltip>
    <Collapse in={opened} p="8px" w={"100%"}>
      {buildLesson({ path: `lessons/trail/${tour.folder}`, title: "Tour Home" }, navigate)}
      {Object.values(tour.lessons).map(lesson => buildLesson(lesson, navigate))}
    </Collapse>
  </div>
}

const buildLesson = (lesson: Lesson, navigate: (url: string) => void) => {
  return <NavigationButton title={lesson.title} onClick={() => navigate(buildLessonUrl(lesson))} />
}
