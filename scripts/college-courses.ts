import * as cheerio from "cheerio"
import { get } from "./lib/http.ts"
import type { CollegeCourse, Source, Univ } from "../src/types.ts"

const SITES: Record<Univ, { index: string; link: RegExp; origin: string }> = {
  unc: {
    index: "https://catalog.unc.edu/courses/",
    link: /^\/courses\/[a-z0-9-]+\/$/,
    origin: "https://catalog.unc.edu",
  },
  ncsu: {
    index: "https://catalog.ncsu.edu/course-descriptions/",
    link: /^\/course-descriptions\/[a-z0-9-]+\/$/,
    origin: "https://catalog.ncsu.edu",
  },
}

export const clean = (text: string) =>
  text
    .replace(/[ ​]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function editionOf($: cheerio.CheerioAPI): string {
  const text = clean($("#edition a").first().text() || $("header .header-title h1 a").first().text())
  return /\d{4}-\d{4}/.exec(text)?.[0] ?? ""
}

const NO_CREDIT =
  /(?:credit (?:(?:is|will|can) ?not|not) (?:be )?(?:allowed|given|awarded|received)|credit (?:for|in) both|(?:may|can|will) ?not (?:receive|earn|get) credit)[^.;]*/gi
const CLAUSE_END = /\b(?:Prerequisites?|Corequisites?|Co-requisites?|Requisites?|Restrictions?|Typically)\b|\b[PR]:/
const MENTION = /\b([A-Z]{1,4})(?: ?\([A-Z]{2,4}\))? ?(\d{3}[A-Z]?)\b|\b(\d{3}[A-Z]?)\b/g

export function noCreditWith(text: string, code: string, siblings: string[] = []): string[] {
  const number = code.split(" ")[1]
  const mine = (other: string) => other === code || (siblings.includes(other) && other.split(" ")[1] === number)
  const found: string[] = []
  for (const match of text.matchAll(NO_CREDIT)) {
    const clause = match[0].split(CLAUSE_END)[0]
    if (/\bafter\b|\bpairs\b|\bgraduate credit\b/i.test(clause)) continue
    const group = /\bmore than one of\b/i.test(clause)
    const divider = group ? clause.length : clause.search(/\bin addition to\b| and | & /)
    if (divider < 0) continue
    const left: string[] = []
    const right: string[] = []
    let subject = ""
    for (const mention of clause.matchAll(MENTION)) {
      subject = mention[1] ?? subject
      if (subject) (mention.index < divider ? left : right).push(`${subject} ${mention[2] ?? mention[3]}`)
    }
    const leftMine = left.some(mine) || /\bthis course\b/i.test(clause.slice(0, divider))
    const rightMine = right.some(mine) || /\bthis course\b/i.test(clause.slice(divider))
    const others = group ? (leftMine ? left.filter((other) => !mine(other)) : []) : leftMine === rightMine ? [] : leftMine ? right : left
    for (const other of others) if (!found.includes(other)) found.push(other)
  }
  return found
}

export type CollegeResult = {
  courses: CollegeCourse[]
  edition: string
  prefixAliases: Record<string, string>
  prefixEvidence: Source[]
}

export async function scrapeCollegeCourses(university: Univ): Promise<CollegeResult> {
  const site = SITES[university]
  const index = await get(site.index)
  const $index = cheerio.load(index.body)
  const subjects = new Map<string, string>()
  $index("a[href]").each((_, anchor) => {
    const href = $index(anchor).attr("href") ?? ""
    if (site.link.test(href) && !href.includes("course-numbering")) {
      subjects.set(href, clean($index(anchor).text()))
    }
  })
  const pages = await Promise.all([...subjects.keys()].map((href) => get(site.origin + href)))
  const byCode = new Map<string, CollegeCourse>()
  const prefixAliases: Record<string, string> = {}
  const prefixEvidence: Source[] = []
  for (const page of pages) {
    const $ = cheerio.load(page.body)
    const prefixes = new Set<string>()
    $("div.courseblock").each((_, element) => {
      const block = $(element)
      const codeText = clean(block.find(".detail-code, .detail-coursecode").first().text()).replace(/\.$/, "")
      const codes = codeText.split("/").map((code) => code.trim()).filter((code) => /^[A-Z&]+ \d/.test(code))
      const hours = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/.exec(
        clean(block.find(".detail-hours, .detail-hours_html").first().text()),
      )
      if (codes.length === 0 || !hours) return
      const genEd =
        university === "unc"
          ? clean(block.find(".detail-idea_action").text())
              .replace(/^.*Gen Ed:/, "")
              .split(/[,.]/)
              .map((tag) => tag.trim())
              .filter(Boolean)
          : block
              .find("p")
              .map((_, p) => clean($(p).text()))
              .get()
              .filter((text) => /^GEP /.test(text))
      const sameAs = clean(block.find(".detail-same_as").text())
        .replace(/^Same as:/, "")
        .split(/[,.]/)
        .map((code) => code.trim())
        .filter(Boolean)
      const prose = block
        .find("p.courseblockextra")
        .map((_, p) => clean($(p).text()))
        .get()
        .join(". ")
      const siblings = [...codes, ...sameAs]
      for (const code of codes) {
        prefixes.add(code.split(" ")[0])
        if (byCode.has(code)) continue
        const course: CollegeCourse = {
          code,
          title: clean(block.find(".detail-title").first().text()).replace(/\.$/, ""),
          hoursMin: Number(hours[1]),
          hoursMax: Number(hours[2] ?? hours[1]),
          genEd,
          sameAs: [...codes.filter((other) => other !== code), ...sameAs],
          source: page.source,
        }
        const barred = noCreditWith(prose, code, siblings)
        if (barred.length > 0) course.noCreditWith = barred
        byCode.set(code, course)
      }
    })
    const slug = new URL(page.url).pathname.split("/").at(-2)!.toUpperCase()
    const label = /\(([A-Z&]+)\)\s*$/.exec(subjects.get(new URL(page.url).pathname) ?? "")?.[1]
    if (university === "ncsu" && label && label !== slug && prefixes.has(label) && !prefixes.has(slug)) {
      prefixAliases[slug] = label
      prefixEvidence.push(page.source)
    }
  }
  return {
    courses: [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)),
    edition: editionOf($index),
    prefixAliases,
    prefixEvidence,
  }
}
