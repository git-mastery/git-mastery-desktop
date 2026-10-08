# Lesson completion (tours sidebar)

Completion is local to the desktop app. Tour and lesson rows in the tours sidebar
each have a circle control on the left: empty when not done, green check when done.
Lesson clicks toggle that lesson's `lesson_name` in renderer `localStorage`
(`gm-lessons-done`). A tour is checked only when every lesson in that tour is
checked; clicking the tour control marks or clears all of its lessons at once.
Title rows still expand/collapse and navigate as before.

State is not written to main `config.json`, CustardUI, or CLI verify progress.
