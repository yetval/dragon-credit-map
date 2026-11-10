import type { Major, Univ } from "./types.ts"
import type { CollegeLite, GradeBand, Profile } from "./engine/index.ts"
import { pickerCourses } from "./engine/index.ts"
import type { NcssmCourse } from "./types.ts"
import type { TranscriptResult } from "./transcript/parse.ts"

export const RESULT_TABS = 4

export const TABS = [
  ["overview", "Overview"],
  ["credits", "Credits"],
  ["major", "Major"],
  ["next", "Next"],
  ["courses", "Courses"],
  ["exams", "AP exams"],
  ["profile", "Profile"],
  ["sources", "Sources"],
  ["privacy", "Privacy"],
] as const

export type Tab = (typeof TABS)[number][0]
export type CoursePick = { status: "completed" | "planned"; grade: GradeBand }
export type ExamPick = { score: number; status: "taken" | "planned" }
export type CourseFilter = "credit" | "all" | "picked" | "past"

export type Reading = {
  status: "idle" | "reading" | "review" | "error"
  text: string
  message: string
  result: TranscriptResult | null
  skip: Set<string>
}

export type State = {
  view: "setup" | "portal"
  setupStep: number
  tab: Tab
  campus: "durham" | "morganton" | null
  year: "junior" | "senior" | null
  university: Univ | null
  majorId: string | null
  track: boolean
  courses: Map<string, CoursePick>
  exams: Map<string, ExamPick>
  courseQuery: string
  courseFilter: CourseFilter
  majorQuery: string
  college: CollegeLite | null
  major: Major | null
  loading: boolean
  failed: boolean
  theme: "light" | "dark"
  showAllNext: boolean
  reading: Reading
  showPolicy: boolean
  confirmRestart: boolean
}

export const UNDECIDED = "undecided"
export const SETUP_STEPS = 3

export const idleReading = (): Reading => ({ status: "idle", text: "", message: "", result: null, skip: new Set() })

export function freshState(theme: "light" | "dark"): State {
  return {
    view: "setup",
    setupStep: 0,
    tab: "overview",
    campus: null,
    year: null,
    university: null,
    majorId: null,
    track: false,
    courses: new Map(),
    exams: new Map(),
    courseQuery: "",
    courseFilter: "credit",
    majorQuery: "",
    college: null,
    major: null,
    loading: false,
    failed: false,
    theme,
    showAllNext: false,
    reading: idleReading(),
    showPolicy: false,
    confirmRestart: false,
  }
}

export function toProfile(state: State, catalog: NcssmCourse[]): Profile | null {
  if (!state.campus || !state.year || !state.university) return null
  const offered = new Set(pickerCourses(catalog, state.campus).current.map((course) => course.code))
  return {
    campus: state.campus,
    year: state.year,
    university: state.university,
    courses: [...state.courses]
      .filter(([code, pick]) => pick.status === "completed" || offered.has(code))
      .map(([code, pick]) =>
        pick.status === "completed" ? { code, status: pick.status, grade: pick.grade } : { code, status: pick.status },
      ),
    exams: [...state.exams].map(([id, pick]) => ({ id, score: pick.score, status: pick.status })),
  }
}

export function canContinue(state: State): boolean {
  if (state.setupStep === 1) return state.campus !== null && state.year !== null
  if (state.setupStep === 2) return state.university !== null && state.majorId !== null
  return true
}
