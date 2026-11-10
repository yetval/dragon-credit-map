import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { get } from "./lib/http.ts"
import { buildSections, parseTables } from "./lib/courseleaf.ts"
import { clean, editionOf } from "./college-courses.ts"
import { canonicalCode } from "../src/engine/codes.ts"
import type { CollegeCourse, Major, Univ } from "../src/types.ts"

type Listing = { url: string; name: string; degree: string; concentration?: string }

const ORIGIN: Record<Univ, string> = { unc: "https://catalog.unc.edu", ncsu: "https://catalog.ncsu.edu" }
const INDEX: Record<Univ, string> = {
  unc: "https://catalog.unc.edu/undergraduate/programs-study/",
  ncsu: "https://catalog.ncsu.edu/undergraduate/",
}

export function currentEdition(today: Date): string {
  const start = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1
  return `${start}-${start + 1}`
}

export function parseListing(university: Univ, text: string): Omit<Listing, "url"> | null {
  if (university === "unc") {
    if (/\bMinor\b/.test(text)) return null
    const match = /^(.*?),\s*(?:Bachelor of [A-Za-z ]+\()?(B\.[A-Za-z.]+?)\)?(?:\s*–\s*(.+))?$/.exec(text)
    if (!match) return null
    const listing = { name: match[1].replace(/\s+Major$/, ""), degree: match[2] }
    return match[3] ? { ...listing, concentration: match[3] } : listing
  }
  const double = /^(.*\((?:BS|BA)\) and .*\((?:BS|BA)\)) \(Double Major\)$/.exec(text)
  if (double) return { name: double[1], degree: "Double Major" }
  const match = /^(.*?) \((BS|BA|Bachelor)\)(?::\s*(.+))?$/.exec(text)
  if (!match) return null
  const listing = { name: match[1], degree: match[2] }
  return match[3] ? { ...listing, concentration: match[3] } : listing
}

async function listPrograms(university: Univ): Promise<Listing[]> {
  const page = await get(INDEX[university])
  const $ = cheerio.load(page.body)
  const scope = university === "unc" ? ".az_sitemap li a" : "#majorstextcontainer .az_sitemap li a"
  const listings = new Map<string, Listing>()
  $(scope).each((_, anchor) => {
    const href = $(anchor).attr("href") ?? ""
    const parsed = parseListing(university, clean($(anchor).text()))
    if (parsed && href.startsWith("/undergraduate/")) listings.set(href, { ...parsed, url: ORIGIN[university] + href })
  })
  if (listings.size === 0) throw new Error(`No programs found at ${page.url}`)
  return [...listings.values()]
}

export type MajorsResult = { majors: Major[]; edition: string }

export async function scrapeMajors(
  university: Univ,
  courses: CollegeCourse[],
  aliases: Record<string, string>,
  today: Date,
): Promise<MajorsResult> {
  const expected = currentEdition(today)
  const byCode = new Map(courses.map((course) => [course.code, course]))
  const catalog = {
    hoursOf(code: string) {
      const course = byCode.get(canonicalCode(code, aliases))
      return course ? { min: course.hoursMin, max: course.hoursMax } : null
    },
    resolve(code: string) {
      if (byCode.has(canonicalCode(code, aliases))) return code
      const [subjects, numbers = ""] = code.split(" ")
      for (const subject of subjects.split("/")) {
        for (const number of numbers.split("/")) {
          const candidate = `${subject} ${number}`
          if (byCode.has(canonicalCode(candidate, aliases))) return candidate
        }
      }
      return code
    },
  }
  const listings = await listPrograms(university)
  const pages = await Promise.all(listings.map((listing) => get(listing.url)))
  const majors: Major[] = []
  let edition = ""
  listings.forEach((listing, index) => {
    const page = pages[index]
    const $ = cheerio.load(page.body)
    const id = `${university}-${new URL(listing.url).pathname.split("/").filter(Boolean).at(-1)}`
    const catalogYear = editionOf($)
    edition ||= catalogYear
    const tab = $("#tabs a, nav a[role='tab']")
      .filter((_, anchor) => /requirements/i.test($(anchor).text()))
      .first()
      .attr("href")
    const container = $(tab && tab.startsWith("#") ? tab : "#requirementstextcontainer, #planrequirementstextcontainer").first()
    const parsed = buildSections(parseTables($, container as cheerio.Cheerio<Element>), catalog, id)
    const issues = [...parsed.issues]
    if (parsed.sections.length === 0 && !issues.length) issues.push("No requirement rows were parsed")
    if (!catalogYear) issues.push("The page shows no catalog year")
    else if (catalogYear !== expected) issues.push(`Catalog year ${catalogYear} is not the current year ${expected}`)
    const path = new URL(listing.url).pathname.split("/").filter(Boolean)
    const fullName = `${listing.name} ${listing.concentration ?? ""}`
    const major: Major = {
      id,
      university,
      name: listing.name,
      degree: listing.degree,
      url: listing.url,
      catalogYear,
      isCurrentYear: catalogYear === expected,
      layout: parsed.layout,
      totalHours: parsed.totalHours,
      sections: parsed.sections,
      parseStatus: issues.length === 0 ? "verified" : "needs-review",
      parseIssues: issues,
      parseNotes: parsed.notes,
      entersViaCoda: university === "ncsu" && path[1] === "engineering",
      professionalTrack: /\bpre-|medic|nursing|pharm|dental|veterinar|health|clinical/i.test(fullName),
      source: page.source,
    }
    if (listing.concentration) major.concentration = listing.concentration
    if (university === "ncsu") {
      major.college = clean($("#breadcrumb a, .breadcrumb a").eq(2).text()) || path[1]
    }
    majors.push(major)
  })
  majors.sort((a, b) => a.id.localeCompare(b.id))
  return { majors, edition }
}
