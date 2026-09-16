import {
  EXERCISES_HOME_URL,
  LESSONS_HOME_URL,
  buildProgressUrl,
  getSiteSection,
  useWebContentsView,
  type SiteSection,
} from "../../contexts/WebContentsViewContext";
import { cx } from "../../utils/cx";

const ITEMS: { id: SiteSection; label: string; href: () => string }[] = [
  { id: "lessons", label: "Lessons", href: () => LESSONS_HOME_URL },
  { id: "exercises", label: "Exercises", href: () => EXERCISES_HOME_URL },
  { id: "progress", label: "Progress", href: buildProgressUrl },
];

export const SiteNav = () => {
  const { currentUrl, navigate } = useWebContentsView();
  const section = getSiteSection(currentUrl);

  return (
    <nav className="flex h-full items-center gap-1" aria-label="Site">
      {ITEMS.map((item) => {
        const isActive = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => navigate(item.href())}
            className={cx(
              "h-full px-3 text-base font-bold hover:cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
              isActive ? "text-accent" : "text-muted hover:text-fg",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};
