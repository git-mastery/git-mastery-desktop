import { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
} from "@tabler/icons-react";
import type { Exercise } from "../../../types/Exercise";
import type { Lesson, Tour, TourData } from "../../../types/Tour";
import {
  buildExerciseUrl,
  buildHandsOnUrl,
  buildLessonUrl,
  buildTourHomeUrl,
  isLessonUrlActive,
  isTourHomeUrlActive,
  isTourUrlActive,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { useCustomQuery } from "../../hooks/query/useCustomQuery";
import { useExercises } from "../../hooks/query/useExercises";
import { useHandsOn, type HandsOn } from "../../hooks/query/useHandsOn";
import { StatusPill } from "../ui/StatusPill";
import {
  formatExerciseTitle,
  formatHandsOnTitle,
  getExerciseLessonName,
} from "../../utils/format";
import { useLocalExercises } from "../../hooks/query/useLocalExercises";

export const LessonsPanelToggle = ({
  opened,
  onToggle,
}: {
  opened: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      type="button"
      aria-label={opened ? "Close tours" : "Open tours"}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
    >
      {opened ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />}
      Tours
    </button>
  );
};

export const ToursPanel = ({ onClose }: { onClose: () => void }) => {
  const { data: tourList, isLoading } = useCustomQuery<TourData>({
    queryKey: ["tour_list"],
    queryUrl: "https://git-mastery.org/lessons/lessons.json",
  });
  const { query: exercisesQuery } = useExercises();
  const { downloadedExerciseData } = useLocalExercises();
  const { navigate, currentUrl } = useWebContentsView();

  const tours = useMemo(
    () =>
      tourList
        ? Object.values(tourList).filter((tour) => tour.folder !== "all")
        : [],
    [tourList],
  );

  const lessonNames = useMemo(() => {
    const names = new Set<string>();
    for (const tour of tours) {
      for (const lesson of Object.values(tour.lessons)) {
        names.add(lesson.lesson_name);
      }
    }
    return [...names].sort();
  }, [tours]);

  const { data: handsOnByLesson } = useHandsOn(lessonNames);

  const exercisesByLesson = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const exercise of Object.values(exercisesQuery.data || {})) {
      if (exercise.wip) continue;
      const lessonName = getExerciseLessonName(exercise);
      if (!lessonName) continue;
      const list = map.get(lessonName) ?? [];
      list.push(exercise);
      map.set(lessonName, list);
    }
    return map;
  }, [exercisesQuery.data]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-2">
        <LessonsPanelToggle opened onToggle={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-3">
          {isLoading && (
            <span className="px-2 text-[13px] text-muted">Loading…</span>
          )}
          {tours.map((tour) => (
            <TourItem
              key={tour.folder}
              tour={tour}
              currentUrl={currentUrl}
              exercisesByLesson={exercisesByLesson}
              handsOnByLesson={handsOnByLesson}
              downloadedExerciseData={downloadedExerciseData}
              onNavigate={navigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const listItemClasses =
  "w-full rounded-lg px-2 py-2 text-left text-sm leading-normal text-fg hover:cursor-pointer hover:bg-hover focus-visible:bg-hover focus-visible:outline-none";

const activeItemClasses = "bg-accent-soft text-accent font-medium";

const TourItem = ({
  tour,
  currentUrl,
  exercisesByLesson,
  handsOnByLesson,
  downloadedExerciseData,
  onNavigate,
}: {
  tour: Tour;
  currentUrl: string | null;
  exercisesByLesson: Map<string, Exercise[]>;
  handsOnByLesson: Record<string, HandsOn[]> | undefined;
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
}) => {
  const isActive = isTourUrlActive(tour, currentUrl);
  const [opened, setOpened] = useState(isActive);
  const [wasActive, setWasActive] = useState(isActive);

  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setOpened(true);
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={opened}
        onClick={() => setOpened((value) => !value)}
        className={`${listItemClasses} ${isActive ? activeItemClasses : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <IconChevronDown
            size={12}
            className={`shrink-0 text-muted transition-transform duration-150 ease-in-out ${opened ? "rotate-180" : ""}`}
          />
          {tour.title}
        </span>
      </button>
      {opened && (
        <div className="pl-3">
          <button
            type="button"
            className={`${listItemClasses} ${isTourHomeUrlActive(tour, currentUrl) ? activeItemClasses : ""}`}
            onClick={() => onNavigate(buildTourHomeUrl(tour))}
          >
            <span className="flex items-center gap-1.5">
              <IconHome size={14} className="shrink-0 text-muted" />
              Tour Home
            </span>
          </button>
          {Object.values(tour.lessons).map((lesson) => (
            <LessonItem
              key={lesson.lesson_name}
              lesson={lesson}
              currentUrl={currentUrl}
              exercises={exercisesByLesson.get(lesson.lesson_name) ?? []}
              handsOn={handsOnByLesson?.[lesson.lesson_name] ?? []}
              downloadedExerciseData={downloadedExerciseData}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const LessonItem = ({
  lesson,
  currentUrl,
  exercises,
  handsOn,
  downloadedExerciseData,
  onNavigate,
}: {
  lesson: Lesson;
  currentUrl: string | null;
  exercises: Exercise[];
  handsOn: HandsOn[];
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
}) => {
  const hasItems = exercises.length > 0 || handsOn.length > 0;
  const isActive = isLessonUrlActive(lesson, currentUrl);
  const [opened, setOpened] = useState(isActive);
  const [wasActive, setWasActive] = useState(isActive);

  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setOpened(true);
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={opened}
        onClick={() => {
          if (!isActive) onNavigate(buildLessonUrl(lesson));
          setOpened((value) => !value);
        }}
        className={`${listItemClasses} ${isActive ? activeItemClasses : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <IconChevronDown
            size={12}
            className={`shrink-0 text-muted transition-transform duration-150 ease-in-out ${opened ? "rotate-180" : ""}`}
          />
          {lesson.title}
        </span>
      </button>
      {opened && (
        <div className="pl-3">
          {hasItems ? (
            <>
              {exercises.map((exercise) => {
                const status =
                  downloadedExerciseData?.[exercise.identifier]?.status;
                return (
                  <button
                    key={exercise.identifier}
                    type="button"
                    className={listItemClasses}
                    onClick={() => onNavigate(buildExerciseUrl(exercise))}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        Exercise: {formatExerciseTitle(exercise)}
                      </span>
                      {status && <StatusPill status={status} />}
                    </span>
                  </button>
                );
              })}
              {handsOn.map((item) => {
                const status =
                  downloadedExerciseData?.[item.identifier]?.status;
                return (
                  <button
                    key={item.identifier}
                    type="button"
                    className={listItemClasses}
                    onClick={() =>
                      onNavigate(buildHandsOnUrl(lesson, item.identifier))
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        Hands-on: {formatHandsOnTitle(item.identifier)}
                      </span>
                      {status === "downloaded" && (
                        <StatusPill status="downloaded" />
                      )}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <span className="block px-2 py-1.5 text-[13px] text-faint">
              No exercises
            </span>
          )}
        </div>
      )}
    </div>
  );
};
