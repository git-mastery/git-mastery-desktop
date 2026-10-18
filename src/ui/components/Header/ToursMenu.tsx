import { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import type { Exercise } from "../../../types/Exercise";
import type { Lesson, Tour, TourData } from "../../../types/Tour";
import {
  buildDetourUrl,
  buildExerciseUrl,
  buildHandsOnUrl,
  buildLessonUrl,
  buildTourHomeUrl,
  buildTourOutroUrl,
  isLessonUrlActive,
  isTourHomeUrlActive,
  isTourOutroUrlActive,
  isTourUrlActive,
  isUrlHashActive,
  useWebContentsView,
} from "../../contexts/WebContentsViewContext";
import { useCustomQuery } from "../../hooks/query/useCustomQuery";
import {
  useCourseEditionLabels,
  type RequirementLabel,
} from "../../hooks/query/useCourseEdition";
import { useDetours } from "../../hooks/query/useDetours";
import { useExercises } from "../../hooks/query/useExercises";
import { useHandsOn } from "../../hooks/query/useHandsOn";
import { StatusPill } from "../ui/StatusPill";
import { formatExerciseIdentifier } from "../../utils/format";
import {
  buildLessonOutline,
  type LessonOutlineItem,
} from "../../utils/lessonOutline";
import { useLocalExercises } from "../../hooks/query/useLocalExercises";
import { useLessonsDone } from "../../contexts/LessonsDoneContext";
import { cx } from "../../utils/cx";

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

const TYPE_DOTS = {
  lesson: { className: "bg-faint", label: "Lesson" },
  "hands-on": { className: "bg-info", label: "Hands-on" },
  exercise: { className: "bg-gm-olive", label: "Exercise" },
  detour: { className: "bg-warning", label: "Detour" },
} as const;

type ItemKind = keyof typeof TYPE_DOTS;

const TypeDot = ({
  kind,
  decorative = false,
}: {
  kind: ItemKind;
  decorative?: boolean;
}) => {
  const { className, label } = TYPE_DOTS[kind];
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      title={label}
      className={cx("inline-block size-1.5 shrink-0 rounded-full", className)}
    />
  );
};

const TypeLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-[11px] text-muted">
    {(Object.keys(TYPE_DOTS) as ItemKind[]).map((kind) => (
      <span key={kind} className="inline-flex items-center gap-1.5">
        <TypeDot kind={kind} decorative />
        {TYPE_DOTS[kind].label}
      </span>
    ))}
  </div>
);

const REQUIREMENT_TONE_CLASSES: Record<RequirementLabel["tone"], string> = {
  danger: "border-danger-border bg-danger-soft text-danger",
  info: "border-info-border bg-info-soft text-info",
  muted: "border-border bg-subtle text-muted",
};

const isCompulsoryLabel = (label?: RequirementLabel) =>
  label?.value.toLowerCase() === "compulsory";

const CompulsoryAsterisk = () => (
  <span className="text-danger" aria-label="Compulsory" title="Compulsory">
    *
  </span>
);

const RequirementChip = ({ label }: { label: RequirementLabel }) => (
  <span
    title={label.value}
    aria-label={label.value}
    className={cx(
      "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      REQUIREMENT_TONE_CLASSES[label.tone],
    )}
  >
    {label.value}
  </span>
);

const TitleWithRequirement = ({
  title,
  label,
}: {
  title: string;
  label?: RequirementLabel;
}) => (
  <span className="min-w-0">
    {title}
    {isCompulsoryLabel(label) && (
      <>
        {" "}
        <CompulsoryAsterisk />
      </>
    )}
  </span>
);

export const ToursPanel = ({ onClose }: { onClose: () => void }) => {
  const { data: tourList, isLoading } = useCustomQuery<TourData>({
    queryKey: ["tour_list"],
    queryUrl: "https://git-mastery.org/lessons/lessons.json",
  });
  const { query: exercisesQuery } = useExercises();
  const { data: detours } = useDetours();
  const { data: editionLabels } = useCourseEditionLabels();
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

  const outlinesByLesson = useMemo(() => {
    const map = new Map<string, LessonOutlineItem[]>();
    for (const tour of tours) {
      for (const lesson of Object.values(tour.lessons)) {
        map.set(
          lesson.lesson_name,
          buildLessonOutline(
            lesson.lesson_name,
            exercisesQuery.data,
            detours,
            handsOnByLesson?.[lesson.lesson_name],
          ),
        );
      }
    }
    return map;
  }, [tours, exercisesQuery.data, detours, handsOnByLesson]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-2">
        <LessonsPanelToggle opened onToggle={onClose} />
      </div>
      <TypeLegend />
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
              outlinesByLesson={outlinesByLesson}
              editionLabels={editionLabels}
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
  "w-full rounded-lg px-2 py-2 text-left text-sm leading-normal text-fg hover:cursor-pointer focus-visible:outline-none";

const listItemHover = "hover:bg-hover focus-visible:bg-hover";

const activeItemClasses = "bg-accent-soft text-accent font-medium";

const doneToggleButtonClasses =
  "mt-0.5 shrink-0 rounded-lg px-1 py-2 text-muted hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none";

const titleRowClasses = (done: boolean, isActive: boolean) =>
  cx(
    "flex min-w-0 items-stretch rounded-lg",
    done && isActive
      ? "bg-accent-soft-hover"
      : done || isActive
        ? "bg-accent-soft"
        : "",
  );

const DoneCircleToggle = ({
  done,
  subject,
  onToggle,
  quiet,
}: {
  done: boolean;
  subject: string;
  onToggle: () => void;
  quiet?: boolean;
}) => (
  <button
    type="button"
    aria-pressed={done}
    aria-label={
      done ? `Mark ${subject} as not done` : `Mark ${subject} as done`
    }
    onClick={onToggle}
    className={cx(doneToggleButtonClasses, !quiet && "hover:bg-hover")}
  >
    {done ? (
      <IconCircleCheck size={16} className="text-accent" aria-hidden />
    ) : (
      <IconCircle size={16} className="text-faint" aria-hidden />
    )}
  </button>
);

type EditionLabels = Map<string, RequirementLabel> | null | undefined;

const TourItem = ({
  tour,
  currentUrl,
  outlinesByLesson,
  editionLabels,
  downloadedExerciseData,
  onNavigate,
}: {
  tour: Tour;
  currentUrl: string | null;
  outlinesByLesson: Map<string, LessonOutlineItem[]>;
  editionLabels: EditionLabels;
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
}) => {
  const isActive = isTourUrlActive(tour, currentUrl);
  const { areAllLessonsDone, setLessonsDone } = useLessonsDone();
  const tourLessonNames = useMemo(
    () => Object.values(tour.lessons).map((lesson) => lesson.lesson_name),
    [tour.lessons],
  );
  const tourDone = areAllLessonsDone(tourLessonNames);
  const [opened, setOpened] = useState(isActive);
  const [wasActive, setWasActive] = useState(isActive);

  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setOpened(true);
  }

  const filled = tourDone || isActive;

  return (
    <div className="flex flex-col">
      <div className={titleRowClasses(tourDone, isActive)}>
        <DoneCircleToggle
          done={tourDone}
          subject={tour.title}
          quiet={filled}
          onToggle={() => setLessonsDone(tourLessonNames, !tourDone)}
        />
        <button
          type="button"
          aria-expanded={opened}
          onClick={() => setOpened((value) => !value)}
          className={cx(
            listItemClasses,
            "min-w-0 flex-1",
            isActive && "text-accent font-medium",
            !filled && listItemHover,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <IconChevronDown
              size={12}
              className={`shrink-0 text-muted transition-transform duration-150 ease-in-out ${opened ? "rotate-180" : ""}`}
            />
            <TypeDot kind="lesson" />
            <span className="min-w-0">{tour.title}</span>
          </span>
        </button>
      </div>
      {opened && (
        <div className="pl-3">
          <button
            type="button"
            className={cx(
              listItemClasses,
              listItemHover,
              isTourHomeUrlActive(tour, currentUrl) ? activeItemClasses : "",
            )}
            onClick={() => onNavigate(buildTourHomeUrl(tour))}
          >
            <span className="flex items-center gap-1.5">
              <TypeDot kind="lesson" />
              Tour Intro
            </span>
          </button>
          {Object.values(tour.lessons).map((lesson) => (
            <LessonItem
              key={lesson.lesson_name}
              lesson={lesson}
              labelKey={`${tour.folder}.${lesson.lesson_name}`}
              currentUrl={currentUrl}
              outline={outlinesByLesson.get(lesson.lesson_name) ?? []}
              editionLabels={editionLabels}
              downloadedExerciseData={downloadedExerciseData}
              onNavigate={onNavigate}
            />
          ))}
          <button
            type="button"
            className={cx(
              listItemClasses,
              listItemHover,
              isTourOutroUrlActive(tour, currentUrl) ? activeItemClasses : "",
            )}
            onClick={() => onNavigate(buildTourOutroUrl(tour))}
          >
            <span className="flex items-center gap-1.5">
              <TypeDot kind="lesson" />
              Tour Outro
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

const LessonItem = ({
  lesson,
  labelKey,
  currentUrl,
  outline,
  editionLabels,
  downloadedExerciseData,
  onNavigate,
}: {
  lesson: Lesson;
  labelKey: string;
  currentUrl: string | null;
  outline: LessonOutlineItem[];
  editionLabels: EditionLabels;
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
}) => {
  const isActive = isLessonUrlActive(lesson, currentUrl);
  const { isLessonDone, setLessonDone } = useLessonsDone();
  const done = isLessonDone(lesson.lesson_name);
  const [opened, setOpened] = useState(isActive);
  const [wasActive, setWasActive] = useState(isActive);

  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setOpened(true);
  }

  const filled = done || isActive;
  const lessonLabel = editionLabels?.get(labelKey);

  return (
    <div className="flex flex-col">
      <div className={titleRowClasses(done, isActive)}>
        <DoneCircleToggle
          done={done}
          subject={lesson.title}
          quiet={filled}
          onToggle={() => setLessonDone(lesson.lesson_name, !done)}
        />
        <button
          type="button"
          aria-expanded={opened}
          onClick={() => {
            if (!isActive) onNavigate(buildLessonUrl(lesson));
            setOpened((value) => !value);
          }}
          className={cx(
            listItemClasses,
            "min-w-0 flex-1",
            isActive && "text-accent font-medium",
            !filled && listItemHover,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <IconChevronDown
              size={12}
              className={`shrink-0 text-muted transition-transform duration-150 ease-in-out ${opened ? "rotate-180" : ""}`}
            />
            <TypeDot kind="lesson" />
            <TitleWithRequirement title={lesson.title} label={lessonLabel} />
            {lessonLabel && !isCompulsoryLabel(lessonLabel) && (
              <RequirementChip label={lessonLabel} />
            )}
          </span>
        </button>
      </div>
      {opened && (
        <div className="pl-3">
          {outline.length > 0 ? (
            outline.map((item) => (
              <OutlineRow
                key={
                  item.kind === "exercise"
                    ? item.exercise.identifier
                    : item.kind === "detour"
                      ? item.detourKey
                      : item.identifier
                }
                item={item}
                lesson={lesson}
                currentUrl={currentUrl}
                editionLabels={editionLabels}
                downloadedExerciseData={downloadedExerciseData}
                onNavigate={onNavigate}
              />
            ))
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

const OutlineRow = ({
  item,
  lesson,
  currentUrl,
  editionLabels,
  downloadedExerciseData,
  onNavigate,
}: {
  item: LessonOutlineItem;
  lesson: Lesson;
  currentUrl: string | null;
  editionLabels: EditionLabels;
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
}) => {
  if (item.kind === "hands-on") {
    const status = downloadedExerciseData?.[item.identifier]?.status;
    const isActive = isUrlHashActive(item.panelId, currentUrl);
    return (
      <button
        type="button"
        className={cx(
          listItemClasses,
          listItemHover,
          isActive && activeItemClasses,
        )}
        onClick={() => onNavigate(buildHandsOnUrl(lesson, item.panelId))}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <TypeDot kind="hands-on" />
            <span className="min-w-0 truncate">{item.title}</span>
          </span>
          {status === "downloaded" && <StatusPill status="downloaded" />}
        </span>
      </button>
    );
  }

  if (item.kind === "exercise") {
    return (
      <ExerciseRow
        catalogKey={item.catalogKey}
        exercise={item.exercise}
        currentUrl={currentUrl}
        editionLabels={editionLabels}
        downloadedExerciseData={downloadedExerciseData}
        onNavigate={onNavigate}
      />
    );
  }

  const isActive = isUrlHashActive(item.detourKey, currentUrl);
  const detourLabel = editionLabels?.get(item.detourKey);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={cx(
          listItemClasses,
          listItemHover,
          isActive && activeItemClasses,
        )}
        onClick={() => onNavigate(buildDetourUrl(lesson, item.detourKey))}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <TypeDot kind="detour" />
          <TitleWithRequirement title={item.title} label={detourLabel} />
          {detourLabel && !isCompulsoryLabel(detourLabel) && (
            <RequirementChip label={detourLabel} />
          )}
        </span>
      </button>
      {item.exercises.length > 0 && (
        <div className="pl-3">
          {item.exercises.map(({ catalogKey, exercise }) => (
            <ExerciseRow
              key={exercise.identifier}
              catalogKey={catalogKey}
              exercise={exercise}
              currentUrl={currentUrl}
              editionLabels={editionLabels}
              downloadedExerciseData={downloadedExerciseData}
              onNavigate={onNavigate}
              heuristicOptional
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ExerciseRow = ({
  catalogKey,
  exercise,
  currentUrl,
  editionLabels,
  downloadedExerciseData,
  onNavigate,
  heuristicOptional = false,
}: {
  catalogKey: string;
  exercise: Exercise;
  currentUrl: string | null;
  editionLabels: EditionLabels;
  downloadedExerciseData: ProgressData | undefined;
  onNavigate: (url: string) => void;
  heuristicOptional?: boolean;
}) => {
  const status = downloadedExerciseData?.[exercise.identifier]?.status;
  const isActive = isUrlHashActive(
    `exercise-${exercise.identifier}`,
    currentUrl,
  );
  const editionLabel = editionLabels?.get(catalogKey);
  const showHeuristic = editionLabels == null && heuristicOptional;
  return (
    <button
      type="button"
      className={cx(
        listItemClasses,
        listItemHover,
        isActive && activeItemClasses,
      )}
      onClick={() => onNavigate(buildExerciseUrl(exercise))}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <TypeDot kind="exercise" />
          <TitleWithRequirement
            title={formatExerciseIdentifier(exercise.identifier)}
            label={editionLabel}
          />
          {editionLabel && !isCompulsoryLabel(editionLabel) && (
            <RequirementChip label={editionLabel} />
          )}
          {showHeuristic && (
            <span className="shrink-0 text-[11px] text-muted">Optional</span>
          )}
        </span>
        {status && <StatusPill status={status} />}
      </span>
    </button>
  );
};
