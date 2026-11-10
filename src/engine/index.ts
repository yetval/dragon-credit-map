import type { ApExam, ApRule, Generic, Major, NcssmCourse, Policies, Rule, Slot, Univ } from "../types.ts"
import { buildChecklist, isFilled } from "./checklist.ts"
import {
  apRows,
  countedCredits,
  coursesToTake,
  exclusions,
  heldCourses,
  ncssmRows,
  prefixAliases,
  reachableCredits,
  resolver,
  ruleGroups,
  winners,
} from "./credits.ts"

export type GradeBand = "B+" | "B" | "below"

export type Profile = {
  campus: "durham" | "morganton"
  year: "junior" | "senior"
  university: Univ
  courses: { code: string; status: "completed" | "planned"; grade?: GradeBand }[]
  exams: { id: string; score: number; status: "taken" | "planned" }[]
}

export type CollegeLite = Record<
  string,
  { title: string; hours: number; hoursMax: number; genEd: string[]; noCreditWith?: string[] }
>

export type EngineData = {
  courses: NcssmCourse[]
  rules: Rule[]
  apRules: ApRule[]
  exams: ApExam[]
  policies: Policies
  college: CollegeLite
  major: Major | null
}

export type Credit = {
  code: string
  title: string
  generic: Generic | null
  hours: number
  hoursEstimated: boolean
  status: "earned" | "planned"
  counted: boolean
  reason: string
}

export type MappingRow = {
  id: string
  kind: "ncssm" | "ap"
  ruleIds: string[]
  sources: string[]
  label: string
  outcome: "earned" | "planned" | "blocked" | "replaced" | "placement"
  credits: Credit[]
  hours: number
  reason: string
}

export type Duplicate = { code: string; from: string; keptFrom: string; reason: string }

export type SlotStatus = "covered" | "planned" | "open" | "college"

export type SlotResult = {
  id: string
  kind: Slot["kind"]
  label: string
  status: SlotStatus
  filledBy: string[]
  progress: { have: number; need: number; unit: "courses" | "hours" } | null
  note: string
}

export type SectionResult = { title: string; core: boolean; slots: SlotResult[] }

export type Totals = {
  total: number
  earned: number
  planned: number
  specific: number
  generic: number
  estimated: boolean
}

export type Result = {
  totals: Totals
  mapping: MappingRow[]
  duplicates: Duplicate[]
  checklist: SectionResult[]
  needsReview: boolean
  notes: string[]
}

export type Recommendation = {
  kind: "course" | "exam"
  add: string[]
  label: string
  minScore: number | null
  yields: { code: string; hours: number }[]
  hoursGained: number
  fills: { slotId: string; section: string; label: string }[]
  text: string
}

export function pickerCourses(
  courses: NcssmCourse[],
  campus: "durham" | "morganton",
): { current: NcssmCourse[]; past: NcssmCourse[] } {
  return {
    current: courses.filter((course) => course.campuses.includes(campus) || course.campuses.includes("online")),
    past: courses.filter((course) => course.campuses.length === 0),
  }
}

const sum = (credits: Credit[]) => credits.reduce((total, credit) => total + credit.hours, 0)

function prepare(profile: Profile, data: EngineData) {
  const resolve = resolver(data.courses)
  return {
    aliases: prefixAliases(profile, data),
    resolve,
    groups: ruleGroups(profile, data, resolve),
    titles: new Map(pickerCourses(data.courses, profile.campus).current.map((course) => [course.code, course.title])),
  }
}

export function evaluate(profile: Profile, data: EngineData): Result {
  return run(profile, data, prepare(profile, data))
}

function run(profile: Profile, data: EngineData, { aliases, resolve, groups, titles }: ReturnType<typeof prepare>): Result {
  const held = heldCourses(profile, resolve)
  const ap = apRows(profile, data, aliases)
  const rows = [...ap.rows, ...ncssmRows(groups, held, data, aliases)]
  const major = data.major
  const current = new Set(titles.keys())
  const reachable = major ? reachableCredits(profile, data, groups, held, current, aliases) : []
  const checklist = (list: MappingRow[]) =>
    major ? buildChecklist(countedCredits(list, data), reachable, major, data, aliases) : { sections: [], notes: [] }
  const filledCount = (list: MappingRow[]) =>
    checklist(list).sections.reduce((count, section) => count + section.slots.filter(isFilled).length, 0)

  for (const row of rows) {
    if (!ap.choices.has(row)) continue
    const options = row.credits
    const others = rows.filter((other) => other !== row && !ap.choices.has(other))
    ap.choices.delete(row)
    const base = filledCount(others)
    const useful = major && options.find((option) => filledCount([...others, { ...row, credits: [option] }]) > base)
    const pick = useful || options.reduce((a, b) => (b.hours < a.hours ? b : a))
    row.credits = [pick]
    row.reason = `You get one of ${options.map((option) => option.code).join(" or ")}. Counting ${pick.code} because it ${useful ? "fills a requirement in your major" : "has the fewest hours"}.`
  }

  const best = winners(rows)
  const barred = exclusions(best, data)
  const school = profile.university === "unc" ? "UNC" : "NC State"
  const duplicates: Duplicate[] = []
  for (const row of rows) {
    if (row.outcome !== "earned" && row.outcome !== "planned") continue
    for (const credit of row.credits) {
      const kept = credit.generic ? undefined : best.get(credit.code)
      const rival = barred.get(credit)
      if (rival) {
        credit.reason = `${school} does not give credit for both ${rival} and ${credit.code}.`
        continue
      }
      if (!kept || kept.credit === credit) {
        credit.counted = true
        row.hours += credit.hours
        continue
      }
      credit.reason = `You already get ${credit.code} from ${kept.row.label}, so this adds no extra credit.`
      duplicates.push({ code: credit.code, from: row.label, keptFrom: kept.row.label, reason: credit.reason })
    }
  }

  const counted = countedCredits(rows, data)
  const { sections, notes } = checklist(rows)
  if (profile.university === "unc") {
    const limit = data.policies.unc.beLimits.focusCapacityCourses
    const tagged = counted.filter((credit) => data.college[credit.code]?.genEd.some((tag) => tag.startsWith("FC-")))
    if (tagged.length > limit) {
      notes.push(
        `${tagged.length} of your credits carry Focus Capacity tags. UNC lets at most ${limit} credit-by-exam courses count toward Focus Capacities.`,
      )
    }
  }
  return {
    totals: {
      total: sum(counted),
      earned: sum(counted.filter((credit) => credit.status === "earned")),
      planned: sum(counted.filter((credit) => credit.status === "planned")),
      specific: sum(counted.filter((credit) => !credit.generic)),
      generic: sum(counted.filter((credit) => credit.generic)),
      estimated: counted.some((credit) => credit.hoursEstimated),
    },
    mapping: rows,
    duplicates,
    checklist: sections,
    needsReview: major?.parseStatus === "needs-review",
    notes,
  }
}

const countedOf = (result: Result) => result.mapping.flatMap((row) => row.credits.filter((credit) => credit.counted))

const signature = (result: Result) =>
  countedOf(result)
    .map((credit) => `${credit.code}:${credit.hours}`)
    .sort()
    .join(",")

export function recommend(profile: Profile, data: EngineData): Recommendation[] {
  const prepared = prepare(profile, data)
  const { groups, titles } = prepared
  const base = run(profile, data, prepared)
  const baseFilled = new Set(base.checklist.flatMap((section) => section.slots.filter(isFilled).map((slot) => slot.id)))
  const held = heldCourses(profile, prepared.resolve)
  const current = new Set(titles.keys())

  const measure = (next: Profile) => {
    const result = run(next, data, prepared)
    const left = countedOf(base).map((credit) => credit.code)
    const yields = countedOf(result)
      .filter((credit) => {
        const index = left.indexOf(credit.code)
        if (index >= 0) left.splice(index, 1)
        return index < 0
      })
      .map((credit) => ({ code: credit.code, hours: credit.hours }))
    const fills = result.checklist.flatMap((section) =>
      section.slots
        .filter((slot) => isFilled(slot) && !baseFilled.has(slot.id))
        .map((slot) => ({ slotId: slot.id, section: section.title, label: slot.label })),
    )
    return { result, yields, fills, hoursGained: result.totals.total - base.totals.total }
  }
  const describe = (what: string, gain: ReturnType<typeof measure>) => {
    const credit = gain.yields.map((item) => `${item.code} (${item.hours} hours)`).join(", ")
    const fills = gain.fills.map((fill) => fill.label).join("; ")
    return [
      `${what}.`,
      credit ? `You would get ${credit}.` : "",
      fills ? `It fills ${gain.fills.length === 1 ? "1 major requirement" : `${gain.fills.length} major requirements`}: ${fills}.` : "",
    ]
      .filter(Boolean)
      .join(" ")
  }

  const additions = new Map<string, string[]>()
  for (const group of groups) {
    const missing = coursesToTake(group, held, current)
    if (missing.length > 0) additions.set([...missing].sort().join("+"), missing)
  }

  const found: Recommendation[] = []
  for (const add of additions.values()) {
    const planned = add.map((code) => ({ code, status: "planned" as const }))
    const gain = measure({ ...profile, courses: [...profile.courses, ...planned] })
    if (gain.fills.length === 0 && gain.hoursGained <= 0) continue
    const label = add.map((code) => `${code} ${titles.get(code)}`.trim()).join(" + ")
    found.push({
      kind: "course",
      add,
      label,
      minScore: null,
      yields: gain.yields,
      hoursGained: gain.hoursGained,
      fills: gain.fills,
      text: describe(`Take ${label}`, gain),
    })
  }
  for (const exam of data.exams) {
    if (exam.group !== "exam" || profile.exams.some((taken) => taken.id === exam.id)) continue
    const at = (score: number) =>
      measure({ ...profile, exams: [...profile.exams, { id: exam.id, score, status: "planned" }] })
    const gain = at(5)
    if (gain.fills.length === 0 && gain.hoursGained <= 0) continue
    const minScore = [1, 2, 3, 4, 5].find((score) => signature(at(score).result) === signature(gain.result))!
    const label = `AP ${exam.name} exam`
    found.push({
      kind: "exam",
      add: [exam.id],
      label,
      minScore,
      yields: gain.yields,
      hoursGained: gain.hoursGained,
      fills: gain.fills,
      text: describe(`Take the ${label} and score ${minScore === 5 ? "a 5" : `${minScore} or higher`}`, gain),
    })
  }
  return found.sort(
    (a, b) => b.fills.length - a.fills.length || b.hoursGained / b.add.length - a.hoursGained / a.add.length,
  )
}
