export type Lesson = {
  id: number,
  identifier: string,
  name: string
}

export type Tour = {
  id: number,
  identifier: string,
  name: string,
  lessons: Lesson[]
}