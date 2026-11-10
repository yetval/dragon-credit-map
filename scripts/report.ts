import type { ApRule, Major, NcssmCourse, Rule } from "../src/types.ts"

export type ReportInput = {
  dataAsOf: string
  courses: NcssmCourse[]
  rules: Rule[]
  apRules: ApRule[]
  majors: Major[]
  skipped: string[]
}

const count = <T>(items: T[], test: (item: T) => boolean) => items.filter(test).length

export function countsReport(input: ReportInput): string {
  const { courses, rules, apRules, majors } = input
  const lines = [
    `# Counts (data as of ${input.dataAsOf})`,
    "",
    "## NCSSM courses",
    "",
    `- Durham: ${count(courses, (course) => course.campuses.includes("durham"))}`,
    `- Morganton: ${count(courses, (course) => course.campuses.includes("morganton"))}`,
    `- Online: ${count(courses, (course) => course.campuses.includes("online"))}`,
    `- Durham and Morganton both: ${count(courses, (course) => course.campuses.includes("durham") && course.campuses.includes("morganton"))}`,
    `- In an articulation sheet but not in any current catalog: ${count(courses, (course) => course.campuses.length === 0)}`,
    "",
    "## Rules",
    "",
  ]
  for (const university of ["unc", "ncsu"] as const) {
    const own = rules.filter((rule) => rule.university === university)
    const ap = apRules.filter((rule) => rule.university === university)
    const list = majors.filter((major) => major.university === university)
    lines.push(
      `### ${university === "unc" ? "UNC-Chapel Hill" : "NC State"}`,
      "",
      `- Articulation rules: ${own.length} (${count(own, (rule) => rule.ncssmCourses.length > 1)} combinations, ${count(own, (rule) => rule.flags.length > 0)} flagged)`,
      `- AP rules: ${ap.length} (${count(ap, (rule) => rule.flags.length > 0)} flagged)`,
      `- Majors: ${list.length} (${count(list, (major) => major.parseStatus === "verified")} verified, ${count(list, (major) => major.parseStatus === "needs-review")} needs-review)`,
      `- Majors not on the current catalog year: ${count(list, (major) => !major.isCurrentYear)}`,
      "",
    )
  }
  const flags = new Map<string, number>()
  for (const rule of [...rules, ...apRules]) for (const flag of rule.flags) flags.set(flag, (flags.get(flag) ?? 0) + 1)
  lines.push("## Flags on rules", "")
  for (const [flag, total] of [...flags].sort((a, b) => b[1] - a[1])) lines.push(`- ${flag}: ${total}`)
  lines.push("", "## Flagged articulation rows", "")
  for (const rule of rules.filter((item) => item.flags.length > 0)) {
    lines.push(`- ${rule.university} row ${rule.raw.row}: \`${rule.raw.course.replace(/\s+/g, " ")}\` => \`${rule.raw.equivalency.replace(/\s+/g, " ")}\` [${rule.flags.join(", ")}]`)
  }
  lines.push("", "## Skipped source rows", "")
  for (const row of input.skipped) lines.push(`- ${row}`)
  return lines.join("\n") + "\n"
}

export const reasonLabel = (issue: string) =>
  issue
    .replace(/"[^"]*"/g, "")
    .replace(/:\s*[A-Z&]{1,4} \d.*$/, "")
    .replace(/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?/g, "N")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/, "")
    .trim()

export function majorsReport(majors: Major[], dataAsOf: string): string {
  const review = majors.filter((major) => major.parseStatus === "needs-review")
  const reasons = new Map<string, number>()
  for (const major of review) {
    for (const kind of new Set(major.parseIssues.map(reasonLabel))) reasons.set(kind, (reasons.get(kind) ?? 0) + 1)
  }
  const lines = [
    `# Majors that need review (data as of ${dataAsOf})`,
    "",
    `${review.length} of ${majors.length} majors did not pass every automated check.`,
    "",
    "## Reasons, by how many majors they affect",
    "",
    ...[...reasons].sort((a, b) => b[1] - a[1]).map(([reason, total]) => `- ${total}: ${reason}`),
    "",
  ]
  for (const university of ["unc", "ncsu"] as const) {
    lines.push(`## ${university === "unc" ? "UNC-Chapel Hill" : "NC State"}`, "")
    for (const major of review.filter((item) => item.university === university)) {
      const title = `${major.name}, ${major.degree}${major.concentration ? `: ${major.concentration}` : ""}`
      lines.push(`### ${title}`, "", major.url, "")
      for (const issue of major.parseIssues) lines.push(`- ${issue}`)
      lines.push("")
    }
  }
  return lines.join("\n")
}
