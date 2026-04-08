import { useCustomQuery } from "./useCustomQuery"

// Gets a list of the progress of the locally downloaded exercises
export const useLocalExercises = () => {

  // Why we can use this hook and eg. rescanDownloadedExercises in multiple places
  // and have the update propagate:
  // `useQuery` caches the result of 'downloaded-exercises'
  // When one hook calls refetch(), it invalidates all hooks that use this query key
  // and causes them to refetch.

  const { data: downloadedExerciseData, refetch: rescanDownloadedExercises } = useCustomQuery({
    queryKey: ['downloaded-exercises'],
    queryFn: () => window.electron.getDownloadedExercises(),

  })

  return {
    downloadedExerciseData,
    rescanDownloadedExercises
  }
}