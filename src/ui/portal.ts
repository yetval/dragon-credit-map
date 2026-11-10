import { UNIVERSITY, apRules, courses, dataAsOf, editions, formatDate, policies, rules } from "../data.ts"
import { canonicalCode } from "../engine/codes.ts"
import type { MappingRow, Recommendation, Result, SlotResult, SlotStatus } from "../engine/index.ts"
import type { State } from "../state.ts"
import type { Slot } from "../types.ts"
import { esc, hoursText, plural } from "./parts.ts"

export type Computed = { result: Result; recs: Recommendation[] } | null

const FLAGS: Record<string, string> = {
  "course-not-in-catalog": "This course is not in the current NCSSM catalog.",
  "award-code-unresolved": "The credit code is not in the university's course catalog, so its hours are estimated.",
  "subject-unknown": "The subject code is written this way in the source and is not a subject the university lists.",
  "free-text-note": "The source cell contains extra wording. Read it in full below.",
  "dangling-separator": "The source cell ends with a stray separator.",
  "grade-unstated": "The source row states no grade. A B- is assumed.",
  "institution-blank": "The source row leaves the institution blank.",
  "department-mismatch": "The source lists this course under a different department than the catalog does.",
  "duplicate-row": "The source lists this row twice.",
  "parenthetical-code": "The source cell names a second course code in parentheses.",
  "suspicious-code": "The credit code looks unusual. It is shown as the source states it.",
  "no-award-parsed": "No credit code could be read from the source cell.",
  "typo-suspect": "The source spells this exam name differently in one row.",
  "hours-mismatch": "The chart's hours differ from the catalog's hours for these courses.",
  "hours-not-a-number": "The chart gives the hours in words, not as a number.",
  "lab-listed-separately": "The chart lists the lab separately. It is counted with the course.",
  "see-footnote": "The chart adds a footnote to this row. It is shown above.",
}

const OUTCOME: Record<MappingRow["outcome"], string> = {
  earned: "Earned",
  planned: "Planned",
  placement: "Placement only",
  blocked: "No credit",
  replaced: "Replaced",
}

const ORDER: MappingRow["outcome"][] = ["earned", "planned", "placement", "blocked", "replaced"]
const STATUSES: SlotStatus[] = ["covered", "planned", "open", "college"]

const titles = new Map(courses.flatMap((course) => [course.code, ...course.aliases].map((code) => [code, course.title] as const)))

export const recKey = (rec: Recommendation) => `${rec.kind}:${rec.add.join("+")}`

function trust(state: State): string {
  const university = UNIVERSITY[state.university!]
  const track =
    state.track || state.major?.professionalTrack
      ? `<p class="warn" role="note"><b>Pre-professional track.</b> Many medical and other professional schools want prerequisites taken in college. Check each school before you use credit to skip one.</p>`
      : ""
  return `<p class="unofficial"><b>Unofficial estimate.</b> Data as of ${formatDate(dataAsOf)}. Confirm with your counselor and ${university.name}. <button type="button" class="quiet is-line is-small" data-action="tab" data-tab="sources" data-key="to-sources">Sources and notes</button></p>${track}`
}

const statusLabel = (status: SlotStatus, state: State) =>
  ({ covered: "Covered", planned: "Planned", open: "Open", college: `Take at ${UNIVERSITY[state.university!].short}` })[status]

function waiting(state: State): string | null {
  if (state.failed) {
    return `<h1 tabindex="-1">The data did not load.</h1>
    <p class="lede">The files for this university could not be read. Check your connection and try again.</p>
    <div class="row"><button type="button" class="go is-inline" data-action="retry" data-key="retry">Try again</button></div>`
  }
  if (state.loading || !state.college) {
    return `<h1 tabindex="-1">Working it out</h1><div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div>`
  }
  return null
}

function flagNotes(row: MappingRow): string {
  const notes: string[] = []
  const said: string[] = []
  for (const id of row.ruleIds) {
    const rule = rules.find((item) => item.id === id)
    const ap = apRules.find((item) => item.id === id)
    const flags = (rule ?? ap)?.flags.filter((flag) => FLAGS[flag]) ?? []
    if (flags.length === 0) continue
    for (const flag of flags) if (!notes.includes(FLAGS[flag])) notes.push(FLAGS[flag])
    said.push(
      rule
        ? `${rule.raw.course.replace(/\s+/g, " ").trim()}: ${rule.raw.equivalency.replace(/\s+/g, " ").trim()}`
        : `${ap!.rawExam}: ${ap!.rawCredit}`,
    )
  }
  if (notes.length === 0) return ""
  return `<div class="flag"><b>Flagged source row</b><ul>${notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>${said
    .map((text) => `<p>The source says: <q>${esc(text)}</q></p>`)
    .join("")}</div>`
}

function ledgerRow(row: MappingRow): string {
  const fired = row.outcome === "earned" || row.outcome === "planned"
  const duplicate = fired && row.credits.length > 0 && row.credits.every((credit) => !credit.counted)
  const kind = duplicate ? "replaced" : row.outcome
  const names =
    row.kind === "ncssm"
      ? row.sources
          .map((code) => titles.get(code))
          .filter(Boolean)
          .join(", ")
      : "AP exam"
  const credits = row.credits
    .map((credit) => {
      const detail = credit.counted
        ? credit.hoursEstimated
          ? "Hours estimated"
          : ""
        : ""
      const name = credit.generic
        ? `<b>${esc(credit.generic.subject || credit.code)} general elective</b><small>Written in the source as ${esc(credit.code)}</small>`
        : `<b>${esc(credit.code)}</b> ${esc(credit.title)}`
      return `<li class="${credit.counted || !fired ? "" : "is-off"}">${name}${detail ? `<small>${detail}</small>` : ""}${
        credit.reason ? `<small>${esc(credit.reason)}</small>` : ""
      }</li>`
    })
    .join("")
  const status = duplicate ? "Duplicate, adds nothing" : OUTCOME[row.outcome]
  const extra = `${row.reason ? `<p class="why">${esc(row.reason)}</p>` : ""}${flagNotes(row)}`
  const hours = fired ? row.hours : 0
  return `<tr class="is-${kind}" role="row">
    <td data-label="From" role="cell"><b>${esc(row.label)}</b><small>${esc(names)}</small></td>
    <td data-label="Credit" role="cell"><ul class="awards">${credits}</ul>${extra}</td>
    <td data-label="Hours" class="num" role="cell">${hours}<span class="unit"> ${hours === 1 ? "hour" : "hours"}</span></td>
    <td data-label="Status" class="state" role="cell"><i class="glyph" aria-hidden="true"></i>${status}</td>
  </tr>`
}

function slotText(slot: Slot | undefined, fallback: string, state: State): { label: string; options: string } {
  if (!slot) return { label: fallback, options: "" }
  const aliases = state.university === "ncsu" ? policies.ncsu.prefixAliases : {}
  const title = (code: string) => state.college?.[canonicalCode(code, aliases)]?.title ?? ""
  const bundle = (option: string[]) => option.join(" + ")
  if (slot.kind === "course" && slot.options[0]) {
    const codes = slot.options[0]
    return { label: codes.length === 1 ? `${codes[0]} ${title(codes[0])}`.trim() : bundle(codes), options: "" }
  }
  if (slot.kind === "one-of" && slot.options.length <= 4) {
    return { label: slot.options.map(bundle).join(" or "), options: "" }
  }
  const label = slot.label.replace(/:\s*$/, "")
  return { label, options: slot.options.length ? slot.options.map(bundle).join(", ") : "" }
}

function requirement(result: SlotResult, slot: Slot | undefined, state: State): string {
  const text = slotText(slot, result.label, state)
  const hours = slot?.hours
    ? slot.hours.min === slot.hours.max
      ? hoursText(slot.hours.min)
      : `${slot.hours.min} to ${slot.hours.max} hours`
    : ""
  const details = [
    hours,
    result.progress && result.progress.need > 1 ? `${result.progress.have} of ${result.progress.need} ${result.progress.unit}` : "",
    result.filledBy.length ? `Filled by ${result.filledBy.join(", ")}` : "",
  ].filter(Boolean)
  return `<li class="req is-${result.status}">
    <i class="glyph" aria-hidden="true"></i>
    <div><b>${esc(text.label)}</b>${details.length ? `<small>${esc(details.join(". "))}</small>` : ""}${
      result.note ? `<small>${esc(result.note)}</small>` : ""
    }${
      text.options
        ? `<details class="opts"><summary>${plural(slot!.options.length, "option")}</summary><p>${esc(text.options)}</p></details>`
        : ""
    }</div>
    <em>${statusLabel(result.status, state)}</em>
  </li>`
}

function review(state: State): string {
  const major = state.major
  if (!major || major.parseStatus !== "needs-review") return ""
  return `<div class="warn" role="note">
    <p><b>This major needs review.</b> Its requirements did not pass every automated check, so the checklist may be wrong or incomplete. Compare it with the <a href="${esc(major.url)}" target="_blank" rel="noreferrer noopener">catalog page</a>.</p>
    <details><summary>What looked off</summary><ul>${major.parseIssues.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul></details>
  </div>`
}

function key(state: State): string {
  const notes: Record<SlotStatus, string> = { covered: "", planned: "", open: ": NCSSM or AP can fill it", college: "" }
  return `<ul class="key" aria-label="What the marks mean">${STATUSES.map(
    (status) => `<li class="is-${status}"><i class="glyph" aria-hidden="true"></i>${statusLabel(status, state)}${notes[status]}</li>`,
  ).join("")}</ul>`
}

type Pick = { main: Recommendation; others: Recommendation[] }

const recTitle = (rec: Recommendation) =>
  `${rec.label}${rec.minScore ? `, score ${rec.minScore}${rec.minScore < 5 ? " or higher" : ""}` : ""}`

export function groupPicks(recs: Recommendation[]): Pick[] {
  const groups = new Map<string, Pick>()
  for (const rec of recs) {
    const key = rec.fills.length
      ? rec.fills
          .map((fill) => fill.slotId)
          .sort()
          .join("|")
      : recKey(rec)
    const group = groups.get(key)
    if (group) group.others.push(rec)
    else groups.set(key, { main: rec, others: [] })
  }
  return [...groups.values()]
}

function nextItem(pick: Pick, index: number, state: State): string {
  const rec = pick.main
  const slots = new Map((state.major?.sections ?? []).flatMap((section) => section.slots.map((slot) => [slot.id, slot] as const)))
  const gains = rec.yields
    .filter((item) => item.hours > 0)
    .map((item) => item.code)
    .join(", ")
  const fills = rec.fills.map((fill) => slotText(slots.get(fill.slotId), fill.label, state).label)
  const others = pick.others.length
    ? `<small>${pick.others.length === 1 ? "Another way" : "Other ways"} to fill the same requirement: ${esc(pick.others.map(recTitle).join("; "))}</small>`
    : ""
  return `<li class="next">
    <span class="rank" aria-hidden="true">${index + 1}</span>
    <div>
      <b>${esc(recTitle(rec))}</b>
      <small>Could add ${hoursText(rec.hoursGained)}${gains ? `: ${esc(gains)}` : ""}</small>
      ${fills.length ? `<small>Would fill ${plural(fills.length, "requirement")}: ${esc(fills.join("; "))}</small>` : ""}
      ${others}
    </div>
    <button type="button" class="chip" data-action="add" data-rec="${esc(recKey(rec))}" data-key="add-${esc(recKey(rec))}" aria-label="Add as planned: ${esc(rec.label)}">Add as planned</button>
  </li>`
}

export function summary(state: State, computed: Computed): string {
  if (!computed) return ""
  const { totals } = computed.result
  return `<p class="side-total"><b>${totals.total}</b> <span>credit ${totals.total === 1 ? "hour" : "hours"}</span><small>${totals.earned} earned, ${totals.planned} planned</small></p>`
}

export function overview(state: State, computed: Computed): string {
  const wait = waiting(state)
  if (wait || !computed) return wait ?? ""
  const { result, recs } = computed
  const university = UNIVERSITY[state.university!]
  const { totals } = result
  const major = state.major ? `${state.major.name}, ${state.major.degree}${state.major.concentration ? `: ${state.major.concentration}` : ""}` : "No major picked yet"
  const split =
    totals.total > 0
      ? `<div class="split" role="img" aria-label="${hoursText(totals.earned)} earned, ${hoursText(totals.planned)} planned">
        <i class="is-earned" data-grow="${totals.earned}"></i><i class="is-planned" data-grow="${totals.planned}"></i>
      </div>
      <p class="legend"><span class="is-covered"><i class="glyph" aria-hidden="true"></i>${hoursText(totals.earned)} earned</span><span class="is-planned"><i class="glyph" aria-hidden="true"></i>${hoursText(totals.planned)} planned</span></p>
      <p class="hint">${hoursText(totals.specific)} from specific courses, ${hoursText(totals.generic)} as general electives.</p>`
      : `<p class="hint">Nothing counted yet. Add courses or AP exams and this fills in.</p>
      <div class="row"><button type="button" class="go is-inline" data-action="tab" data-tab="courses" data-key="to-courses">Add courses</button><button type="button" class="back" data-action="tab" data-tab="exams" data-key="to-exams">Add AP exams</button></div>`

  const all = result.checklist.flatMap((section) => section.slots)
  const tally = STATUSES.map((status) => {
    const count = all.filter((slot) => slot.status === status).length
    return `<li class="is-${status}"><i class="glyph" aria-hidden="true"></i>${statusLabel(status, state)} <b>${count}</b></li>`
  }).join("")
  const progress = result.checklist
    .map((section) => {
      const segments = STATUSES.map((status) => {
        const count = section.slots.filter((slot) => slot.status === status).length
        return count ? `<i class="is-${status}" data-grow="${count}"></i>` : ""
      }).join("")
      const filled = section.slots.filter((slot) => slot.status === "covered" || slot.status === "planned").length
      return `<li><span>${esc(section.title)}</span><small>${filled} of ${section.slots.length}</small><div class="meter" aria-hidden="true">${segments}</div></li>`
    })
    .join("")
  const requirements = state.major
    ? `<ul class="key" aria-label="Requirements by status">${tally}</ul><ul class="progress">${progress}</ul>
      <button type="button" class="quiet is-line" data-action="tab" data-tab="major" data-key="to-major">See every requirement</button>`
    : `<p class="hint">Pick a major to see which of its requirements your credit covers.</p>
      <button type="button" class="quiet is-line" data-action="tab" data-tab="profile" data-key="to-profile">Pick a major</button>`
  const picks = groupPicks(recs)
  const top = picks.slice(0, 3)
  const next = top.length
    ? `<ol class="nexts" role="list">${top.map((pick, index) => nextItem(pick, index, state)).join("")}</ol>
      <button type="button" class="quiet is-line" data-action="tab" data-tab="next" data-key="to-next">See all ${picks.length}</button>`
    : `<p class="hint">Nothing left at NCSSM or on the AP list would add credit or fill a requirement here.</p>`
  return `<h1 tabindex="-1" class="total"><b>${totals.total}</b><span>credit ${totals.total === 1 ? "hour" : "hours"} projected at ${university.name}${
    totals.estimated ? ", partly estimated" : ""
  }</span></h1>
  <p class="lede">${esc(major)}</p>
  ${split}
  ${trust(state)}
  ${review(state)}
  <div class="cols">
    <section aria-labelledby="h-reqs"><h2 id="h-reqs">Major requirements</h2>${requirements}</section>
    <section aria-labelledby="h-next"><h2 id="h-next">${state.year === "junior" ? "Take next year" : "Still worth adding"}</h2>${next}</section>
  </div>`
}

export function creditsTab(state: State, computed: Computed): string {
  const wait = waiting(state)
  if (wait || !computed) return wait ?? ""
  const { result } = computed
  const short = UNIVERSITY[state.university!].short
  const rows = [...result.mapping].sort((a, b) => ORDER.indexOf(a.outcome) - ORDER.indexOf(b.outcome))
  if (rows.length === 0) {
    return `<h1 tabindex="-1">Credits</h1>
    <p class="lede">${
      state.courses.size + state.exams.size === 0
        ? "Each course or AP exam you add appears here with the credit it can earn."
        : `None of what you entered has a credit agreement at ${short}.`
    }</p>
    <div class="row"><button type="button" class="go is-inline" data-action="tab" data-tab="courses" data-key="to-courses">Add courses</button><button type="button" class="back" data-action="tab" data-tab="exams" data-key="to-exams">Add AP exams</button></div>`
  }
  return `<h1 tabindex="-1">Credits</h1>
  <p class="lede">${hoursText(result.totals.total)} from ${plural(rows.filter((row) => row.hours > 0).length, "source")}. Each row shows what one course, combination, or AP exam becomes at ${short}.</p>
  <table class="ledger" role="table">
    <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">From</th><th scope="col" role="columnheader">Credit at ${short}</th><th scope="col" class="num" role="columnheader">Hours</th><th scope="col" role="columnheader">Status</th></tr></thead>
    <tbody role="rowgroup">${rows.map(ledgerRow).join("")}</tbody>
  </table>
  ${trust(state)}`
}

export function majorTab(state: State, computed: Computed): string {
  const wait = waiting(state)
  if (wait || !computed) return wait ?? ""
  if (!state.major) {
    return `<h1 tabindex="-1">Major requirements</h1>
    <p class="lede">Pick a major to see which of its requirements your credit covers.</p>
    <div class="row"><button type="button" class="go is-inline" data-action="tab" data-tab="profile" data-key="to-profile">Pick a major</button></div>`
  }
  const major = state.major
  const slots = new Map(major.sections.flatMap((section) => section.slots.map((slot) => [slot.id, slot] as const)))
  const sections = computed.result.checklist
    .map((section, index) => {
      const filled = section.slots.filter((slot) => slot.status === "covered" || slot.status === "planned").length
      return `<details class="sect"${index < 3 || filled > 0 ? " open" : ""}>
        <summary><span>${esc(section.title)}</span><small>${filled} of ${section.slots.length} filled</small></summary>
        <ul class="reqs">${section.slots.map((slot) => requirement(slot, slots.get(slot.id), state)).join("")}</ul>
      </details>`
    })
    .join("")
  return `<h1 tabindex="-1">${esc(major.name)}, ${esc(major.degree)}</h1>
  <p class="lede">${major.concentration ? `${esc(major.concentration)}. ` : ""}Catalog year ${esc(major.catalogYear)}. <a href="${esc(major.url)}" target="_blank" rel="noreferrer noopener">Catalog page</a></p>
  ${review(state)}
  ${key(state)}
  ${sections}
  ${trust(state)}`
}

export function nextTab(state: State, computed: Computed): string {
  const wait = waiting(state)
  if (wait || !computed) return wait ?? ""
  const { recs } = computed
  const lede =
    state.year === "junior"
      ? "Picks for senior year, ranked by how many major requirements they fill, then by hours gained per course."
      : "What is still worth adding before you graduate, ranked by major requirements filled, then by hours gained."
  if (recs.length === 0) {
    return `<h1 tabindex="-1">What to take next</h1><p class="lede">Nothing left at NCSSM or on the AP list would add credit or fill a requirement here.</p>`
  }
  const picks = groupPicks(recs)
  const shown = state.showAllNext ? picks : picks.slice(0, 12)
  return `<h1 tabindex="-1">What to take next</h1>
  <p class="lede">${lede}</p>
  ${review(state)}
  <ol class="nexts" role="list">${shown.map((pick, index) => nextItem(pick, index, state)).join("")}</ol>
  ${picks.length > shown.length ? `<button type="button" class="quiet is-line" data-action="more" data-key="more">Show all ${picks.length}</button>` : ""}
  ${trust(state)}`
}

export function sourcesTab(state: State, computed: Computed): string {
  const university = state.university!
  const campus = state.campus!
  const notes = [...(computed?.result.notes ?? [])]
  if (computed && computed.result.totals.generic > 0) {
    notes.push(
      "General elective hours (credit in a subject with no specific course) count toward your total, but they fill a requirement only when your major accepts electives in that subject. They may not all count toward your degree.",
    )
  }
  if (computed?.result.totals.estimated) {
    notes.push("Hours marked estimated could not be found in the university catalog. Each is counted as 3 hours.")
  }
  if (state.courses.size > 0) notes.push("Planned courses are assumed to earn the grade the agreement requires.")
  const sheet = rules.find((rule) => rule.university === university)!.source.url.replace(/\/export.*$/, "/")
  const chart = apRules.find((rule) => rule.university === university)!.source.url
  const catalog = courses
    .find((course) => course.campuses.includes(campus))!
    .sources.find((source) => source.url.includes(campus === "durham" ? "id=1" : "id=3"))
  const links: [string, string][] = [
    [`NCSSM credit agreement with ${UNIVERSITY[university].name}`, sheet],
    ["NCSSM college credit agreements", "https://www.ncssm.edu/residential/academics/college-credit-agreements"],
    [`${UNIVERSITY[university].name} AP credit chart`, chart],
  ]
  if (catalog) links.push([`NCSSM ${campus === "durham" ? "Durham" : "Morganton"} course catalog`, catalog.url])
  if (state.major) links.push([`${state.major.name}, ${state.major.degree}: catalog page`, state.major.url])
  if (university === "unc") {
    links.push(["UNC limits on credit by exam", policies.unc.beLimits.source.url])
    links.push([
      "UNC's own NCSSM credit table (not used here, worth checking)",
      "https://admissions.unc.edu/credit-table/north-carolina-school-of-science-and-math/",
    ])
  } else {
    links.push(["NC State engineering CODA requirements", policies.ncsu.coda.source.url])
  }
  return `<h1 tabindex="-1">Sources and notes</h1>
  <p class="lede">The numbers in this portal come from the pages below, except hours marked estimated. Data as of ${formatDate(dataAsOf)}, university catalog year ${esc(editions[university] ?? "")}.</p>
  ${notes.length ? `<h2>Good to know</h2><ul class="notes">${notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>` : ""}
  <h2>Sources</h2>
  <ul class="links">${links
    .map(([label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noreferrer noopener">${esc(label)}</a></li>`)
    .join("")}</ul>
  <p class="fine is-left">Dragon Credit Map is unofficial and is not run by NCSSM, UNC-Chapel Hill, or NC State. Confirm everything with your counselor and the university before you rely on it.</p>`
}
