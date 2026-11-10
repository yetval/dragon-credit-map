import type { Cheerio, CheerioAPI } from "cheerio"
import type { Element } from "domhandler"
import type { Accepts, HoursRange, Section, Slot, Wildcard } from "../../src/types.ts"

export type Row =
  | { kind: "header"; text: string; hours: string }
  | { kind: "total"; hours: string }
  | { kind: "course"; options: string[][]; title: string; hours: string; indent: boolean; or: boolean; raw: string }
  | { kind: "comment"; text: string; code: string; hours: string; indent: boolean; or: boolean; href: string; raw: string }

export type Table = { heading: string; anchor: string; layout: "courselist" | "plangrid"; rows: Row[] }

export type Catalog = { hoursOf(code: string): HoursRange | null; resolve?(code: string): string }

export type Parsed = {
  layout: "courselist" | "plangrid"
  sections: Section[]
  totalHours: HoursRange | null
  issues: string[]
  notes: string[]
}

const clean = (text: string) =>
  text
    .replace(/[ ​]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function parseHours(text: string): HoursRange | null {
  const match = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/.exec(text.trim())
  return match ? { min: Number(match[1]), max: Number(match[2] ?? match[1]) } : null
}

function parseRow($: CheerioAPI, element: Element, layout: Table["layout"]): Row | null {
  const row = $(element).clone()
  row.find("sup").remove()
  row.find("br").replaceWith(" ")
  const hours = clean(row.find("td.hourscol").text())
  if (row.hasClass("listsum") || row.hasClass("plangridtotal")) return { kind: "total", hours }
  if (row.is(".plangridyear, .plangridterm, .plangridsum") || row.find("td").length === 0) return null
  if (row.hasClass("areaheader")) {
    return { kind: "header", text: clean(row.find("td").not(".hourscol").text()), hours }
  }
  const raw = clean(
    row
      .find("td")
      .map((_, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean)
      .join(" "),
  )
  if (!raw) return null
  const codecol = row.find("td.codecol").first()
  const anchors = codecol.find("a.bubblelink.code")
  const indent =
    anchors.length > 0
      ? anchors.first().closest("div.blockindent").length > 0
      : row.find("div.blockindent").length > 0
  if (anchors.length > 0) {
    const codes = anchors.map((_, anchor) => clean($(anchor).attr("title") ?? $(anchor).text())).get()
    const text = clean(codecol.text())
    const alternatives = layout === "plangrid" || !row.hasClass("orclass") ? /\bor\b/i.test(text) : false
    const title = clean(row.find("td").not(".codecol, .hourscol").first().text())
    return {
      kind: "course",
      options: alternatives ? codes.map((code) => [code]) : [codes],
      title,
      hours,
      indent,
      or: row.hasClass("orclass"),
      raw,
    }
  }
  const href = row.find("span.courselistcomment a[href], span.comment a[href]").first().attr("href") ?? ""
  const text = row
    .find("td")
    .not(".hourscol")
    .map((_, cell) => clean($(cell).text()))
    .get()
    .filter(Boolean)
    .join(" ")
  return { kind: "comment", text, code: clean(codecol.text()), hours, indent, or: row.hasClass("orclass"), href, raw }
}

export function parseTables($: CheerioAPI, container: Cheerio<Element>): Table[] {
  const tables: Table[] = []
  let heading = ""
  let anchor = ""
  const HEADINGS = "h2, h3, h4, h5, p:has(> a[id]), p:has(> a[name]), div:has(> a[id]), div:has(> a[name])"
  const totaled = (rows: Row[]) => rows.some((row) => row.kind === "total")
  container.find(`${HEADINGS}, table.sc_courselist, table.sc_plangrid`).each((_, element) => {
    const node = $(element)
    if (element.tagName !== "table") {
      const text = clean(node.text())
      const loose = element.tagName === "p" || element.tagName === "div"
      if (loose && (!text || text.length > 150 || node.find("table").length > 0 || node.closest("table").length > 0)) return
      heading = text
      anchor = node.find("a[id]").attr("id") ?? node.find("a[name]").attr("name") ?? node.attr("id") ?? anchor
      return
    }
    const first = tables.length === 0
    const layout = node.hasClass("sc_plangrid") ? "plangrid" : "courselist"
    const rows = node
      .find("tbody tr")
      .map((_, row) => parseRow($, row, layout))
      .get()
      .filter(Boolean)
    const header = rows.find((row) => row.kind === "header")
    const previous = tables.at(-1)
    const adjacent = node.prev().is("table.sc_courselist")
    if (!heading && !header && adjacent && previous && tables.length > 1 && !totaled(rows) && !totaled(previous.rows)) {
      previous.rows.push(...rows)
      return
    }
    tables.push({ heading: heading || (!first && header ? header.text : ""), anchor, layout, rows })
    heading = ""
    anchor = ""
  })
  return tables
}

const NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const NUM = `(${Object.keys(NUMBERS).join("|")}|\\d+)`
const toNumber = (word: string) => NUMBERS[word.toLowerCase()] ?? Number(word)
const PICK_HOURS = new RegExp(`\\b${NUM}\\s*(?:\\(\\d+\\)\\s*)?(?:credit|hour|unit)s?\\b`, "i")
const PICK_COUNT = new RegExp(
  `\\b(?:at least\\s+)?${NUM}\\b(?![- ]?level)(?:\\s+[\\w-]+){0,4}?\\s+(?:of|from|among|courses?|options?|electives?)\\b`,
  "i",
)
const PICK_VERB = new RegExp(`\\b(?:select|choose|pick|take|complete)\\s+(?:at least\\s+)?${NUM}\\b`, "i")

export function pickFromText(text: string): { count?: number; hours?: number } | null {
  const hours = PICK_HOURS.exec(text)
  if (hours) return { hours: toNumber(hours[1]) }
  const count = PICK_COUNT.exec(text) ?? PICK_VERB.exec(text)
  return count ? { count: toNumber(count[1]) } : null
}

const EXCEPT = /\b(?:except(?: for)?|excluding|not including|may not include|other than)\b(.*)$/i
const SUBJECTS = "(?:[A-Z]{2,4}(?:, or |, and |, | or | and | and/or ))*[A-Z]{2,4}"
const subjectList = (text: string) => text.split(/,? (?:or |and |and\/or )?/)

function exceptCodes(text: string, subject: string): string[] {
  const tail = EXCEPT.exec(text)?.[1].split(/[.)](?:\s|$)/)[0]
  if (!tail) return []
  const codes: string[] = []
  let current = subject
  for (const match of tail.matchAll(/(?:\b([A-Z]{2,4}) )?\b(\d{2,3}[A-Z]?)\b/g)) {
    current = match[1] ?? current
    if (current) codes.push(`${current} ${match[2]}`)
  }
  return codes
}

function withExcept<T extends Wildcard>(target: T, text: string): T {
  const except = exceptCodes(text, target.subjects[0] ?? "")
  return except.length > 0 ? { ...target, except } : target
}

function levelRange(text: string): { minLevel: number; maxLevel?: number } | null {
  const between = /\b(?:between|numbered) (?:[A-Z]{2,4} )?(\d{3}) ?(?:-|to|through|and) ?(?:[A-Z]{2,4} )?(\d{3})\b/.exec(text)
  if (between) return { minLevel: Number(between[1]), maxLevel: Number(between[2]) }
  const above = /\babove (?:level )?(?:[A-Z]{2,4} )?(\d{2,3})[A-Z]?\b/.exec(text)
  if (above) return { minLevel: Number(above[1]) + 1 }
  const higher = /\b(\d{3})(?:[- ]level)?\s*(?:or\s+(?:higher|above)|\+|and above)/i.exec(text)
  if (higher) return { minLevel: Number(higher[1]) }
  const levels = /\bat the ((?:\d{3}[-, ]*(?:or |and )?)+)-?\s*levels?\s*\.?\s*$/i.exec(text)
  if (!levels) return null
  const listed = levels[1].match(/\d{3}/g)!.map(Number)
  return { minLevel: Math.min(...listed), maxLevel: Math.max(...listed) + 99 }
}

export const mainClause = (text: string) => text.split(/[,;(]\s*(?:with |including |and )?at least\b/i)[0]

const FREE = /\bfree electives?\b/i
const headingLike = (text: string) => text.replace(/\(.*?\)/g, "").trim().length <= 40

export function acceptsFromText(text: string): Accepts | null {
  const gep = /^(GEP [A-Za-z ,&]+?)(?:\s*\(.*\))?$/.exec(text)
  if (gep) return { subjects: [], genEd: gep[1].trim() }
  if (FREE.test(text)) return headingLike(text) ? { subjects: ["*"] } : null
  const wildcard = /^([A-Z]{2,4}) ?(?:(\d)\*\*|(\d)--|---|\*\*\*)/.exec(text)
  if (wildcard) {
    const digit = wildcard[2] ?? wildcard[3]
    const above = /above (\d{2,3})\b/.exec(text)
    const minLevel = digit ? Number(digit) * 100 : above ? Number(above[1]) + 1 : undefined
    return withExcept(minLevel === undefined ? { subjects: [wildcard[1]] } : { subjects: [wildcard[1]], minLevel }, text)
  }
  const clause = mainClause(text)
  const numbered = new RegExp(`\\b(${SUBJECTS})\\b[^.]*?\\bcourses?\\b([^.]*)`).exec(clause)
  if (!numbered) return null
  const range = levelRange(numbered[2].split(/[:;]/)[0].split(EXCEPT)[0])
  const plain = new RegExp(`\\b${SUBJECTS}\\)? (?:elective )?courses?\\b`).test(clause)
  if (!range && (clause === text || !plain)) return null
  return withExcept({ subjects: subjectList(numbered[1]), ...(range ?? {}) }, text)
}

export function wildcardFromText(text: string): Wildcard | null {
  const stars = /^([A-Z]{2,4}) (\d)\*\*(?:\s*\(?\s*except.*)?$/.exec(text)
  if (stars) {
    const level = Number(stars[2]) * 100
    return withExcept({ subjects: [stars[1]], minLevel: level, maxLevel: level + 99 }, text)
  }
  const open = /^(?:([A-Z]{2,4}) ?-{0,3} ?)?(?:any|Any|ANY) (.+)$/.exec(text)
  if (!open) return null
  const rule = open[2].split(EXCEPT)[0]
  if (!/\b(?:courses?|class)\b/i.test(rule) || /\b(?:list|approv\w*|permission|not|GEP|up to)\b/i.test(rule)) return null
  const found = new RegExp(`\\b(${SUBJECTS}) (?:courses?|class)\\b`).exec(rule)
  const named = found ? subjectList(found[1]) : null
  const pointed = /\b(?:above|between) ([A-Z]{2,4}) \d/.exec(rule)?.[1]
  const subjects = open[1] ? [open[1]] : (named ?? (pointed ? [pointed] : []))
  const range = levelRange(rule)
  if (subjects.length === 0 || (!range && /\d/.test(rule))) return null
  return withExcept({ subjects, ...(range ?? {}) }, text)
}

const UNMODELED = new RegExp(
  [
    "\\bdifferent (?:disciplines|categories|areas|departments|groups|fields)\\b",
    "\\bfrom each\\b",
    "\\beach from\\b",
    "\\bone (?:course )?(?:from|in) each\\b",
    `\\b${NUM} or more (?:disciplines|departments|areas|categories)\\b`,
    `\\b${NUM} of the ${NUM}(?: [\\w-]+){0,3} (?:areas|categories|groups|disciplines|departments|lists|pathways|themes|pairs|regions|periods)\\b`,
  ].join("|"),
  "i",
)
const LEVELED = /\bnumbered\b|\babove \d{2,3}\b|\b\d{3}[- ]level\b|\b\d{3} or (?:higher|above)\b/i

const anchorOf = (href: string) => (href.startsWith("#") ? href.slice(1) : /^[\w-]+$/.test(href) ? href : "")

const key = (text: string) =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const STOP = new Set(["and", "of", "the", "a", "an", "in", "for", "or"])
const stems = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !STOP.has(word))
    .map((word) => word.replace(/s$/, ""))

export function codesFromText(text: string): string[][] | null {
  const bundle = "[A-Z]{2,4} \\d{3}[A-Z]?(?:/\\d{3}[A-Z]?)*"
  if (!new RegExp(`^${bundle}(?: or ${bundle})*$`).test(text)) return null
  return text.split(" or ").map((part) => {
    const [subject, numbers] = part.split(" ")
    return numbers.split("/").map((number) => `${subject} ${number}`)
  })
}

const CODE = "[A-Z&]{1,4}(?:/[A-Z&]{1,4})* \\d{3}[A-Z]?(?:/(?:[A-Z&]{1,4} )?\\d{3}[A-Z]?)*"
const CODES = new RegExp(`^${CODE}(?: or ${CODE})*$`)

export function splitCodes(code: string): string[] {
  const codes: string[] = []
  let waiting: string[] = []
  let subject = ""
  for (const part of code.split("/").map((piece) => piece.trim())) {
    const full = /^([A-Z&]+) (\d\w*)$/.exec(part)
    if (full) {
      for (const prefix of [...waiting, full[1]]) codes.push(`${prefix} ${full[2]}`)
      waiting = []
      subject = full[1]
    } else if (/^\d/.test(part)) {
      if (subject) codes.push(`${subject} ${part}`)
    } else {
      waiting.push(part)
    }
  }
  return codes
}

const labBundle = (codes: string[]) =>
  codes.some((code) => /\dL$/.test(code)) && new Set(codes.map((code) => code.split(" ")[0])).size === 1

type Listed = { entries: string[][][]; wildcards: Wildcard[] }

type Entry = { options: string[][]; raw: string }
type Comment = Extract<Row, { kind: "comment" }>

const range = (hours: HoursRange) => (hours.min === hours.max ? `${hours.min}` : `${hours.min}-${hours.max}`)

export function buildSections(tables: Table[], catalog: Catalog, idPrefix: string): Parsed {
  const issues: string[] = []
  const notes: string[] = []
  const issue = (text: string) => {
    if (!issues.includes(text)) issues.push(text)
  }
  const note = (text: string) => {
    if (!notes.includes(text)) notes.push(text)
  }
  if (tables.length === 0) {
    return {
      layout: "courselist",
      sections: [],
      totalHours: null,
      issues: ["No requirements table found on the page"],
      notes,
    }
  }
  const resolve = (code: string) => catalog.resolve?.(code) ?? code
  const main = tables[0]
  const lists = tables.slice(1)
  const used = new Set<Table>()
  const soft = new Set<string[]>()
  const pending: { slot: Slot; row: Comment }[] = []
  const hasTotal = (table: Table) => table.rows.some((row) => row.kind === "total")
  const findList = (text: string, href: string, skip?: Set<Table>): Table | undefined => {
    const target = anchorOf(href)
    const words = new Set(stems(text))
    const open = lists.filter((table) => !skip?.has(table))
    const list =
      open.find((table) => target && table.anchor === target) ??
      open.find((table) => table.heading && key(table.heading) === key(text)) ??
      open
        .map((table) => ({ table, title: stems(table.heading) }))
        .filter(({ title }) => title.length >= 2 && title.every((word) => words.has(word)))
        .sort((a, b) => b.title.length - a.title.length)[0]?.table
    if (list) used.add(list)
    return list
  }
  const variants = (code: string): string[][] => {
    const all = splitCodes(code)
    if (all.length < 2) return [[resolve(code)]]
    if (labBundle(all)) return [all]
    const known = all.filter((item) => catalog.hoursOf(item))
    return (known.length > 0 ? known : all).map((item) => [item])
  }
  const readList = (table: Table, seen: Set<Table>): Listed => {
    seen.add(table)
    const name = table.heading || "untitled"
    const entries: string[][][] = []
    const wildcards: Wildcard[] = []
    const unlinked: string[] = []
    const add = (options: string[][], or: boolean) => {
      const previous = entries.at(-1)
      if (or && previous) previous.push(...options)
      else entries.push(options)
    }
    for (const row of table.rows) {
      if (row.kind === "header" && UNMODELED.test(row.text)) issue(`List "${name}" has a rule that cannot be checked automatically: "${row.text}"`)
      if (row.kind === "course") {
        add(row.options.flatMap((option) => (option.length === 1 ? variants(option[0]) : [option.map(resolve)])), row.or)
        continue
      }
      if (row.kind !== "comment") continue
      const text = row.text
      const written = (row.code || text).replace(/^or /i, "")
      if (CODES.test(written)) {
        const options = written.split(" or ").flatMap(variants)
        add(options, row.or || /^or /i.test(row.code || text))
        unlinked.push(written)
        for (const option of options) soft.add(option)
        continue
      }
      if (UNMODELED.test(text)) {
        issue(`List "${name}" has a rule that cannot be checked automatically: "${text}"`)
        continue
      }
      const wildcard = wildcardFromText(text)
      if (wildcard) {
        wildcards.push(wildcard)
        if (!wildcard.except && /\bexceptions?\b|\bfootnote\b/i.test(text)) {
          issue(`List "${name}" has an open-ended row with exceptions that could not be read: "${text}"`)
        }
        continue
      }
      const linked = anchorOf(row.href) !== ""
      const inner = linked || text.length <= 80 ? findList(text, row.href, new Set([table])) : undefined
      if (inner && seen.has(inner)) continue
      if (inner) {
        const content = readList(inner, seen)
        entries.push(...content.entries)
        wildcards.push(...content.wildcards)
        note(`List "${name}" includes the list "${inner.heading}" through its row "${text}"`)
      } else if (linked) {
        issue(`List "${name}" points to another list that could not be linked: "${text}"`)
      } else {
        note(`List "${name}" has a row that is not a course and was not read: "${text}"`)
      }
    }
    if (unlinked.length > 0) note(`List "${name}" has codes with no catalog link: ${[...new Set(unlinked)].join(", ")}`)
    return { entries, wildcards }
  }
  const listed = (table: Table) => {
    const content = readList(table, new Set())
    const seen = new Set<string>()
    const options: string[][] = []
    const groups: number[] = []
    let group = 0
    for (const entry of content.entries) {
      const unique = entry.filter((option, index) => entry.findIndex((other) => other.join("+") === option.join("+")) === index)
      const id = unique.map((option) => option.join("+")).join("|")
      if (seen.has(id)) continue
      seen.add(id)
      for (const option of unique) {
        options.push(option)
        groups.push(group)
      }
      group++
    }
    const wildcards = content.wildcards.filter(
      (item, index) => content.wildcards.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)) === index,
    )
    return { options, groups, grouped: options.length > group, wildcards }
  }
  const remark = (text: string, accepts: Accepts | null) => {
    if (accepts && mainClause(text) !== text) note(`Row has a further condition that is not checked: "${text}"`)
    if (!accepts && LEVELED.test(text) && /\b(?:courses?|electives?)\b/i.test(text)) {
      note(`Level-based elective is kept as text, so credit cannot fill it automatically: "${text}"`)
    }
  }
  let slotCount = 0
  const slot = (partial: Omit<Slot, "id" | "hoursEstimated"> & { hoursEstimated?: boolean }): Slot => ({
    hoursEstimated: false,
    ...partial,
    id: `${idPrefix}-s${++slotCount}`,
  })
  const optionHours = (option: string[]): HoursRange | null => {
    let min = 0
    let max = 0
    for (const code of option) {
      const hours = catalog.hoursOf(code)
      if (!hours) return null
      min += hours.min
      max += hours.max
    }
    return { min, max }
  }
  const fromEntry = (entry: Entry, hours: HoursRange | null): Slot => {
    const known = hours ?? optionHours(entry.options[0])
    return slot({
      kind: entry.options.length > 1 ? "one-of" : "course",
      label: entry.raw,
      options: entry.options,
      hours: known,
      hoursEstimated: !known,
      raw: entry.raw,
    })
  }

  const resolveGroup = (heading: Comment, children: Row[]): Slot[] => {
    const entries: Entry[] = []
    for (const child of children) {
      if (child.kind === "comment") {
        const text = child.text
        const list = findList(text, child.href)
        const content = list && !codesFromText(text) ? listed(list) : null
        const options = codesFromText(text) ?? content?.options
        if (content?.wildcards.length) {
          note(`Group "${heading.text}" takes a list whose open-ended rows are not applied: "${text}"`)
        }
        if (options) {
          entries.push({ options, raw: child.raw })
        } else if (/:\s*$/.test(text) || /^or$/i.test(text) || /\bbelow\b/i.test(text)) {
          issue(`Group "${heading.text}" has a nested heading or list reference: "${text}"`)
        } else {
          note(`Group "${heading.text}" carries a note or open-ended option: "${text}"`)
        }
        continue
      }
      if (child.kind !== "course") continue
      const previous = entries.at(-1)
      if (child.or && previous) {
        previous.options.push(...child.options)
        previous.raw += ` ${child.raw}`
      } else {
        entries.push({ options: [...child.options], raw: child.raw })
      }
    }
    const hours = parseHours(heading.hours)
    const flat = entries.flatMap((entry) => entry.options)
    const altGroups = entries.flatMap((entry, index) => entry.options.map(() => index))
    const picked = pickFromText(heading.text)
    const group = (pick: Slot["pick"], kind: Slot["kind"]): Slot[] => {
      const built = slot({ kind, label: heading.text, options: flat, pick, hours, hoursEstimated: !hours, raw: heading.raw })
      if (kind === "pick-n" && flat.length > entries.length) built.altGroups = altGroups
      return [built]
    }
    if (entries.length === 0) {
      const accepts = acceptsFromText(heading.text)
      remark(heading.text, accepts)
      return [
        slot({
          kind: accepts ? "elective" : "text",
          label: heading.text,
          options: [],
          ...(accepts ? { accepts } : {}),
          hours,
          raw: heading.raw,
        }),
      ]
    }
    if (picked?.hours) return group({ hours: picked.hours }, "pick-n")
    if (picked?.count === 1) return group({ count: 1 }, "one-of")
    if (picked?.count) return group({ count: picked.count }, "pick-n")
    const each = entries.map((entry) => optionHours(entry.options[0]))
    const allKnown = each.every(Boolean)
    const sum = each.reduce((total, value) => total + (value?.min ?? 0), 0)
    if (hours && allKnown && sum >= hours.min && sum <= hours.max) {
      return entries.map((entry, index) => fromEntry(entry, each[index]))
    }
    if (hours && hours.min === hours.max && allKnown) {
      const size = each[0]!.min
      const count = hours.min / size
      if (each.every((value) => value!.min === size) && Number.isInteger(count) && count < entries.length) {
        return group({ count }, count === 1 ? "one-of" : "pick-n")
      }
    }
    if (hours && (!allKnown || sum > hours.max)) return group({ hours: hours.min }, "pick-n")
    issue(`Group meaning unclear (take all, one, or some?): "${heading.text}"`)
    return group(undefined, "pick-n")
  }

  const fromList = (row: Comment, list: Table, hours: HoursRange | null): Slot => {
    const pick = hours && hours.min === hours.max ? { hours: hours.min } : (pickFromText(row.text) ?? undefined)
    if (!pick) issue(`List "${row.text}" has no stated amount to take`)
    const content = listed(list)
    const built = slot({ kind: "pick-n", label: row.text, options: content.options, pick, hours, hoursEstimated: !hours, raw: row.raw })
    if (content.grouped) built.altGroups = content.groups
    if (content.wildcards.length > 0) built.wildcards = content.wildcards
    return built
  }

  const standalone = (row: Comment): Slot => {
    const hours = parseHours(row.hours)
    const codes = codesFromText(row.text)
    if (codes) {
      const known = hours ?? optionHours(codes[0])
      return slot({
        kind: codes.length > 1 ? "one-of" : "course",
        label: row.text,
        options: codes,
        hours: known,
        hoursEstimated: !known,
        raw: row.raw,
      })
    }
    const list = findList(row.text, row.href)
    if (list) return fromList(row, list, hours)
    const accepts = acceptsFromText(row.text)
    remark(row.text, accepts)
    if (accepts) {
      return slot({ kind: "elective", label: row.text, options: [], accepts, hours, hoursEstimated: !hours, raw: row.raw })
    }
    const built = slot({ kind: "text", label: row.text, options: [], hours, raw: row.raw })
    if (/\b(see|list|lists)\b.*\bbelow\b|\bfollowing list\b/i.test(row.text)) pending.push({ slot: built, row })
    else if (row.href.startsWith("#")) issue(`Row points to a list that could not be linked: "${row.text}"`)
    return built
  }

  const process = (table: Table, fallbackTitle: string): { sections: Section[]; total: HoursRange | null } => {
    for (const row of table.rows) {
      if (row.kind === "course") row.options = row.options.map((option) => option.map(resolve))
    }
    let section: Section = { title: fallbackTitle, core: false, slots: [] }
    const sections = [section]
    const state: { total: HoursRange | null; heading: Comment | null; children: Row[] } = {
      total: null,
      heading: null,
      children: [],
    }
    let sumMin = 0
    let sumMax = 0
    const flush = () => {
      if (state.heading) section.slots.push(...resolveGroup(state.heading, state.children))
      state.heading = null
      state.children = []
    }
    const indentedNext = (index: number) => {
      const next = table.rows[index + 1]
      return Boolean(next && (next.kind === "course" || next.kind === "comment") && next.indent)
    }
    table.rows.forEach((row, index) => {
      if (row.kind === "total") {
        flush()
        state.total = parseHours(row.hours)
        if (row.hours && !state.total) issue(`Unreadable total hours: "${row.hours}"`)
        return
      }
      if (row.hours) {
        const hours = parseHours(row.hours)
        if (hours) {
          sumMin += hours.min
          sumMax += hours.max
        } else {
          issue(`Unreadable hours "${row.hours}" on row: "${row.kind === "header" ? row.text : row.raw}"`)
        }
      }
      if (row.kind !== "course" && UNMODELED.test(row.text)) issue(`Rule cannot be checked automatically: "${row.text}"`)
      if (row.kind === "header") {
        flush()
        section = { title: row.text, core: /\bcore\b/i.test(row.text), slots: [] }
        sections.push(section)
        if (!row.hours) return
        const synthetic: Comment = { kind: "comment", text: row.text, code: "", hours: row.hours, indent: false, or: false, href: "", raw: `${row.text} ${row.hours}` }
        if (indentedNext(index)) state.heading = synthetic
        else section.slots.push(standalone(synthetic))
        return
      }
      if (row.indent && state.heading) {
        state.children.push(row)
        return
      }
      if (row.kind === "course" && row.or) {
        flush()
        const target = section.slots.at(-1)
        if (target && (target.kind === "course" || target.kind === "one-of")) {
          target.kind = "one-of"
          target.options.push(...row.options)
          target.label += ` ${row.raw}`
          target.raw += ` ${row.raw}`
        } else {
          issue(`Row that starts with or has nothing to attach to: "${row.raw}"`)
        }
        return
      }
      flush()
      if (row.indent) {
        if (row.kind === "comment" && !row.hours && !codesFromText(row.text)) {
          note(`Indented note: "${row.text}"`)
          return
        }
        issue(`Indented row without a group heading: "${row.raw}"`)
      }
      if (row.kind === "course") {
        const hours = parseHours(row.hours) ?? optionHours(row.options[0])
        section.slots.push(
          slot({
            kind: row.options.length > 1 ? "one-of" : "course",
            label: row.raw,
            options: row.options,
            hours,
            hoursEstimated: !hours,
            raw: row.raw,
          }),
        )
        return
      }
      if (indentedNext(index)) {
        state.heading = row
        return
      }
      if (!row.hours && FREE.test(row.text) && !acceptsFromText(row.text)) {
        note(`Sentence about free electives is kept as a note, not a requirement: "${row.text}"`)
        return
      }
      section.slots.push(standalone(row))
    })
    flush()
    const total = state.total
    if (total && (total.min < sumMin || total.max > sumMax)) {
      issue(`Row hours add up to ${range({ min: sumMin, max: sumMax })} but the table total says ${range(total)}`)
    }
    return { sections: sections.filter((item) => item.slots.length > 0), total }
  }

  const first = process(main, main.heading || "Requirements")
  const sections = [...first.sections]
  let totalHours = first.total
  if (!totalHours) issue("The requirements table states no total hours")
  if (main.layout === "plangrid") {
    issue("Requirements are given as a semester plan, not a requirement list; the degree total is not stated in one place")
  }
  for (const table of lists) {
    if (used.has(table) || !hasTotal(table) || table.layout !== "courselist") continue
    if (main.layout === "plangrid" || /\bGEP\b|general education/i.test(table.heading)) {
      used.add(table)
      const extra = process(table, table.heading || "Additional requirements")
      sections.push(...extra.sections)
      if (totalHours && extra.total) {
        totalHours = { min: totalHours.min + extra.total.min, max: totalHours.max + extra.total.max }
      }
    } else {
      issue(`The page has another requirement table with its own total ("${table.heading}") that is not included`)
    }
  }
  const unlinked = lists.filter((table) => !used.has(table) && !hasTotal(table))
  pending.forEach(({ slot: target, row }, index) => {
    if (pending.length !== unlinked.length) {
      issue(`Row points to a list that could not be linked: "${row.text}"`)
      return
    }
    const built = fromList(row, unlinked[index], target.hours)
    slotCount--
    Object.assign(target, { ...built, id: target.id })
    note(`Linked "${row.text}" to the list "${unlinked[index].heading}" by its position on the page`)
  })
  const unknownRequired = new Set<string>()
  const unknownListed = new Set<string>()
  for (const section of sections) {
    for (const item of section.slots) {
      for (const option of item.options) {
        for (const code of option) {
          if (catalog.hoursOf(code)) continue
          if ((item.kind === "course" || item.kind === "one-of") && !soft.has(option)) unknownRequired.add(code)
          else unknownListed.add(code)
        }
      }
    }
  }
  if (unknownRequired.size > 0) {
    issue(`Required course codes not found in the course catalog: ${[...unknownRequired].sort().join(", ")}`)
  }
  if (unknownListed.size > 0) {
    note(`Codes in choice lists not found in the course catalog: ${[...unknownListed].sort().join(", ")}`)
  }
  return { layout: main.layout, sections, totalHours, issues, notes }
}
