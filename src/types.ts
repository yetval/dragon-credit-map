export type Source = { url: string; fetchedAt: string }
export type Univ = "unc" | "ncsu"
export type Campus = "durham" | "morganton" | "online"
export type CourseTag = "research" | "math-intensive"

export type NcssmCourse = {
  code: string
  aliases: string[]
  title: string
  rawTitle: string
  department: string
  subject?: string
  credits?: string
  campuses: Campus[]
  tags: CourseTag[]
  sources: Source[]
}

export type Generic = { subject: string; level: number | null; gep: boolean }

export type Award = {
  code: string
  rawCode: string
  generic: Generic | null
  hours: number | null
  hoursEstimated: boolean
}

export type Rule = {
  id: string
  university: Univ
  ncssmCourses: string[]
  minGrade: "B-" | "B+" | null
  awards: Award[]
  raw: {
    row: number
    department: string
    course: string
    grade: string
    equivalency: string
    institution: string
  }
  syllabusUrls: string[]
  flags: string[]
  note?: string
  source: Source
}

export type ApRule = {
  id: string
  university: Univ
  exams: string[]
  examMode: "all" | "any"
  rawExam: string
  minScore: number
  awards: Award[]
  rawCredit: string
  rawHours: string
  awardMode: "all" | "one-of"
  placementOnly: boolean
  flags: string[]
  note?: string
  source: Source
}

export type ApExam = { id: string; name: string; group: "exam" | "subscore" | "retired" }

export type CollegeCourse = {
  code: string
  title: string
  hoursMin: number
  hoursMax: number
  genEd: string[]
  sameAs: string[]
  noCreditWith?: string[]
  source: Source
}

export type HoursRange = { min: number; max: number }

export type Accepts = { subjects: string[]; minLevel?: number; maxLevel?: number; except?: string[]; genEd?: string }

export type Wildcard = { subjects: string[]; minLevel?: number; maxLevel?: number; except?: string[] }

export type Slot = {
  id: string
  kind: "course" | "one-of" | "pick-n" | "elective" | "text"
  label: string
  options: string[][]
  altGroups?: number[]
  wildcards?: Wildcard[]
  pick?: { count?: number; hours?: number }
  accepts?: Accepts
  hours: HoursRange | null
  hoursEstimated: boolean
  raw: string
}

export type Section = { title: string; core: boolean; slots: Slot[] }

export type Major = {
  id: string
  university: Univ
  name: string
  degree: string
  concentration?: string
  college?: string
  url: string
  catalogYear: string
  isCurrentYear: boolean
  layout: "courselist" | "plangrid"
  totalHours: HoursRange | null
  sections: Section[]
  parseStatus: "verified" | "needs-review"
  parseIssues: string[]
  parseNotes: string[]
  entersViaCoda: boolean
  professionalTrack: boolean
  source: Source
}

export type Quote = { quote: string; source: Source }

export type Policies = {
  unc: {
    beLimits: Quote & { majorCoreCourses: number; focusCapacityCourses: number }
    halfCoreAtUnc: Quote
    focusCapacities: Quote
  }
  ncsu: {
    prefixAliases: Record<string, string>
    prefixEvidence: Source[]
    coda: Quote & { successCourses: string[] }
  }
  ncssm: {
    markers: { research: string; mathIntensive: string; source: Source }
  }
}

export type ManifestEntry = {
  id: string
  url: string
  fetchedAt: string
  sha256: string
}

export type Manifest = {
  schemaVersion: number
  dataAsOf: string
  editions: Record<string, string>
  counts: Record<string, number>
  sources: ManifestEntry[]
}

export type DataFile<T> = { schemaVersion: number; records: T[] }
