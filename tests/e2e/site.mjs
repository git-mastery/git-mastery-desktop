const lesson = {
  title: "Fixture lesson",
  tour_name: "fixture",
  lesson_name: "init",
};

const site = "https://git-mastery.org";
const html = `<!doctype html><html><head><title>Fixture lesson</title></head>
<body><h1>Fixture lesson</h1>
<section id="exercise-under-control"><h2>Under Control</h2>
<div id="ex-verify-info-under-control">Initialise the repository in the terminal.</div>
</section></body></html>`;

// Keep a closed URL map: a new production request must be reviewed explicitly.
export const responses = new Map([
  [`${site}/`, ["text/html", html]],
  [
    `${site}/lessons/`,
    [
      "text/html",
      "<!doctype html><title>Fixture course</title><h1>Fixture course</h1>",
    ],
  ],
  [`${site}/lessons/init/`, ["text/html", html]],
  [
    `${site}/lessons/lessons.json`,
    [
      "application/json",
      JSON.stringify({
        fixture: {
          folder: "fixture",
          title: "Fixture tour",
          lessons: { init: lesson },
        },
      }),
    ],
  ],
  [
    `${site}/exercises-directory/exercises.json`,
    [
      "application/json",
      JSON.stringify({
        "under-control": { identifier: "under-control", lesson },
      }),
    ],
  ],
  [`${site}/lessons/detours.json`, ["application/json", "{}"]],
  [
    `${site}/custardui.config.json`,
    [
      "application/json",
      JSON.stringify({ storageKey: "git-mastery", config: {} }),
    ],
  ],
  [
    "https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/lessons/init/text.md",
    [
      "text/plain",
      '# Fixture lesson\n<include src="exercise-under-control" />',
    ],
  ],
  [`${site}/favicon.ico`, ["image/x-icon", ""]],
  [
    "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Noto+Serif:ital,wght@0,100..900;1,100..900&display=swap",
    ["text/css", "/* Use system fonts in the offline fixture. */"],
  ],
]);
