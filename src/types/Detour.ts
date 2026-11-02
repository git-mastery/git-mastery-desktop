import type { Lesson } from "./Tour";

export type Detours = {
  [detourKey: string]: Detour;
};

export type Detour = {
  lesson: Lesson;
  title: string;
};
