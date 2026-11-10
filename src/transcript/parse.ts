import type { GradeBand } from "../engine/index.ts"
import type { ApExam, NcssmCourse } from "../types.ts"

export type TranscriptCourse = {
  code: string
  title: string
  status: "completed" | "planned"
  grade: GradeBand | null
  rawGrade: string
  term: string
  matchedBy: "code" | "title"
  confident: boolean
  line: string
}
export type TranscriptExam = { id: string; score: number; line: string }
export type TranscriptResult = {
  courses: TranscriptCourse[]
  exams: TranscriptExam[]
  unread: string[]
  other: { code: string; title: string }[]
  apCourseHints: string[]
  campus: "durham" | "morganton" | null
  gradeLevel: "junior" | "senior" | null
}

type Kind = "letter" | "ip" | "pass" | "drop" | "num" | null
type Marks = Pick<TranscriptCourse, "status" | "grade" | "rawGrade" | "confident">
type Entry<T> = { item: T; tokens: string[] }
type TitleHit = { course: NcssmCourse; end: number; exact: boolean; clean: boolean } | "many" | null
type ExamHit = { id: string; score: number } | "many" | null

const ROMAN = new Map([
  ["i", "1"],
  ["ii", "2"],
  ["iii", "3"],
  ["iv", "4"],
])
const ABBREV = new Map<string, string[]>([
  ["adv", ["advanced"]],
  ["intro", ["introduction"]],
  ["calc", ["calculus"]],
  ["precalc", ["precalculus"]],
  ["stats", ["statistics"]],
  ["govt", ["government"]],
  ["hon", ["honors"]],
  ["us", ["united", "states"]],
])

const YEARS = String.raw`(?<!\d)(?:19|20)\d{2}\s*[-\u2013\/]\s*(?:(?:19|20)\d{2}|\d{2})\b`
const SEASON = String.raw`\b(?:fall|spring|summer|winter|autumn)\b(?:\s+(?:19|20)\d{2}\b)?`
const PART = String.raw`\b(?:semester|sem|term|trimester|quarter)\.?\s*[1-4]\b|\b[SQT][1-4]\b|\bj-?term\b`
const LEVEL = String.raw`\b(?:19|20)\d{2}\b|\bgrade\s*(?:9|1[0-2])\b|\b\d{1,2}(?:st|nd|rd|th)\s+grade\b|\b(?:freshman|sophomore|junior|senior)(?:\s+year)?\b`
const SPAN = new RegExp(`${YEARS}|${SEASON}|${PART}`, "gi")
const TERM = new RegExp(`${YEARS}|${SEASON}|${PART}|${LEVEL}`, "gi")
const FILLER =
  /\b(?:school|academic|year|term|session|courses?|coursework|ncssm|residential|online|durham|morganton|campus|in|progress|current|completed|schedule|level)\b/gi
const TESTS =
  /\b(?:ap\s+(?:exams?|scores?|tests?|results)|advanced placement|college board|test scores|standardized tests?|exam scores|score report)\b/i
const NOISE =
  /\b(?:student|name|dob|d\.o\.b|birth|birthdate|born|enroll date|graduation|ssn|id|address|phone|tel|e-?mail|parent|guardian|counselor|gpa|g\.p\.a|grade point|weighted|unweighted|cumulative|rank|quality points|honor roll|totals?|earned|attempted|avg|average|page \d+|printed|transcript|registrar|signature|issued|legend|grading scale)\b|@|https?:|www\.|=|\(\d{3}\)\s*\d{3}|\b\d{3}[-.]\d{3}[-.]\d{4}\b|,\s*[A-Z]{2}\s+\d{5}\b/i
const COLS = /^(?:course|code|title|subject|class)\b.*\b(?:grade|credits?|mark|title)\b/i
const HARD =
  /\b(?:gpa|g\.p\.a|birth|dob|ssn|page \d+|transcript)\b|@|https?:|www\.|=|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\d{6,}|,\s*[A-Z]{2}\s+\d{5}\b|\d+\.\d+/i
const REAL = /(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\s*-\s*\d{1,2}(?:st|nd|rd|th)\s+grade/i
const WRAP = 34
const PERSONAL = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\d{6,}/
const CODE = /(?<![A-Za-z0-9])([A-Z]{2,3})([ -]?)(\d{4})([A-Za-z]?)(?![A-Za-z0-9])/g
const NEUTRAL =
  /^(?:h|hn|hon|honors|ap|yr|fy|s[12]|q[1-4]|t[1-3]|sem|n\/a|\d{1,2}\/\d{2,4}(?:\/\d{2,4})?|(?:19|20)\d{2}[-\u2013\/]\d{2,4}|[^A-Za-z0-9]+)$/i
const LEAD = /^(?:\d[\d.\/\u2013-]*|fall|spring|summer|winter|autumn|s[12]|q[1-4]|t[1-3]|sem(?:ester)?\.?|term|[^A-Za-z0-9]+)$/i
const DATEISH =
  /^(?:(?:19|20)\d{2}|\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)[,.]?$/i
const FILL = /^(?:scores?:?|exam|algebra-?based|[^A-Za-z0-9]+)$/i
const SCORE = /^[1-5]$/

const tokenize = (text: string): string[] => text.match(/in[- ]progress|\S+/gi) ?? []
const squash = (text: string): string => text.replace(/\s+/g, " ").trim()
const cells = (text: string): string[] => text.split(/\s{2,}|\t/)

function normToken(raw: string): string[] {
  if (/^e[&\/]m\W*$/i.test(raw)) return ["electricity", "and", "magnetism"]
  return raw
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/\bu\.s\.?/g, "us")
    .replace(/\bw\//g, "with ")
    .replace(/[&+]/g, " and ")
    .replace(/\b(non|sub)-/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((t) => ABBREV.get(t) ?? [ROMAN.get(t) ?? t])
}

const words = (text: string): string[] => text.split(/\s+/).flatMap(normToken)

export function normalizeTitle(title: string): string {
  return words(title).join(" ")
}

export function gradeBand(raw: string): GradeBand | null {
  const t = raw.trim().toUpperCase()
  if (/^[A-DF][+-]?$/.test(t)) return /^(?:A|B\+)/.test(t) ? "B+" : t.startsWith("B") ? "B" : "below"
  if (!/^\d{1,3}(?:\.\d+)?%?$/.test(t)) return null
  const n = parseFloat(t)
  return n >= 87 ? "B+" : n >= 80 ? "B" : "below"
}

function kindOf(t: string): Kind {
  if (/^[A-DF][+-]?$/.test(t)) return "letter"
  if (/^(?:ip|inp|cur|current|in[- ]progress)$/i.test(t)) return "ip"
  if (/^(?:P|S|CR)$/.test(t) || /^(?:pass|passed|satisfactory)$/i.test(t)) return "pass"
  if (/^(?:W|WD|WP|WF|DR|DRP|INC|IF|FI|I\/F)$/.test(t) || /^(?:withdrawn|withdrew|dropped|incomplete|unsatisfactory)$/i.test(t)) return "drop"
  return /^\d+(?:\.\d+)?%?$/.test(t) ? "num" : null
}

const isTail = (t: string): boolean => kindOf(t) !== null || NEUTRAL.test(t)

function expand(raw: string[]): { norm: string[]; owner: number[] } {
  const norm: string[] = []
  const owner: number[] = []
  raw.forEach((t, i) =>
    normToken(t).forEach((n) => {
      norm.push(n)
      owner.push(i)
    }),
  )
  return { norm, owner }
}

function align(line: string[], cat: string[]): { k: number; exact: boolean } {
  let k = 0
  let exact = true
  for (; k < line.length && k < cat.length; k++) {
    if (line[k] === cat[k]) continue
    if (line[k].length < 3 || !/^[a-z]/.test(line[k]) || !cat[k].startsWith(line[k])) break
    exact = false
  }
  return { k, exact }
}

const used = (owner: number[], k: number): number =>
  k === 0 ? 0 : k < owner.length && owner[k] === owner[k - 1] ? -1 : owner[k - 1] + 1

function readMarks(tokens: string[], skip: string[], caps: Set<string>): Marks | null {
  const left = [...skip]
  const seen: { kind: Kind; raw: string; weak: boolean }[] = []
  tokens.forEach((raw, i) => {
    const kind = kindOf(raw)
    if (!kind || tokens[i - 1]?.endsWith(",")) return
    const single = /^[A-Z]$/.test(raw)
    const at = single ? left.indexOf(raw) : -1
    if (at >= 0) {
      left.splice(at, 1)
      return
    }
    const next = tokens[i + 1]
    seen.push({ kind, raw, weak: single && next !== undefined && /^[A-Za-z]{2,}/.test(next) && !isTail(next) })
  })
  const strong = seen.filter((s) => !s.weak)
  const of = (kind: Kind) => strong.filter((s) => s.kind === kind)
  const done = (rawGrade: string, grade: GradeBand | null, confident: boolean): Marks => ({
    status: "completed",
    grade,
    rawGrade,
    confident,
  })
  const ip = of("ip")
  if (ip.length) return { status: "planned", grade: null, rawGrade: ip[0].raw, confident: true }
  if (of("drop").length) return null
  const letters = of("letter")
  if (letters.length) {
    const last = letters[letters.length - 1].raw
    return done(last, gradeBand(last), letters.every((l) => gradeBand(l.raw) === gradeBand(last)))
  }
  const pass = of("pass")
  if (pass.length) return done(pass[0].raw, null, false)
  const weak = seen.filter((s) => s.weak && s.kind === "letter")
  if (weak.length) return done(weak[weak.length - 1].raw, gradeBand(weak[weak.length - 1].raw), false)
  const nums = of("num").filter((s) => /^\d{2,3}(?:\.\d+)?%?$/.test(s.raw) && parseFloat(s.raw) >= 50 && parseFloat(s.raw) <= 100)
  if (nums.length === 1) return done(nums[0].raw, gradeBand(nums[0].raw), false)
  if (nums.length > 1) return done(nums.map((n) => n.raw).join(" "), null, false)
  const odd = tokens.some((t) => /^[A-Z]{1,4}$/.test(t) && !isTail(t) && !caps.has(t) && !/^(?:I{1,3}|IV)$/.test(t))
  return { status: "planned", grade: null, rawGrade: "", confident: !odd && left.length === skip.length }
}

function termKey(term: string): number | null {
  const year = term.match(/(?:19|20)\d{2}/)
  if (!year) return null
  const low = term.toLowerCase()
  const range = /(?:19|20)\d{2}\s*[-\u2013\/]\s*\d{2,4}/.test(term)
  const part = /spring|(?:semester|sem\.?)\s*2|\bs2\b/.test(low)
    ? 3
    : /summer/.test(low)
      ? 4
      : /winter|j-?term/.test(low)
        ? 2
        : /fall|autumn|(?:semester|sem\.?)\s*1|\bs1\b/.test(low)
          ? 1
          : 9
  return (range || part === 1 || part === 9 ? Number(year[0]) : Number(year[0]) - 1) * 10 + part
}

const levelRe = (n: string, word: string): RegExp =>
  new RegExp(
    String.raw`\bgrade(?:\s*level)?\s*:?\s*${n}\b|\b${n}th\s+grade\b|\b(?:class|classification|standing|year|level)\s*:\s*${word}\b`,
    "i",
  )
const JUNIOR = levelRe("11", "junior")
const SENIOR = levelRe("12", "senior")

const rank = (c: TranscriptCourse): number =>
  c.status === "planned" ? 0 : c.grade === "B+" ? 4 : c.grade === "B" ? 3 : c.grade === "below" ? 2 : 1

export function parseTranscript(text: string, catalog: NcssmCourse[], exams: ApExam[]): TranscriptResult {
  const byCode = new Map<string, NcssmCourse>()
  for (const c of catalog) byCode.set(c.code.toUpperCase(), c)
  for (const c of catalog) for (const a of c.aliases) if (!byCode.has(a.toUpperCase())) byCode.set(a.toUpperCase(), c)
  const titles: Entry<NcssmCourse>[] = catalog.map((item) => ({ item, tokens: words(item.title) }))
  const pool: Entry<ApExam>[] = exams.map((item) => ({
    item,
    tokens: words(item.name).filter((t, i) => i > 0 || t !== "ap"),
  }))
  const lines: string[] = []
  const gap: boolean[] = []
  let blank = true
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim()
    if (/[A-Za-z0-9]/.test(l)) {
      lines.push(l)
      gap.push(blank)
    }
    blank = !/[A-Za-z0-9]/.test(l)
  }

  const identity = new Set<string>()
  lines.forEach((l, i) => {
    const m = l.match(/(?<!course |class |school |teacher )\b(?:student|name)\b\W*(.*)$/i)
    if (!m) return
    const value = /[a-z]{2}/i.test(m[1]) ? m[1] : (lines[i + 1] ?? "")
    for (const w of value.match(/[A-Za-z]{2,}/g) ?? []) identity.add(w.toLowerCase())
  })

  const found: TranscriptCourse[] = []
  const scores = new Map<string, TranscriptExam>()
  const unread = new Set<string>()
  const others = new Map<string, string>()
  const hints = new Set<string>()
  const campuses = new Set<string>()
  let junior = false
  let senior = false
  let term = ""
  let inTests = false
  let real = false
  let elsewhere = false
  let headed = false
  let i = 0
  let row = ""

  const codesIn = (line: string) =>
    [...line.matchAll(CODE)].flatMap((m) => {
      const text = m[1] + m[3] + m[4]
      const course = byCode.get(text.toUpperCase()) ?? (m[4] ? byCode.get(m[1] + m[3]) : undefined)
      if (m[2] && !course) return []
      return [{ at: m.index, end: m.index + m[0].length, text, course, sure: byCode.has(text.toUpperCase()) }]
    })
  const isNoise = (l: string) => {
    const hits = codesIn(l)
    return hits[0]?.at !== 0 && (NOISE.test(l) || COLS.test(l) || (PERSONAL.test(l) && !hits.length))
  }
  const isHeading = (l: string) =>
    (l.match(TERM) ?? []).length > 0 && !/[A-Za-z0-9]/.test(l.replace(TERM, " ").replace(FILLER, " "))
  const headingOf = (l: string) => {
    if (codesIn(l).length) return undefined
    const cut = isNoise(l) ? [...cells(l), l.slice(0, Math.max(0, l.search(NOISE)))].find(isHeading) : isHeading(l) ? l : undefined
    if (cut === undefined) return undefined
    const spans = [...cut.matchAll(TERM)]
    const last = spans[spans.length - 1]
    return squash(cut.slice(spans[0].index, last.index + last[0].length))
  }
  const isTests = (l: string) => TESTS.test(l) && !/(?:^|\s)[1-5](?:\s|$)/.test(l) && matchTitle(tokenize(l)) === null
  const free = (l: string | undefined): l is string =>
    l !== undefined && !isNoise(l) && !codesIn(l).length && !isHeading(l) && !isTests(l)
  const isOrphan = (l: string) => {
    const t = tokenize(l)
    return t.length <= 4 && t.every((x) => kindOf(x)) && t.filter((x) => kindOf(x) !== "num").length <= 1
  }
  const take = () => {
    const l = lines[++i]
    row += " " + l
    return " " + l
  }
  const absorb = () => {
    let out = ""
    for (let next = lines[i + 1]; free(next) && isOrphan(next); next = lines[i + 1]) {
      if (/^\d+$/.test(next) && (next.length > 3 || isTail(tokenize(row).at(-1) ?? ""))) break
      out += take()
    }
    return out
  }
  const level = (l: string, loose: boolean) => {
    if (SENIOR.test(l) || (loose && /\bsenior\b/i.test(l))) senior = true
    else if (JUNIOR.test(l) || (loose && /\bjunior\b/i.test(l))) junior = true
  }
  const place = (l: string) => {
    const m = l.match(/\b(durham|morganton)\b/i)
    if (!m || /\b(?:address|city|county|residence|home|birth|born)\b/i.test(l)) return
    const school = /ncssm|school of science|campus/i.test(l) || /^(?:durham|morganton)$/i.test(l)
    if (school || (!headed && /\b(?:durham|morganton),?\s+(?:NC|North Carolina)\b/i.test(l))) campuses.add(m[1].toLowerCase())
  }
  const termFor = () => {
    const inline = (row.match(SPAN) ?? []).map(squash).join(" ")
    return /\d{4}/.test(inline) || !term ? inline : inline ? `${term} ${inline}` : term
  }
  const caps = (c: NcssmCourse) => new Set(c.title.split(/\s+/).map((t) => t.replace(/[^A-Za-z]/g, "").toUpperCase()))
  const distinct = (list: { course: NcssmCourse }[]) => new Set(list.map((l) => l.course.code)).size
  const entry = (course: NcssmCourse, marks: Marks, matchedBy: "code" | "title", confident: boolean): TranscriptCourse => ({
    code: course.code,
    title: course.title,
    status: marks.status,
    grade: marks.grade,
    rawGrade: marks.rawGrade,
    term: termFor(),
    matchedBy,
    confident: marks.confident && confident,
    line: squash(row),
  })

  const hint = (title: string) => {
    if (!/^ap\b/i.test(title)) return
    const norm = words(title).slice(1)
    const hits = pool.flatMap((e) => {
      const a = align(norm, e.tokens)
      const full = a.k === e.tokens.length
      return e.item.group === "exam" && a.k && (full || a.k === norm.length) ? [{ id: e.item.id, k: a.k, full }] : []
    })
    const list = hits.some((h) => h.full) ? hits.filter((h) => h.full) : hits
    const most = Math.max(...list.map((h) => h.k))
    const top = list.filter((h) => h.k === most)
    if (top.length === 1) hints.add(top[0].id)
  }

  const matchTitle = (toks: string[]): TitleHit => {
    let start = 0
    while (start < toks.length && LEAD.test(toks[start])) start++
    const { norm, owner } = expand(toks.slice(start))
    const clean = (r: number) => toks.slice(start + r).every(isTail)
    const exact: { course: NcssmCourse; r: number; n: number }[] = []
    const fuzzy: { course: NcssmCourse; r: number; k: number; full: boolean }[] = []
    for (const e of titles) {
      const a = align(norm, e.tokens)
      const r = used(owner, a.k)
      const full = a.k === e.tokens.length
      if (!a.k || r < 0) continue
      if (a.exact && full) exact.push({ course: e.item, r, n: a.k })
      else if (a.k >= (full ? 2 : 3) && clean(r)) fuzzy.push({ course: e.item, r, k: a.k, full })
    }
    const longest = Math.max(...exact.map((e) => e.r))
    const best = exact.filter((e) => e.r === longest)
    if (best.length && (clean(longest) || !fuzzy.some((f) => f.r > longest))) {
      if (distinct(best) > 1) return "many"
      if (!clean(longest) && best[0].n < 2) return null
      return { course: best[0].course, end: start + longest, exact: true, clean: clean(longest) }
    }
    const most = Math.max(...fuzzy.map((f) => f.k))
    let top = fuzzy.filter((f) => f.k === most)
    if (distinct(top) > 1 && distinct(top.filter((f) => f.full)) === 1) top = top.filter((f) => f.full)
    if (!top.length) return null
    return distinct(top) > 1 ? "many" : { course: top[0].course, end: start + top[0].r, exact: false, clean: true }
  }

  const readExam = (toks: string[]): ExamHit => {
    let start = 0
    while (start < toks.length && (DATEISH.test(toks[start]) || /^(?:ap\W*|advanced|placement)$/i.test(toks[start]))) start++
    const rest = toks.slice(start)
    const digits = rest.filter((t) => SCORE.test(t))
    if (rest.some((t) => /sub-?score/i.test(t))) {
      const names = rest
        .filter((t) => !SCORE.test(t) && !DATEISH.test(t))
        .flatMap(normToken)
        .filter((w) => w !== "score" && w !== "ap")
      const subs = pool.filter((e) => e.item.group === "subscore" && names.every((w) => e.tokens.includes(w)))
      if (digits.length !== 1 || !subs.length) return null
      return subs.length > 1 ? "many" : { id: subs[0].item.id, score: Number(digits[0]) }
    }
    const { norm, owner } = expand(rest)
    const hits = pool.flatMap((e) => {
      const a = align(norm, e.tokens)
      const r = used(owner, a.k)
      const sure = a.exact && a.k === e.tokens.length
      if (!a.k || r < 0 || e.item.group === "subscore" || (!sure && e.item.group !== "exam")) return []
      const after = rest.slice(r)
      const got = after.filter((t) => SCORE.test(t))
      if (got.length !== 1 || !after.every((t) => SCORE.test(t) || DATEISH.test(t) || FILL.test(t))) return []
      return [{ id: e.item.id, score: Number(got[0]), k: a.k, sure }]
    })
    const list = hits.some((h) => h.sure) ? hits.filter((h) => h.sure) : hits
    const most = Math.max(...list.map((h) => h.k))
    const top = list.filter((h) => h.k === most)
    return top.length === 1 ? { id: top[0].id, score: top[0].score } : top.length ? "many" : null
  }
  const score = (exam: { id: string; score: number }) => {
    const had = scores.get(exam.id)
    if (!had || exam.score > had.score) scores.set(exam.id, { id: exam.id, score: exam.score, line: squash(row) })
  }

  const rowShaped = (toks: string[]) => {
    let j = toks.length
    while (j > 0 && isTail(toks[j - 1])) j--
    return (
      term !== "" &&
      toks.slice(0, j).some((t) => /[A-Za-z]{3}/.test(t)) &&
      toks.slice(j).some((t) => /^\d\.\d+$/.test(t) || /^[A-DF][+-]$/.test(t)) &&
      !toks.some((t) => identity.has(t.replace(/[^A-Za-z]/g, "").toLowerCase()))
    )
  }

  const schoolLike = (l: string) => {
    const toks = tokenize(l)
    const norm = words(l)
    return (
      !/\d/.test(l) &&
      !isTests(l) &&
      !/^ap\b/i.test(l) &&
      !/north carolina school of science|ncssm/i.test(l) &&
      /[A-Za-z]{3}/.test(l.replace(FILLER, " ")) &&
      !isTail(toks[toks.length - 1]) &&
      !titles.some((e) => align(norm, e.tokens).k >= 2) &&
      matchTitle(toks) === null
    )
  }

  type CodeHit = ReturnType<typeof codesIn>[number]

  const listedRow = (first: CodeHit, second: CodeHit) => {
    let title = squash(row.slice(first.end, second.at))
    const tail = tokenize(row.slice(second.end))
    const width = second.at - (row.slice(0, second.at).match(/\s*$/)?.[0].length ?? 0)
    for (let n = lines[i + 1]; n !== undefined && !gap[i + 1] && !codesIn(n).length && !HARD.test(n) && !isHeading(n); n = lines[i + 1]) {
      if (title.split(" ").length === squash(row.slice(first.end, second.at)).split(" ").length && width + tokenize(n)[0].length < WRAP) break
      title += " " + squash(n)
      i++
    }
    const marks = readMarks(tail, [], new Set())
    if (!marks) return
    hint(first.course?.title ?? title)
    if (first.course) found.push(entry(first.course, marks, "code", first.sure))
    else if (!others.has(first.text)) others.set(first.text, title)
  }

  const codeRow = (hits: CodeHit[]) => {
    const groups: CodeHit[][] = []
    for (const h of hits) {
      const prev = groups[groups.length - 1]
      if (prev && !/[A-Za-z0-9]/.test(row.slice(prev[prev.length - 1].end, h.at))) prev.push(h)
      else groups.push([h])
    }
    const out: { course: NcssmCourse; marks: Marks; sure: boolean }[] = []
    let missed = false
    groups.forEach((group, g) => {
      const hit = group.find((h) => h.course)
      if (!hit?.course) {
        missed = true
        return
      }
      const course = hit.course
      const cat = words(course.title)
      let seg = row.slice(group[group.length - 1].end, groups[g + 1]?.[0].at)
      let toks = tokenize(seg)
      let { norm, owner } = expand(toks)
      let a = align(norm, cat)
      const next = lines[i + 1]
      if (a.k < cat.length && g === groups.length - 1 && free(next)) {
        const b = align(expand([...toks, ...tokenize(next)]).norm, cat)
        if (b.k === cat.length && b.k > norm.length) {
          seg += take() + absorb()
          toks = tokenize(seg)
          ;({ norm, owner } = expand(toks))
          a = align(norm, cat)
        }
      }
      let k = a.k
      while (used(owner, k) < 0) k--
      const skip = cat.slice(k).flatMap((t) => (/^[a-z]$/.test(t) ? [t.toUpperCase()] : []))
      const marks = readMarks(toks.slice(used(owner, k)), skip, caps(course))
      if (marks) out.push({ course, marks, sure: hit.sure })
    })
    if (missed) unread.add(squash(row))
    for (const o of out) {
      hint(o.course.title)
      found.push(entry(o.course, o.marks, "code", o.sure))
    }
  }

  const titleRow = () => {
    let toks = tokenize(row)
    const rows = !real && !inTests
    let hit = rows ? matchTitle(toks) : null
    const next = lines[i + 1]
    if (rows && free(next)) {
      const joined = matchTitle([...toks, ...tokenize(next)])
      if (joined && joined !== "many" && joined.exact && joined.end > toks.length) {
        take()
        absorb()
        toks = tokenize(row)
        hit = matchTitle(toks)
      }
    }
    const ap = /^ap\b/i.test(row)
    const exam = inTests || ap || /sub-?score/i.test(row) ? readExam(toks) : null
    const listed = hit !== null && hit !== "many" && hit.exact && term !== "" && !inTests
    if (exam && exam !== "many" && !(listed && exam.score <= 2)) return score(exam)
    hint(cells(row)[0])
    if (hit === "many") {
      unread.add(squash(row))
      return
    }
    if (hit) {
      const tail = toks.slice(hit.end)
      const marks = readMarks(tail, [], new Set())
      if (!marks) return
      hint(hit.course.title)
      const plain = hit.exact && hit.clean && (tail.length > 0 || words(hit.course.title).length > 1)
      found.push(entry(hit.course, marks, "title", plain))
      return
    }
    if (exam === "many" || (ap && /\s[1-5]$/.test(row)) || rowShaped(toks)) unread.add(squash(row))
    else level(row, false)
  }

  for (; i < lines.length; i++) {
    row = lines[i]
    place(row)
    const heading = headingOf(row)
    if (heading !== undefined) {
      term = heading
      real ||= REAL.test(heading)
      inTests = false
      elsewhere = false
      headed = true
      level(heading, true)
      continue
    }
    if (isNoise(row)) {
      level(row, false)
      continue
    }
    let hits = codesIn(row)
    const twin = hits[0]?.at === 0 ? hits.slice(1).find((h) => h.text === hits[0].text) : undefined
    if (twin) {
      real = true
      elsewhere = false
      listedRow(hits[0], twin)
      continue
    }
    if (!hits.length && isTests(row)) {
      inTests = true
      elsewhere = false
      continue
    }
    if (real && !hits.length && schoolLike(row)) elsewhere = true
    if (elsewhere) {
      const exam = /^ap\b/i.test(row) ? readExam(tokenize(row)) : null
      if (exam && exam !== "many") score(exam)
      else hint(cells(row)[0])
      continue
    }
    if (hits.length && !/[A-Za-z0-9]/.test(row.replace(CODE, "")) && free(lines[i + 1])) take()
    absorb()
    hits = codesIn(row)
    if (hits.length) codeRow(hits)
    else titleRow()
  }

  const latest = Math.max(...found.flatMap((c) => (c.status === "completed" ? [termKey(c.term) ?? -Infinity] : [])))
  const best = new Map<string, TranscriptCourse>()
  for (const c of found) {
    const key = termKey(c.term)
    if (c.status === "planned" && c.rawGrade === "" && key !== null && key < latest) c.confident = false
    const had = best.get(c.code)
    if (!had || rank(c) > rank(had)) best.set(c.code, c)
  }

  return {
    courses: [...best.values()],
    exams: [...scores.values()],
    unread: [...unread],
    other: [...others].map(([code, title]) => ({ code, title })),
    apCourseHints: [...hints].filter((id) => !scores.has(id)),
    campus: campuses.size === 1 ? ([...campuses][0] as "durham" | "morganton") : null,
    gradeLevel: senior ? "senior" : junior ? "junior" : null,
  }
}
