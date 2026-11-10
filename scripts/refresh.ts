import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fetchedSources } from "./lib/http.ts"
import { scrapeNcssmCatalog } from "./ncssm-catalog.ts"
import { scrapeCollegeCourses } from "./college-courses.ts"
import { scrapeAp } from "./ap.ts"
import { scrapeArticulation } from "./articulation.ts"
import { scrapeMajors } from "./majors.ts"
import { scrapePolicies } from "./policies.ts"
import { countsReport, majorsReport } from "./report.ts"
import { canonicalCode } from "../src/engine/codes.ts"
import type { CollegeCourse, Manifest, Univ } from "../src/types.ts"

const ROOT = join(import.meta.dirname, "..")
const DATA = join(ROOT, "data")
const REPORTS = join(ROOT, "reports")
const SCHEMA_VERSION = 1

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith(".json") ? [join(dir, entry.name)] : [],
  )
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([name]) => name !== "fetchedAt" && name !== "sha256")
        .map(([name, child]) => [name, strip(child)]),
    )
  }
  return value
}

function records(file: string, content: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>()
  const list = (content as { records?: unknown[] }).records
  if (!Array.isArray(list)) {
    map.set(file, content)
    return map
  }
  for (const item of list) {
    const entry = item as { id?: string; code?: string }
    map.set(`${file}#${entry.id ?? entry.code ?? map.size}`, item)
  }
  return map
}

function differences(before: unknown, after: unknown, path = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  const both = [before, after].every((value) => value && typeof value === "object")
  if (!both || Array.isArray(before) !== Array.isArray(after)) {
    const show = (value: unknown) => (JSON.stringify(value) ?? "nothing").slice(0, 70)
    return [`${path || "value"}: ${show(before)} -> ${show(after)}`]
  }
  const names = new Set([...Object.keys(before as object), ...Object.keys(after as object)])
  return [...names].flatMap((name) =>
    differences(
      (before as Record<string, unknown>)[name],
      (after as Record<string, unknown>)[name],
      path ? `${path}.${name}` : name,
    ),
  )
}

const majorFile = (major: { id: string; university: string }) =>
  join("majors", major.university, `${major.id.slice(major.university.length + 1)}.json`)

function snapshot(): Map<string, unknown> {
  const all = new Map<string, unknown>()
  for (const file of walk(DATA)) {
    const name = relative(DATA, file)
    if (name === "manifest.json" || name === "summary.json") continue
    const content = JSON.parse(readFileSync(file, "utf8"))
    if (name.startsWith("majors") && name !== "majors-index.json" && name !== majorFile(content)) continue
    for (const [id, item] of records(name, content)) all.set(id, strip(item))
  }
  return all
}

function write(name: string, content: unknown) {
  const file = join(DATA, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(content, null, 1) + "\n")
}

const today = new Date()
const before = snapshot()

console.log("Fetching NCSSM catalogs")
const catalog = await scrapeNcssmCatalog()
console.log("Fetching college course descriptions")
const [uncCourses, ncsuCourses] = await Promise.all([scrapeCollegeCourses("unc"), scrapeCollegeCourses("ncsu")])
const college: Record<Univ, CollegeCourse[]> = { unc: uncCourses.courses, ncsu: ncsuCourses.courses }
const aliases = ncsuCourses.prefixAliases
console.log("Fetching AP credit charts")
const ap = await scrapeAp(college, aliases)
console.log("Fetching articulation sheets")
const articulation = await scrapeArticulation(catalog.courses, college, aliases, ap.zeroHourCodes)
console.log("Fetching major requirements")
const [uncMajors, ncsuMajors] = await Promise.all([
  scrapeMajors("unc", college.unc, {}, today),
  scrapeMajors("ncsu", college.ncsu, aliases, today),
])
console.log("Fetching policy pages")
const policies = await scrapePolicies(aliases, ncsuCourses.prefixEvidence)

const ncssmCourses = [...catalog.courses, ...articulation.pastCourses].sort((a, b) => a.code.localeCompare(b.code))
const majors = [...uncMajors.majors, ...ncsuMajors.majors]
const sources = fetchedSources()
const dataAsOf = sources.map((source) => source.fetchedAt).sort().at(-1) ?? today.toISOString().slice(0, 10)

write("ncssm-courses.json", { schemaVersion: SCHEMA_VERSION, records: ncssmCourses })
write("articulation.json", { schemaVersion: SCHEMA_VERSION, records: articulation.rules })
write("ap-credit.json", { schemaVersion: SCHEMA_VERSION, records: ap.rules })
write("ap-exams.json", { schemaVersion: SCHEMA_VERSION, records: ap.exams })
write("policies.json", { schemaVersion: SCHEMA_VERSION, ...policies })
for (const university of ["unc", "ncsu"] as Univ[]) {
  write(`college-courses.${university}.json`, { schemaVersion: SCHEMA_VERSION, records: college[university] })
  const own = majors.filter((major) => major.university === university)
  const needed = new Set<string>()
  for (const rule of [...articulation.rules, ...ap.rules]) {
    if (rule.university === university) for (const award of rule.awards) needed.add(canonicalCode(award.code, aliases))
  }
  for (const major of own) {
    for (const section of major.sections) {
      for (const slot of section.slots) for (const option of slot.options) for (const code of option) needed.add(canonicalCode(code, aliases))
    }
  }
  const lite = Object.fromEntries(
    college[university]
      .filter((course) => needed.has(course.code))
      .map((course) => [
        course.code,
        {
          title: course.title,
          hours: course.hoursMin,
          hoursMax: course.hoursMax,
          genEd: course.genEd,
          ...(course.noCreditWith ? { noCreditWith: course.noCreditWith.map((code) => canonicalCode(code, aliases)) } : {}),
        },
      ]),
  )
  write(`college-lite.${university}.json`, { schemaVersion: SCHEMA_VERSION, courses: lite })
  for (const major of own) write(majorFile(major), { schemaVersion: SCHEMA_VERSION, ...major })
}
const expected = new Set(majors.map(majorFile))
const majorsDir = join(DATA, "majors")
for (const entry of readdirSync(majorsDir, { recursive: true, withFileTypes: true })) {
  const file = join(entry.parentPath, entry.name)
  if (entry.isFile() && !expected.has(relative(DATA, file))) rmSync(file)
}
write("majors-index.json", {
  schemaVersion: SCHEMA_VERSION,
  records: majors.map(({ id, university, name, degree, concentration, college: school, parseStatus, isCurrentYear, entersViaCoda, professionalTrack }) => ({
    id, university, name, degree, concentration, college: school, parseStatus, isCurrentYear, entersViaCoda, professionalTrack,
  })),
})
const manifest: Manifest = {
  schemaVersion: SCHEMA_VERSION,
  dataAsOf,
  editions: { unc: uncMajors.edition, ncsu: ncsuMajors.edition, ncssm: "not stated on the source" },
  counts: {
    ncssmCourses: ncssmCourses.length,
    articulationRules: articulation.rules.length,
    apRules: ap.rules.length,
    majors: majors.length,
    majorsVerified: majors.filter((major) => major.parseStatus === "verified").length,
  },
  sources,
}
write("manifest.json", manifest)
write("summary.json", { schemaVersion: SCHEMA_VERSION, dataAsOf, editions: manifest.editions, counts: manifest.counts })

mkdirSync(REPORTS, { recursive: true })
const skipped = [...catalog.skipped.map((row) => `NCSSM catalog, ${row}`), ...articulation.skippedRows]
const counts = countsReport({ dataAsOf, courses: ncssmCourses, rules: articulation.rules, apRules: ap.rules, majors, skipped })
writeFileSync(join(REPORTS, "counts.md"), counts)
writeFileSync(join(REPORTS, "majors-review.md"), majorsReport(majors, dataAsOf))

const after = snapshot()
const added = [...after.keys()].filter((id) => !before.has(id))
const removed = [...before.keys()].filter((id) => !after.has(id))
const changed = [...after.keys()].filter((id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
console.log(`\nChanges since the last refresh: ${added.length} added, ${removed.length} removed, ${changed.length} changed`)
const limit = process.argv.includes("--full-diff") ? Infinity : 40
for (const id of added.slice(0, limit)) console.log(`+ ${id}`)
for (const id of removed.slice(0, limit)) console.log(`- ${id}`)
for (const id of changed.slice(0, limit)) {
  console.log(`~ ${id}`)
  for (const line of differences(before.get(id), after.get(id)).slice(0, 6)) console.log(`    ${line}`)
}
if (added.length + removed.length + changed.length > limit) console.log("Run with --full-diff to list everything.")
console.log(`\n${counts.split("## Flags on rules")[0]}`)
console.log("Reports written to reports/counts.md and reports/majors-review.md. Review before committing.")
