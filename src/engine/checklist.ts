import type { Accepts, Major, Slot } from "../types.ts"
import type { Credit, EngineData, SectionResult, SlotResult } from "./index.ts"
import type { Aliases } from "./credits.ts"
import { canonicalCode, numberOf, subjectOf } from "./codes.ts"

export const isFilled = (slot: SlotResult) => slot.status === "covered" || slot.status === "planned"

function fits(accepts: Accepts, credit: Credit, data: EngineData, aliases: Aliases): boolean {
  if (accepts.genEd) {
    if (credit.generic) return false
    const tags = data.college[credit.code]?.genEd ?? []
    return accepts.genEd === "GEP Elective" ? tags.some((tag) => tag.startsWith("GEP ")) : tags.includes(accepts.genEd)
  }
  if (accepts.subjects.includes("*")) return true
  const subject = credit.generic ? credit.generic.subject : subjectOf(credit.code)
  const level = credit.generic ? credit.generic.level : numberOf(credit.code)
  if (!accepts.subjects.some((accepted) => (aliases[accepted] ?? accepted) === subject)) return false
  if (accepts.except?.some((code) => canonicalCode(code, aliases) === credit.code)) return false
  if (accepts.minLevel !== undefined && (level === null || level < accepts.minLevel)) return false
  return accepts.maxLevel === undefined || (level !== null && level <= accepts.maxLevel)
}

const phaseOf = (slot: Slot) => (slot.kind !== "elective" ? 0 : slot.accepts?.subjects.includes("*") ? 2 : 1)

export function buildChecklist(
  counted: Credit[],
  reachable: Credit[],
  major: Major,
  data: EngineData,
  aliases: Aliases,
): { sections: SectionResult[]; notes: string[] } {
  const unc = major.university === "unc"
  const cap = unc ? data.policies.unc.beLimits.majorCoreCourses : Infinity
  const labeled = major.sections.some((section) => section.core)
  const pool = [...counted].sort((a, b) => Number(a.status === "planned") - Number(b.status === "planned"))
  const used = new Set<Credit>()
  const owned = new Set(counted.filter((credit) => !credit.generic).map((credit) => credit.code))
  const fresh = reachable.filter((credit) => credit.generic || !owned.has(credit.code))
  const reach = new Set(fresh.filter((credit) => !credit.generic).map((credit) => credit.code))
  const canon = (code: string) => canonicalCode(code, aliases)
  const find = (code: string) => {
    const wanted = canon(code)
    return pool.find((credit) => !credit.generic && credit.code === wanted && !used.has(credit))
  }
  const bundle = (option: string[]) => {
    const credits = option.map(find)
    return option.length > 0 && credits.every(Boolean) ? (credits as Credit[]) : null
  }
  const within = (option: string[]) => option.length > 0 && option.every((code) => reach.has(canon(code)) || find(code))
  let coreUsed = 0

  const fill = (slot: Slot, out: SlotResult, core: boolean) => {
    const got: Credit[] = []
    let capped = false
    let have = 0
    let need = 1
    let unit: "courses" | "hours" = "courses"
    let open = false
    const take = (credits: Credit[]) => {
      if (core && coreUsed + credits.length > cap) {
        capped = true
        return false
      }
      for (const credit of credits) used.add(credit)
      if (core) coreUsed += credits.length
      got.push(...credits)
      return true
    }
    if (slot.kind === "course" || slot.kind === "one-of") {
      const options = slot.kind === "course" ? slot.options.slice(0, 1) : slot.options
      const credits = options.map(bundle).find(Boolean)
      if (credits && take(credits)) have = 1
      open = options.some(within)
    } else if (slot.kind === "pick-n") {
      const groups = slot.options.map((_, index) => slot.altGroups?.[index] ?? index)
      const seen = new Set<number>()
      unit = slot.pick?.hours ? "hours" : "courses"
      need = slot.pick?.hours ?? slot.pick?.count ?? new Set(groups).size
      slot.options.forEach((option, index) => {
        if (have >= need || seen.has(groups[index])) return
        const credits = bundle(option)
        if (!credits || !take(credits)) return
        seen.add(groups[index])
        have += unit === "hours" ? credits.reduce((sum, credit) => sum + credit.hours, 0) : 1
      })
      const wild = (credit: Credit) =>
        !credit.generic && (slot.wildcards ?? []).some((wildcard) => fits(wildcard, credit, data, aliases))
      for (const credit of pool) {
        if (have >= need) break
        if (used.has(credit) || credit.hours === 0 || !wild(credit) || !take([credit])) continue
        have += unit === "hours" ? credit.hours : 1
      }
      open = slot.options.some((option, index) => !seen.has(groups[index]) && within(option)) || fresh.some(wild)
      out.progress = { have, need, unit }
      if (!slot.pick) out.note = "The catalog does not say how many of these to take."
    } else if (slot.kind === "elective" && slot.accepts) {
      const accepts = slot.accepts
      unit = "hours"
      need = slot.hours?.min ?? 3
      for (const credit of pool) {
        if (have >= need) break
        if (used.has(credit) || credit.hours === 0 || !fits(accepts, credit, data, aliases)) continue
        if (!take([credit])) break
        have += credit.hours
      }
      open = fresh.some((credit) => fits(accepts, credit, data, aliases))
      out.progress = { have, need, unit }
    }
    const filled = need > 0 && have >= need
    out.filledBy = got.map((credit) => credit.code)
    if (filled) out.status = got.every((credit) => credit.status === "earned") ? "covered" : "planned"
    else out.status = open ? "open" : "college"
    if (capped && !filled) {
      out.note = `You have credit that fits here, but UNC counts at most ${cap} credit-by-exam courses in the major core.`
    }
  }

  const sections: SectionResult[] = major.sections.map((section) => ({
    title: section.title,
    core: section.core,
    slots: section.slots.map((slot) => ({
      id: slot.id,
      kind: slot.kind,
      label: slot.label,
      status: "college",
      filledBy: [],
      progress: null,
      note: "",
    })),
  }))
  for (const phase of [0, 1, 2]) {
    major.sections.forEach((section, s) =>
      section.slots.forEach((slot, i) => {
        if (phaseOf(slot) === phase) fill(slot, sections[s].slots[i], unc && (!labeled || section.core))
      }),
    )
  }

  const notes: string[] = []
  if (unc) {
    notes.push(
      `UNC counts at most ${cap} credit-by-exam courses in the major core. It is not confirmed that this limit also covers NCSSM course credit, so this page applies it to AP and NCSSM credit together.`,
    )
    if (!labeled) notes.push("This major's page does not label its core, so the limit is applied to every section.")
    notes.push(data.policies.unc.halfCoreAtUnc.quote)
  }
  if (major.university === "ncsu" && major.entersViaCoda) {
    notes.push("At NC State, engineering majors enter the major through CODA (Change of Degree Audit).")
  }
  return { sections, notes }
}
