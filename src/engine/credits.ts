import type { ApRule, Award, NcssmCourse, Rule } from "../types.ts"
import type { Credit, EngineData, GradeBand, MappingRow, Profile } from "./index.ts"
import { canonicalCode } from "./codes.ts"

export type Aliases = Record<string, string>
export type Held = { status: "completed" | "planned"; grade?: GradeBand }
export type Group = { codes: string[]; rules: Rule[] }
type Floor = "B-" | "B+"

export function prefixAliases(profile: Profile, data: EngineData): Aliases {
  return profile.university === "ncsu" ? data.policies.ncsu.prefixAliases : {}
}

export function resolver(courses: NcssmCourse[]): (code: string) => string {
  const known = new Map<string, string>()
  for (const course of courses) for (const alias of course.aliases) known.set(alias, course.code)
  for (const course of courses) known.set(course.code, course.code)
  return (code) => known.get(code) ?? code
}

export function heldCourses(profile: Profile, resolve: (code: string) => string): Map<string, Held> {
  const held = new Map<string, Held>()
  for (const course of profile.courses) {
    const code = resolve(course.code)
    if (held.get(code)?.status !== "completed") held.set(code, { status: course.status, grade: course.grade })
  }
  return held
}

export function ruleGroups(profile: Profile, data: EngineData, resolve: (code: string) => string): Group[] {
  const byKey = new Map<string, Group>()
  for (const rule of data.rules) {
    if (rule.university !== profile.university || rule.ncssmCourses.length === 0) continue
    const codes = [...new Set(rule.ncssmCourses.map(resolve))]
    const key = [...codes].sort().join("+")
    const group = byKey.get(key)
    if (group) group.rules.push(rule)
    else byKey.set(key, { codes, rules: [rule] })
  }
  const groups = [...byKey.values()]
  for (const group of groups) group.rules.sort((a, b) => a.raw.row - b.raw.row)
  return groups.sort((a, b) => b.codes.length - a.codes.length || a.rules[0].raw.row - b.rules[0].raw.row)
}

export function toCredit(award: Award, status: Credit["status"], data: EngineData, aliases: Aliases): Credit {
  const code = canonicalCode(award.code, aliases)
  const known = award.generic ? undefined : data.college[code]
  const subject = award.generic?.subject ?? ""
  return {
    code,
    title: known?.title ?? "",
    generic: award.generic && { ...award.generic, subject: aliases[subject] ?? subject },
    hours: award.hours ?? known?.hours ?? 3,
    hoursEstimated: award.hours !== null ? award.hoursEstimated : known ? known.hours !== known.hoursMax : true,
    status,
    counted: false,
    reason: "",
  }
}

function union(rules: Rule[], aliases: Aliases): Award[] {
  const awards: Award[] = []
  for (const rule of rules) {
    const seen = new Set(awards.map((award) => canonicalCode(award.code, aliases)))
    awards.push(...rule.awards.filter((award) => !seen.has(canonicalCode(award.code, aliases))))
  }
  return awards
}

const floorOf = (rule: Rule): Floor => rule.minGrade ?? "B-"

const passes = (course: Held, floor: Floor) =>
  course.status === "planned" || !course.grade || course.grade === "B+" || (course.grade === "B" && floor === "B-")

export function ncssmRows(groups: Group[], held: Map<string, Held>, data: EngineData, aliases: Aliases): MappingRow[] {
  const consumed = new Map<string, string>()
  const rows: MappingRow[] = []
  for (const group of groups) {
    if (!group.codes.every((code) => held.has(code))) continue
    const label = group.codes.join(" + ")
    const status = group.codes.every((code) => held.get(code)!.status === "completed") ? "earned" : "planned"
    const row = (rules: Rule[], outcome: MappingRow["outcome"], reason: string): MappingRow => ({
      id: rules.map((rule) => rule.id).join("+"),
      kind: "ncssm",
      ruleIds: rules.map((rule) => rule.id),
      sources: group.codes,
      label,
      outcome,
      credits: union(rules, aliases).map((award) => toCredit(award, status, data, aliases)),
      hours: 0,
      reason,
    })
    const taker = group.codes.map((code) => consumed.get(code)).find(Boolean)
    if (taker) {
      rows.push(row(group.rules, "replaced", `Counted as part of the ${taker} combination instead.`))
      continue
    }
    const failing = (rule: Rule) => group.codes.filter((code) => !passes(held.get(code)!, floorOf(rule)))
    const pass = group.rules.filter((rule) => failing(rule).length === 0)
    const fail = group.rules.filter((rule) => failing(rule).length > 0)
    if (pass.length > 0) {
      rows.push(row(pass, status, pass.find((rule) => rule.note)?.note ?? ""))
      for (const code of group.codes) consumed.set(code, label)
    }
    if (fail.length > 0) {
      const lowest = fail.find((rule) => floorOf(rule) === "B-") ?? fail[0]
      rows.push(row(fail, "blocked", `Needs a ${floorOf(lowest)} or higher in ${failing(lowest).join(" and ")}`))
    }
  }
  return rows
}

type Scores = Map<string, { score: number; taken: boolean }>

function examScores(profile: Profile): Scores {
  const scores: Scores = new Map()
  for (const exam of profile.exams) {
    if ((scores.get(exam.id)?.score ?? 0) < exam.score) {
      scores.set(exam.id, { score: exam.score, taken: exam.status === "taken" })
    }
  }
  return scores
}

const passing = (rule: ApRule, scores: Scores) =>
  rule.exams.filter((id) => (scores.get(id)?.score ?? 0) >= rule.minScore)

const meets = (rule: ApRule, scores: Scores) =>
  rule.examMode === "all" ? passing(rule, scores).length === rule.exams.length : passing(rule, scores).length > 0

export function apRows(
  profile: Profile,
  data: EngineData,
  aliases: Aliases,
): { rows: MappingRow[]; choices: Set<MappingRow> } {
  const scores = examScores(profile)
  const name = (id: string) => `AP ${data.exams.find((exam) => exam.id === id)?.name ?? id}`
  const tiers = new Map<string, ApRule[]>()
  for (const rule of data.apRules) {
    if (rule.university !== profile.university || rule.exams.length === 0) continue
    const key = `${rule.exams.join("+")}|${rule.examMode}`
    tiers.set(key, [...(tiers.get(key) ?? []), rule])
  }
  const groups = [...tiers.values()].map((list) => {
    const met = list.filter((rule) => meets(rule, scores))
    const top = Math.max(...met.map((rule) => rule.minScore))
    return {
      lowest: list.reduce((a, b) => (b.minScore < a.minScore ? b : a)),
      fired: met.filter((rule) => rule.minScore === top),
    }
  })
  const examSet = (rule: ApRule) => [...rule.exams].sort().join("+")
  const both = new Set(
    groups
      .filter((group) => group.fired.length > 0 && group.lowest.examMode === "all" && group.lowest.exams.length > 1)
      .map((group) => examSet(group.lowest)),
  )
  const rows: MappingRow[] = []
  const choices = new Set<MappingRow>()
  for (const { lowest, fired } of groups) {
    const { exams, examMode } = lowest
    if (fired.length === 0) {
      const have = exams.filter((id) => scores.has(id)).length
      if (examMode === "all" ? have < exams.length : have === 0) continue
      const label = exams.map(name).join(examMode === "all" ? " and " : " or ")
      rows.push({
        id: lowest.id,
        kind: "ap",
        ruleIds: [lowest.id],
        sources: exams,
        label,
        outcome: "blocked",
        credits: lowest.awards.map((award) => toCredit(award, "planned", data, aliases)),
        hours: 0,
        reason: `Needs a ${lowest.minScore} or higher on ${label}`,
      })
      continue
    }
    if (examMode === "any" && both.has(examSet(lowest))) continue
    for (const rule of fired) {
      const ok = passing(rule, scores)
      const used = examMode === "all" ? ok : [ok.find((id) => scores.get(id)!.taken) ?? ok[0]]
      const status = used.every((id) => scores.get(id)!.taken) ? "earned" : "planned"
      const credits = rule.awards.map((award) => toCredit(award, status, data, aliases))
      const row: MappingRow = {
        id: rule.id,
        kind: "ap",
        ruleIds: [rule.id],
        sources: used,
        label: used.map(name).join(" and "),
        outcome: rule.placementOnly ? "placement" : status,
        credits: rule.placementOnly ? credits.map((credit) => ({ ...credit, hours: 0, hoursEstimated: false })) : credits,
        hours: 0,
        reason: rule.note ?? (rule.placementOnly ? "Placement only. This gives no credit hours." : ""),
      }
      if (!rule.placementOnly && rule.awardMode === "one-of" && credits.length > 1) choices.add(row)
      rows.push(row)
    }
  }
  return { rows, choices }
}

const fired = (row: MappingRow) => row.outcome === "earned" || row.outcome === "planned"

export function winners(rows: MappingRow[]): Map<string, { credit: Credit; row: MappingRow }> {
  const best = new Map<string, { credit: Credit; row: MappingRow }>()
  for (const row of rows) {
    if (!fired(row)) continue
    for (const credit of row.credits) {
      if (credit.generic) continue
      const kept = best.get(credit.code)
      if (!kept || (kept.credit.status === "planned" && credit.status === "earned")) best.set(credit.code, { credit, row })
    }
  }
  return best
}

export function exclusions(best: Map<string, { credit: Credit; row: MappingRow }>, data: EngineData): Map<Credit, string> {
  const clash = (a: string, b: string) =>
    Boolean(data.college[a]?.noCreditWith?.includes(b) || data.college[b]?.noCreditWith?.includes(a))
  const listed = new Set((data.major?.sections ?? []).flatMap((section) => section.slots.flatMap((slot) => slot.options.flat())))
  const order = [...best.values()].map((item) => item.credit)
  order.sort(
    (a, b) =>
      Number(a.status === "planned") - Number(b.status === "planned") || Number(!listed.has(a.code)) - Number(!listed.has(b.code)),
  )
  const kept: Credit[] = []
  const barred = new Map<Credit, string>()
  for (const credit of order) {
    const rival = kept.find((other) => clash(other.code, credit.code))
    if (rival) barred.set(credit, rival.code)
    else kept.push(credit)
  }
  return barred
}

export function countedCredits(rows: MappingRow[], data: EngineData): Credit[] {
  const best = winners(rows)
  const barred = exclusions(best, data)
  return rows
    .filter(fired)
    .flatMap((row) =>
      row.credits.filter((credit) => credit.generic || (best.get(credit.code)!.credit === credit && !barred.has(credit))),
    )
}

export function coursesToTake(group: Group, held: Map<string, Held>, current: Set<string>): string[] {
  const missing = group.codes.filter((code) => !held.has(code))
  return missing.every((code) => current.has(code)) ? missing : []
}

export function reachableCredits(
  profile: Profile,
  data: EngineData,
  groups: Group[],
  held: Map<string, Held>,
  current: Set<string>,
  aliases: Aliases,
): Credit[] {
  const scores = examScores(profile)
  const retired = new Set(data.exams.filter((exam) => exam.group === "retired").map((exam) => exam.id))
  const fromCourses = groups
    .filter((group) => coursesToTake(group, held, current).length > 0)
    .flatMap((group) => group.rules.flatMap((rule) => rule.awards))
  const fromExams = data.apRules
    .filter((rule) => rule.university === profile.university && !rule.placementOnly && !meets(rule, scores))
    .filter((rule) => !rule.exams.some((id) => retired.has(id)))
    .flatMap((rule) => rule.awards)
  return [...fromCourses, ...fromExams].map((award) => toCredit(award, "planned", data, aliases))
}
