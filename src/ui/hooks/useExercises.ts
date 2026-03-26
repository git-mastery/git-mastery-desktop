import type { Exercises } from "../../types/Exercise"
import { useCustomQuery } from "./useCustomQuery"

export const useExercises = () => {

  // const localExcersises TODO: this should be loaded from 

  const query = useCustomQuery<Exercises>({
    queryKey: ["exercises"],
    queryUrl: "https://git-mastery.org/exercises-directory/exercises.json"
  })

  // need to somehow send to electron backend to spawn a terminal to download...

  return {
    query
  }
}