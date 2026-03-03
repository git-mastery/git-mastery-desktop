import type { Tour } from "../types/Lesson";

export const TOUR_LIST: Tour[] = [
  {
    id: 1,
    name: "Recording the History of a Folder",
    identifier: "trail/recordingFolderHistory",
    lessons: [
      {
        id: 1,
        name: "Introduction to Revision Control",
        identifier: "intro"
      }, {
        id: 2,
        name: "Preparing to use Git",
        identifier: "gitPrep"
      }, {
        id: 3,
        name: "Putting a Folder Under Git's Control",
        identifier: "init"
      }
    ]
  }, {
    id: 2,
    name: "Backing up a Repo on the Cloud",
    identifier: "trail/backingUpOnCloud",
    lessons: [
      {
        id: 1,
        name: "Remote Repositories",
        identifier: "remoteRepos"
      }, {
        id: 2,
        name: "Preparing to use GitHub",
        identifier: "githubPrep"
      }, {
        id: 3,
        name: "Creating a Repo on GitHub",
        identifier: "createRemoteRepo"
      }
    ]
  }
]