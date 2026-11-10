import type { ApExam, ApRule, Major, NcssmCourse, Policies, Rule, Univ } from "./types.ts"
import type { CollegeLite } from "./engine/index.ts"
import coursesFile from "../data/ncssm-courses.json"
import rulesFile from "../data/articulation.json"
import apFile from "../data/ap-credit.json"
import examsFile from "../data/ap-exams.json"
import policiesFile from "../data/policies.json"
import indexFile from "../data/majors-index.json"
import summaryFile from "../data/summary.json"

export type MajorEntry = Pick<
  Major,
  "id" | "university" | "name" | "degree" | "concentration" | "college" | "parseStatus" | "isCurrentYear" | "entersViaCoda" | "professionalTrack"
>

export const courses = coursesFile.records as unknown as NcssmCourse[]
export const rules = rulesFile.records as unknown as Rule[]
export const apRules = apFile.records as unknown as ApRule[]
export const exams = examsFile.records as unknown as ApExam[]
export const policies = policiesFile as unknown as Policies
export const majors = indexFile.records as unknown as MajorEntry[]
export const dataAsOf = summaryFile.dataAsOf
export const editions = summaryFile.editions as Record<string, string>

export const UNIVERSITY: Record<Univ, { name: string; short: string }> = {
  unc: { name: "UNC-Chapel Hill", short: "UNC" },
  ncsu: { name: "NC State", short: "NC State" },
}

export async function loadMajor(entry: MajorEntry): Promise<Major> {
  const { files } = entry.university === "unc" ? await import("./majors.unc.ts") : await import("./majors.ncsu.ts")
  const slug = entry.id.slice(entry.university.length + 1)
  return files[`../data/majors/${entry.university}/${slug}.json`].default
}

export async function loadCollege(university: Univ): Promise<CollegeLite> {
  const file =
    university === "unc" ? await import("../data/college-lite.unc.json") : await import("../data/college-lite.ncsu.json")
  return file.default.courses as unknown as CollegeLite
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[month - 1]} ${day}, ${year}`
}
