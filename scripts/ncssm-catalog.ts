import * as cheerio from "cheerio"
import { get } from "./lib/http.ts"
import type { Campus, CourseTag, NcssmCourse, Source } from "../src/types.ts"

const CATALOGS: { campus: Campus; url: string }[] = [
  { campus: "durham", url: "https://courses.ncssm.edu/course_catalog.php?id=1" },
  { campus: "morganton", url: "https://courses.ncssm.edu/course_catalog.php?id=3" },
  { campus: "online", url: "https://courses.ncssm.edu/course_catalog.php?id=2" },
]

export const NCSSM_CODE = /[A-Z]{2}\d{4}[A-Za-z]?/
const TITLE = new RegExp(`^(${NCSSM_CODE.source}(?:\\/${NCSSM_CODE.source})*)\\s*[-:]?\\s+(.*)$`)

export function splitTitle(rawTitle: string): { codes: string[]; title: string; tags: CourseTag[] } | null {
  const match = TITLE.exec(rawTitle.trim())
  if (!match) return null
  const tags: CourseTag[] = []
  if (/\(\*R\*\)/.test(match[2])) tags.push("research")
  if (/\(\*M\*\)/.test(match[2])) tags.push("math-intensive")
  const title = match[2].replace(/\(\*[RM]\*\)/g, "").replace(/\s+/g, " ").trim()
  return { codes: match[1].split("/"), title, tags }
}

export type CatalogResult = { courses: NcssmCourse[]; skipped: string[]; perCampus: Record<Campus, number> }

export type CatalogPage = { campus: Campus; url: string; body: string; source: Source }

export async function scrapeNcssmCatalog(): Promise<CatalogResult> {
  const pages: CatalogPage[] = []
  for (const { campus, url } of CATALOGS) pages.push({ campus, ...(await get(url)) })
  return readCatalogs(pages)
}

export function readCatalogs(pages: CatalogPage[]): CatalogResult {
  const byCode = new Map<string, NcssmCourse>()
  const known = new Map<string, NcssmCourse>()
  const skipped: string[] = []
  const perCampus: Record<Campus, number> = { durham: 0, morganton: 0, online: 0 }
  for (const page of pages) {
    const { campus, url } = page
    const $ = cheerio.load(page.body)
    const items = $("li.course_listing_selected")
    if (items.length === 0) {
      throw new Error(`The ${campus} catalog at ${url} returned no courses. Stop and ask for the catalog.`)
    }
    items.each((_, element) => {
      const item = $(element)
      const rawTitle = item.find("span.course_title").first().text().trim()
      const parsed = splitTitle(rawTitle)
      if (!parsed) {
        skipped.push(`${campus}: ${rawTitle}`)
        return
      }
      const fields = new Map<string, string>()
      for (const piece of (item.find("p.course_body").first().html() ?? "").split(/<br\s*\/?>/)) {
        const text = cheerio.load(piece).text().trim()
        const split = text.indexOf(":")
        if (split > 0) fields.set(text.slice(0, split), text.slice(split + 1).trim())
      }
      const [code, ...aliases] = parsed.codes
      const existing = parsed.codes.map((item) => known.get(item)).find(Boolean)
      if (existing) {
        if (!existing.campuses.includes(campus)) existing.campuses.push(campus)
        if (!existing.sources.some((item) => item.url === page.source.url)) existing.sources.push(page.source)
        for (const tag of parsed.tags) if (!existing.tags.includes(tag)) existing.tags.push(tag)
        for (const item of parsed.codes) {
          if (item !== existing.code && !existing.aliases.includes(item)) existing.aliases.push(item)
          known.set(item, existing)
        }
        return
      }
      const course: NcssmCourse = {
        code,
        aliases,
        title: parsed.title,
        rawTitle,
        department: fields.get("Dept") ?? "",
        campuses: [campus],
        tags: parsed.tags,
        sources: [page.source],
      }
      if (fields.get("Subject")) course.subject = fields.get("Subject")
      if (fields.get("Credits")) course.credits = fields.get("Credits")
      byCode.set(code, course)
      for (const item of parsed.codes) known.set(item, course)
    })
    perCampus[campus] = [...byCode.values()].filter((course) => course.campuses.includes(campus)).length
    if (perCampus[campus] === 0) {
      throw new Error(`The ${campus} catalog at ${url} could not be parsed. Stop and ask for the catalog.`)
    }
  }
  const courses = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
  return { courses, skipped, perCampus }
}
