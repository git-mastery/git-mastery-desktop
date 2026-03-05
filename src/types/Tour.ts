// export type Lesson = {
//   id: number,
//   identifier: string,
//   name: string
// }

// export type Tour = {
//   id: number,
//   identifier: string,
//   name: string,
//   lessons: Lesson[]
// }

export type TourData = {
  [folder: string]: Tour
}

export type Tour = {
  folder: string, // tour key
  title: string,
  lessons: {
    [lessonKey: string]: Lesson,
  }
}

export type Lesson = {
  path: string,
  title: string
}


// "recordingFolderHistory": {
//     "folder": "recordingFolderHistory",
//     "title": "Tour 1: Recording the History of a Folder",
//     "lessons": {
//       "intro": {
//         "path": "lessons/intro",
//         "title": "T1L1. Introduction to Revision Control"
//       },
//       "gitPrep": {
//         "path": "lessons/gitPrep",
//         "title": "T1L2. Preparing to Use Git"
//       },
//       "init": {
//         "path": "lessons/init",
//         "title": "T1L3. Putting a Folder Under Git's Control"
//       },
//       "stage": {
//         "path": "lessons/stage",
//         "title": "T1L4. Specifying What to Include in a Snapshot"
//       },
//       "commit": {
//         "path": "lessons/commit",
//         "title": "T1L5. Saving a Snapshot"
//       },
//       "log": {
//         "path": "lessons/log",
//         "title": "T1L6. Examining the Revision History"
//       }
//     }
//   },