import type { Detours } from "../../../types/Detour";
import { useCustomQuery } from "./useCustomQuery";

export const useDetours = () =>
  useCustomQuery<Detours>({
    queryKey: ["detours"],
    queryUrl: "https://git-mastery.org/lessons/detours.json",
  });
