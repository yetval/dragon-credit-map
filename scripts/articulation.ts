import * as cheerio from "cheerio"
import { get } from "./lib/http.ts"
import { parseCsv } from "./lib/csv.ts"
import { NCSSM_CODE } from "./ncssm-catalog.ts"
import { canonicalCode, subjectOf } from "../src/engine/codes.ts"
import type { Award, CollegeCourse, NcssmCourse, Rule, Univ } from "../src/types.ts"

const SHEETS: Record<Univ, string> = {
  unc: "10g_g1nww1EUNV2AAlHBe7_uotrgXwtXMCiSxIOEhIlM",
  ncsu: "1ItTyQvD15A5SOQp4ZUBNFQq0ZdIqSFS242mYFzljEO0",
}
const sheetUrl = (id: string, path: string) => `https://docs.google.com/spreadsheets/d/${id}/${path}`

const AWARD_TOKEN =
  /(?:([A-Z]{2,4})\s*|(?<=,\s*))(\d{3}[A-Z]?(?![\dA-Za-z])|\d?(?:\s*-){2,4}|[\d*]\*\*|\dGEPU?)/g

export type ParsedCell = {
  codes: string[]
  titles: Record<string, string>
  former: Record<string, string[]>
  flags: string[]
}

export function parseCourseCell(cell: string): ParsedCell {
  const flags: string[] = []
  const former: Record<string, string[]> = {}
  const code = NCSSM_CODE.source
  for (const match of cell.matchAll(new RegExp(`(${code})\\s*\\(formerly\\s+(${code})\\)`, "g"))) {
    former[match[1]] = [...(former[match[1]] ?? []), match[2]]
  }
  let text = cell.replace(/\(formerly[^)]*\)/gi, " ")
  if (new RegExp(`\\(\\s*${code}\\s*\\)`).test(text)) {
    flags.push("parenthetical-code")
    text = text.replace(new RegExp(`\\(\\s*${code}\\s*\\)`, "g"), " ")
  }
  const matches = [...text.matchAll(new RegExp(`(?<![A-Za-z0-9])${code}(?![A-Za-z0-9])`, "g"))]
  const codes: string[] = []
  const titles: Record<string, string> = {}
  matches.forEach((match, index) => {
    const end = matches[index + 1]?.index ?? text.length
    const title = text
      .slice(match.index + match[0].length, end)
      .replace(/\(\*[RM]\*\)/g, " ")
      .replace(/\((online|residential|[^)]*sample[^)]*)\)/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s:\-/&+]+|[\s/&+]+$/g, "")
    if (!codes.includes(match[0])) codes.push(match[0])
    if (title && !titles[match[0]]) titles[match[0]] = title
  })
  return { codes, titles, former, flags }
}

export type ParsedAwards = {
  awards: Pick<Award, "code" | "rawCode" | "generic">[]
  note?: string
  flags: string[]
}

export function parseEquivalency(cell: string): ParsedAwards {
  const flags: string[] = []
  const [first, ...rest] = cell.trim().split(/\r?\n/)
  const awards: ParsedAwards["awards"] = []
  let subject = ""
  for (const match of first.matchAll(AWARD_TOKEN)) {
    subject = match[1] ?? subject
    if (!subject) continue
    const body = match[2].replace(/\s+/g, "")
    const rawCode = match[0].trim()
    if (/^\d{3}[A-Z]?$/.test(body)) {
      awards.push({ code: `${subject} ${body}`, rawCode, generic: null })
      continue
    }
    const digit = /^\d/.exec(body)?.[0]
    const level = digit ? Number(digit) * 100 : null
    const gep = body.includes("GEP")
    const code = gep ? `${subject} ${body}` : body.includes("*") ? `${subject} ${digit ?? "*"}**` : `${subject} ${digit ?? "-"}--`
    awards.push({ code, rawCode, generic: { subject, level, gep } })
    if (/GEPU$/.test(body)) flags.push("suspicious-code")
  }
  const residue = first
    .replace(AWARD_TOKEN, " ")
    .replace(/[/+,&;]|\band\b|\bElective\b/gi, " ")
    .trim()
  if (/[/+,&]\s*$/.test(first.trim())) flags.push("dangling-separator")
  const note = [residue ? first.trim() : "", ...rest.map((line) => line.trim())].filter(Boolean).join(" ")
  if (note) flags.push("free-text-note")
  return note ? { awards, note, flags } : { awards, flags }
}

function gradeOf(cell: string): Rule["minGrade"] {
  if (/B\+/.test(cell)) return "B+"
  if (/B-/.test(cell)) return "B-"
  return null
}

export type ArticulationResult = { rules: Rule[]; pastCourses: NcssmCourse[]; skippedRows: string[] }

export async function scrapeArticulation(
  catalog: NcssmCourse[],
  college: Record<Univ, CollegeCourse[]>,
  aliases: Record<string, string>,
  zeroHourCodes: Set<string>,
): Promise<ArticulationResult> {
  const byCode = new Map<string, NcssmCourse>()
  for (const course of catalog) {
    byCode.set(course.code, course)
    for (const alias of course.aliases) byCode.set(alias, course)
  }
  const past = new Map<string, NcssmCourse>()
  const rules: Rule[] = []
  const skippedRows: string[] = []

  for (const university of ["unc", "ncsu"] as Univ[]) {
    const id = SHEETS[university]
    const overview = await get(sheetUrl(id, "htmlview"))
    const tabs = [...overview.body.matchAll(/items\.push\(\{name: "([^"]*)"/g)].map((match) => match[1])
    if (tabs.length !== 1) {
      throw new Error(
        `The ${university} articulation sheet now has ${tabs.length} tabs (${tabs.join(", ")}). Every tab must be read: update scripts/articulation.ts.`,
      )
    }
    const csv = await get(sheetUrl(id, "export?format=csv&gid=0"))
    const html = await get(sheetUrl(id, "htmlview/sheet?headers=true&gid=0"))
    const $ = cheerio.load(html.body)
    const links = new Map<number, string[]>()
    $("table.waffle tbody tr").each((_, row) => {
      const number = Number($(row).find("th").first().text())
      const urls = $(row)
        .find("td")
        .eq(1)
        .find("a[href]")
        .map((_, anchor) => {
          const href = $(anchor).attr("href") ?? ""
          return href.includes("google.com/url") ? (new URL(href).searchParams.get("q") ?? href) : href
        })
        .get()
      if (number && urls.length) links.set(number, urls)
    })

    const courses = new Map(college[university].map((course) => [course.code, course]))
    const subjects = new Set(college[university].map((course) => subjectOf(course.code)))
    const seen = new Set<string>()
    const ids = new Map<string, number>()
    const rows = parseCsv(csv.body)
    rows.forEach((cells, index) => {
      if (index === 0) return
      const [department = "", course = "", grade = "", equivalency = "", institution = ""] = cells
      const row = index + 1
      if (cells.every((cell) => cell.trim() === "")) return
      const parsed = parseCourseCell(course)
      if (parsed.codes.length === 0) {
        skippedRows.push(`${university} row ${row}: ${cells.filter(Boolean).join(" | ")}`)
        return
      }
      const flags = [...parsed.flags]
      const ncssmCourses: string[] = []
      for (const code of parsed.codes) {
        const known = byCode.get(code)
        const resolved = known?.code ?? code
        if (!ncssmCourses.includes(resolved)) ncssmCourses.push(resolved)
        const formerCodes = parsed.former[code] ?? []
        if (known) {
          for (const alias of formerCodes) if (!known.aliases.includes(alias)) known.aliases.push(alias)
          continue
        }
        if (!flags.includes("course-not-in-catalog")) flags.push("course-not-in-catalog")
        const existing = past.get(code)
        if (existing) {
          if (!existing.sources.some((source) => source.url === csv.source.url)) existing.sources.push(csv.source)
        } else {
          past.set(code, {
            code,
            aliases: formerCodes,
            title: parsed.titles[code] ?? "",
            rawTitle: course,
            department: department.trim(),
            campuses: [],
            tags: [],
            sources: [csv.source],
          })
        }
      }
      const equivalent = parseEquivalency(equivalency)
      flags.push(...equivalent.flags)
      const awards: Award[] = equivalent.awards.map((award) => {
        const subject = canonicalCode(award.code, aliases).split(" ")[0]
        if (!subjects.has(subject) && !flags.includes("subject-unknown")) flags.push("subject-unknown")
        if (award.generic) return { ...award, hours: null, hoursEstimated: true }
        if (zeroHourCodes.has(award.code)) return { ...award, hours: 0, hoursEstimated: false }
        const match = courses.get(canonicalCode(award.code, aliases))
        if (!match) {
          if (!flags.includes("award-code-unresolved")) flags.push("award-code-unresolved")
          return { ...award, hours: null, hoursEstimated: true }
        }
        return { ...award, hours: match.hoursMin, hoursEstimated: match.hoursMin !== match.hoursMax }
      })
      if (awards.length === 0) flags.push("no-award-parsed")
      const minGrade = gradeOf(grade)
      if (!minGrade) flags.push("grade-unstated")
      if (institution.trim() === "") flags.push("institution-blank")
      const signature = `${course.trim()}|${equivalency.trim()}`
      if (seen.has(signature)) flags.push("duplicate-row")
      seen.add(signature)
      const single = ncssmCourses.length === 1 ? byCode.get(ncssmCourses[0]) : undefined
      const sheetDepartment = department.trim().toLowerCase()
      if (single && sheetDepartment && !single.department.toLowerCase().includes(sheetDepartment)) {
        flags.push("department-mismatch")
      }
      const base = `${university}-${ncssmCourses.join("+")}`
      const count = (ids.get(base) ?? 0) + 1
      ids.set(base, count)
      const rule: Rule = {
        id: count === 1 ? base : `${base}-${count}`,
        university,
        ncssmCourses,
        minGrade,
        awards,
        raw: { row, department, course, grade, equivalency, institution },
        syllabusUrls: links.get(row) ?? [],
        flags,
        source: csv.source,
      }
      if (equivalent.note) rule.note = equivalent.note
      rules.push(rule)
    })
  }
  return {
    rules,
    pastCourses: [...past.values()].sort((a, b) => a.code.localeCompare(b.code)),
    skippedRows,
  }
}
