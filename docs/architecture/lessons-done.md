# Lesson completion (tours sidebar)

Completion is local to the desktop app. Lesson rows in the tours sidebar have a
circle control on the right: empty when not done, green check when done. A done
lesson uses the success fill (`bg-accent-soft`) across the whole title,
including the check. The current page still uses accent text. A row that is both
done and current uses `bg-accent-soft-hover`.

Lesson clicks toggle that lesson's `lesson_name` in renderer `localStorage`
(`gm-lessons-done`). Tour progress is derived from those lessons: the title row
fills from the left with `bg-accent-soft` in proportion to completed lessons, and
switches to the darker `bg-accent-soft-hover` when every lesson in the tour is
done. Tours have no bulk check control.

Title rows still expand/collapse and navigate as before.

State is not written to main `config.json`, CustardUI, or CLI verify progress.
