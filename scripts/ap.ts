import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"
import { get } from "./lib/http.ts"
import { clean } from "./college-courses.ts"
import { COMBINED, EXAMS, TYPO_ALIASES } from "./ap-exams.ts"
import { canonicalCode } from "../src/engine/codes.ts"
import type { ApExam, ApRule, Award, CollegeCourse, Univ } from "../src/types.ts"

const PAGES: Record<Univ, { url: string; table: string }> = {
  unc: { url: "https://catalog.unc.edu/policies-procedures/credit-evaluation/", table: "table.sc_sctable" },
  ncsu: { url: "https://admissions.ncsu.edu/apply/credit-opportunities/advanced-placement-ap/", table: "table" },
}

const SPECIFIC = /([A-Z]{2,4}) (\d{3}[A-Z]?)(?![\dA-Za-z])/g
const GENERIC = /([A-Z][A-Za-z ]*?) (?:General Elective|(\d)00-level (GEP|elective))/g

type Draft = Pick<Award, "code" | "rawCode" | "generic">

export function parseCredit(cell: string): { awards: Draft[]; note?: string; oneOf: boolean; lab: boolean } {
  const [credit, placement] = cell.replace(/\s*\*\s*$/, "").split(/,?\s*(?:and )?placement into /)
  const awards: Draft[] = []
  for (const match of credit.matchAll(GENERIC)) {
    const name = match[1].trim()
    const subject = /^[A-Z]{2,4}$/.test(name) ? name : ""
    const level = match[2] ? Number(match[2]) * 100 : null
    const gep = match[3] === "GEP"
    const code = !subject || !match[2] ? match[0] : gep ? `${subject} ${match[2]}GEP` : `${subject} ${match[2]}**`
    awards.push({ code, rawCode: match[0], generic: { subject, level, gep } })
  }
  for (const match of credit.replace(GENERIC, " ").matchAll(SPECIFIC)) {
    const code = `${match[1]} ${match[2]}`
    if (!awards.some((award) => award.code === code)) awards.push({ code, rawCode: match[0], generic: null })
  }
  const result = { awards, oneOf: /\bor\b/.test(credit), lab: /\bLab\b/.test(credit) }
  return placement ? { ...result, note: `Placement into ${placement.trim()}` } : result
}

export function footnoteOf($: cheerio.CheerioAPI, table: cheerio.Cheerio<AnyNode>): string {
  const marked = table.next("dl.sc_footnotes").find("dt").filter((_, dt) => clean($(dt).text()) === "*")
  return clean(
    marked.length > 0
      ? marked.first().next("dd").text()
      : table.nextAll("p").filter((_, p) => $(p).text().trim().startsWith("*")).first().text(),
  )
}

export type ApResult = { rules: ApRule[]; exams: ApExam[]; zeroHourCodes: Set<string> }

export async function scrapeAp(
  college: Record<Univ, CollegeCourse[]>,
  aliases: Record<string, string>,
): Promise<ApResult> {
  const examByAlias = new Map<string, string>()
  for (const exam of EXAMS) for (const alias of exam.aliases) examByAlias.set(alias, exam.id)
  const rules: ApRule[] = []
  const zeroHourCodes = new Set<string>()

  for (const university of ["unc", "ncsu"] as Univ[]) {
    const page = await get(PAGES[university].url)
    const $ = cheerio.load(page.body)
    const table = $(PAGES[university].table).first()
    const footnote = footnoteOf($, table)
    const rows = table
      .find("tr")
      .map((_, row) => [$(row).find("td,th").map((_, cell) => clean($(cell).text())).get()])
      .get()
      .filter((cells) => cells.length >= 4 && /^\d$/.test(cells[1]))
    if (rows.length === 0) throw new Error(`No AP rows found at ${page.url}`)
    const courses = new Map(college[university].map((course) => [course.code, course]))

    for (const cells of rows) {
      if (Number(cells[3]) === 0) for (const draft of parseCredit(cells[2]).awards) zeroHourCodes.add(draft.code)
    }
    const drafts = rows.map((cells) => ({ cells, parsed: parseCredit(cells[2]) }))
    const electiveSubject = new Map<string, string>()
    for (const { cells, parsed } of drafts) {
      const specific = parsed.awards.find((award) => !award.generic)
      if (!specific) continue
      for (const other of drafts) {
        if (other.cells[0] !== cells[0]) continue
        for (const award of other.parsed.awards) {
          if (award.generic && !award.generic.subject) electiveSubject.set(award.rawCode, specific.code.split(" ")[0])
        }
      }
    }

    const counts = new Map<string, number>()
    for (const { cells, parsed } of drafts) {
      const [rawExam, score, rawCredit, rawHours] = cells
      const combined = COMBINED[rawExam]
      const examId = examByAlias.get(rawExam)
      if (!combined && !examId) {
        throw new Error(`Unknown AP exam name "${rawExam}" at ${page.url}. Add it to scripts/ap-exams.ts.`)
      }
      const flags: string[] = []
      if (TYPO_ALIASES.has(rawExam)) flags.push("typo-suspect")
      if (parsed.lab) flags.push("lab-listed-separately")
      if (/\*\s*$/.test(rawCredit)) flags.push("see-footnote")
      const total = /^\d+(\.\d+)?$/.test(rawHours) ? Number(rawHours) : null
      if (total === null) flags.push("hours-not-a-number")
      const awards: Award[] = parsed.awards.map((draft) => {
        if (draft.generic) {
          const subject = draft.generic.subject || electiveSubject.get(draft.rawCode) || ""
          return { ...draft, generic: { ...draft.generic, subject }, hours: null, hoursEstimated: true }
        }
        if (zeroHourCodes.has(draft.code)) return { ...draft, hours: 0, hoursEstimated: false }
        const match = courses.get(canonicalCode(draft.code, aliases))
        if (!match) {
          if (!flags.includes("award-code-unresolved")) flags.push("award-code-unresolved")
          return { ...draft, hours: null, hoursEstimated: true }
        }
        return { ...draft, hours: match.hoursMin, hoursEstimated: match.hoursMin !== match.hoursMax }
      })
      const unknown = awards.filter((award) => award.hours === null)
      const known = awards.reduce((sum, award) => sum + (award.hours ?? 0), 0)
      if (total !== null && !parsed.oneOf) {
        const share = (total - known) / unknown.length
        if (unknown.length > 0 && share >= 0 && Number.isInteger(share)) {
          for (const award of unknown) {
            award.hours = share
            award.hoursEstimated = unknown.length > 1
          }
        } else if (known !== total) {
          flags.push("hours-mismatch")
        }
      }
      const exams = combined?.exams ?? [examId!]
      const key = `${university}-${exams.join("+")}-${combined?.mode ?? "all"}-${score}`
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      const rule: ApRule = {
        id: count === 1 ? key : `${key}-${count}`,
        university,
        exams,
        examMode: combined?.mode ?? "all",
        rawExam,
        minScore: Number(score),
        awards,
        rawCredit,
        rawHours,
        awardMode: parsed.oneOf ? "one-of" : "all",
        placementOnly: total === 0,
        flags,
        source: page.source,
      }
      const notes = [parsed.note, flags.includes("see-footnote") ? footnote : ""].filter(Boolean)
      if (notes.length) rule.note = notes.join(" ")
      rules.push(rule)
    }
  }
  const used = new Set(rules.flatMap((rule) => rule.exams))
  const exams = EXAMS.filter((exam) => used.has(exam.id)).map(({ id, name, group }) => ({ id, name, group }))
  return { rules, exams, zeroHourCodes }
}
