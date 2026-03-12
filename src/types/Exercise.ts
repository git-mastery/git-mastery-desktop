import type { Lesson } from "./Tour"

export type Exercise = {
  [key: string]: {
    "lesson"?: Lesson,
    "detour"?: {
      "lesson": Lesson,
      title: string
    },
    "identifier": string
  }
}


// {
//   "under_control": {
//     "lesson": {
//       "path": "lessons/init",
//       "title": "T1L3. Putting a Folder Under Git's Control"
//     },
//     "identifier": "under-control"
//   },
//   "undo_init": {
//     "lesson": {
//       "path": "lessons/init",
//       "title": "T1L3. Putting a Folder Under Git's Control"
//     },
//     "detour": {
//       "lesson": {
//         "path": "lessons/init",
//         "title": "T1L3. Putting a Folder Under Git's Control"
//       },
//       "title": "Undoing a Repo Initialisation"
//     },
//     "identifier": "undo-init"
//   },
// }