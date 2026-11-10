import { test } from "node:test"
import assert from "node:assert/strict"
import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { parseCsv } from "../scripts/lib/csv.ts"
import { parseCourseCell, parseEquivalency } from "../scripts/articulation.ts"
import { readCatalogs, splitTitle } from "../scripts/ncssm-catalog.ts"
import { footnoteOf, parseCredit } from "../scripts/ap.ts"
import { noCreditWith } from "../scripts/college-courses.ts"
import { majorsReport, reasonLabel } from "../scripts/report.ts"
import { currentEdition, parseListing } from "../scripts/majors.ts"
import {
  acceptsFromText,
  buildSections,
  codesFromText,
  parseTables,
  pickFromText,
  wildcardFromText,
} from "../scripts/lib/courseleaf.ts"
import type { Major } from "../src/types.ts"

test("csv keeps quoted commas, escaped quotes, and multi-line cells", () => {
  const rows = parseCsv('a,"b, c","say ""hi"""\r\nd,"line one\nline two",f')
  assert.deepEqual(rows, [
    ["a", "b, c", 'say "hi"'],
    ["d", "line one\nline two", "f"],
  ])
})

test("catalog titles split into codes, title, and science markers", () => {
  assert.deepEqual(splitTitle("BI4030 Environmental Science (*R*)"), {
    codes: ["BI4030"],
    title: "Environmental Science",
    tags: ["research"],
  })
  assert.deepEqual(splitTitle("MA4200/CS4200 Cryptography")?.codes, ["MA4200", "CS4200"])
  assert.equal(splitTitle("MA4012- Calculus 1a")?.title, "Calculus 1a")
  assert.deepEqual(splitTitle("BI4210 AP Biology (I) (*R*)")?.tags, ["research"])
  assert.equal(splitTitle("MAxxxx Any Advanced Math Course"), null)
})

test("course cells yield every course code across separators", () => {
  assert.deepEqual(parseCourseCell("BI4210 AP Biology I/BI4211 AP Biology II").codes, ["BI4210", "BI4211"])
  assert.deepEqual(parseCourseCell("EE4000 Mechanical Engineering & EE4540 Statics").codes, ["EE4000", "EE4540"])
  assert.deepEqual(parseCourseCell("MA4050 Modeling + MA4220 Mathematical Modeling").codes, ["MA4050", "MA4220"])
  assert.deepEqual(parseCourseCell("SS4070 AP Macroeconomics\nSS4060 AP Microeconomics").codes, ["SS4070", "SS4060"])
  assert.deepEqual(parseCourseCell("MA4030: AP Calculus BC I/ MA4032: AP Calculus BC II").titles, {
    MA4030: "AP Calculus BC I",
    MA4032: "AP Calculus BC II",
  })
})

test("course cells keep former codes as aliases and set aside parenthetical codes", () => {
  const former = parseCourseCell("AS4051W (formerly AS4030a) Writing and American Studies I")
  assert.deepEqual(former.codes, ["AS4051W"])
  assert.deepEqual(former.former, { AS4051W: ["AS4030a"] })
  const cross = parseCourseCell("EN4203 African Studies: North Africa and the Middle East (EN4202)")
  assert.deepEqual(cross.codes, ["EN4203"])
  assert.deepEqual(cross.flags, ["parenthetical-code"])
})

test("equivalency cells normalize spacing but keep the raw code", () => {
  assert.deepEqual(
    parseEquivalency("CHEM101/CHEM101L/CHEM102/CHEM102L").awards.map((award) => award.code),
    ["CHEM 101", "CHEM 101L", "CHEM 102", "CHEM 102L"],
  )
  assert.deepEqual(
    parseEquivalency("PHYS 114, 115").awards.map((award) => award.code),
    ["PHYS 114", "PHYS 115"],
  )
  const typo = parseEquivalency("FCL 1** and FCL 101").awards
  assert.deepEqual(typo.map((award) => award.rawCode), ["FCL 1**", "FCL 101"])
})

test("generic credit codes are recognized in every source spelling", () => {
  const generic = (cell: string) => parseEquivalency(cell).awards[0]
  assert.deepEqual(generic("ARAB- - -"), { code: "ARAB ---", rawCode: "ARAB- - -", generic: { subject: "ARAB", level: null, gep: false } })
  assert.deepEqual(generic("MATH2---").generic, { subject: "MATH", level: 200, gep: false })
  assert.deepEqual(generic("CSC 2**"), { code: "CSC 2**", rawCode: "CSC 2**", generic: { subject: "CSC", level: 200, gep: false } })
  assert.deepEqual(generic("ECE ***").generic, { subject: "ECE", level: null, gep: false })
  assert.deepEqual(generic("ENG 2GEP").generic, { subject: "ENG", level: 200, gep: true })
  assert.equal(generic("Elective DRAM ---").code, "DRAM ---")
})

test("odd equivalency cells are flagged, never corrected", () => {
  assert.deepEqual(parseEquivalency("ENGL 150/").flags, ["dangling-separator"])
  const note = parseEquivalency("APPL 240\nStudents who took EE4020 and EE4560 should request credit by exam for BMME 207")
  assert.deepEqual(note.awards.map((award) => award.code), ["APPL 240"])
  assert.deepEqual(note.flags, ["free-text-note"])
  const prose = parseEquivalency("APPL 2-- for taking both EE 4000 and EE 4540; BMME 160")
  assert.deepEqual(prose.awards.map((award) => award.code), ["APPL 2--", "BMME 160"])
  assert.ok(prose.flags.includes("free-text-note"))
  assert.ok(parseEquivalency("IPUS 2GEPU").flags.includes("suspicious-code"))
})

test("AP credit cells separate credit from placement", () => {
  const french = parseCredit("French General Elective, FREN 203, and placement into FREN 204")
  assert.deepEqual(french.awards.map((award) => award.code), ["French General Elective", "FREN 203"])
  assert.equal(french.note, "Placement into FREN 204")
  assert.deepEqual(parseCredit("BIO 181, BIO 181 Lab, BIO 183 and BIO 183 Lab").awards.map((award) => award.code), ["BIO 181", "BIO 183"])
  assert.equal(parseCredit("ES 100 or MEA 100, depending on major").oneOf, true)
  assert.deepEqual(parseCredit("AFS 200-level GEP").awards[0].generic, { subject: "AFS", level: 200, gep: true })
})

test("program listings split name, degree, and concentration", () => {
  assert.deepEqual(parseListing("unc", "Computer Science Major, B.S."), { name: "Computer Science", degree: "B.S." })
  assert.deepEqual(parseListing("unc", "Biology Major, B.S.–Quantitative Biology Track"), {
    name: "Biology",
    degree: "B.S.",
    concentration: "Quantitative Biology Track",
  })
  assert.equal(parseListing("unc", "Music Major, Bachelor of Music (B.Mus.)")?.degree, "B.Mus.")
  assert.equal(parseListing("unc", "Chemistry Minor"), null)
  assert.equal(parseListing("unc", "Doctor of Dental Surgery, D.D.S."), null)
  assert.deepEqual(parseListing("ncsu", "Biological Sciences (BS): Human Biology Concentration"), {
    name: "Biological Sciences",
    degree: "BS",
    concentration: "Human Biology Concentration",
  })
  assert.equal(parseListing("ncsu", "Agribusiness Management (AAS)"), null)
  assert.equal(parseListing("ncsu", "Engineering First Year"), null)
})

test("catalog year rolls over in June", () => {
  assert.equal(currentEdition(new Date(2026, 10, 9)), "2026-2027")
  assert.equal(currentEdition(new Date(2027, 2, 1)), "2026-2027")
  assert.equal(currentEdition(new Date(2027, 5, 1)), "2027-2028")
})

test("group headings state how much to take", () => {
  assert.deepEqual(pickFromText("Select one of the following:"), { count: 1 })
  assert.deepEqual(pickFromText("Two from among the following five options:"), { count: 2 })
  assert.deepEqual(pickFromText("9 credits from the list below:"), { hours: 9 })
  assert.deepEqual(pickFromText("Nine (9) credits from the following"), { hours: 9 })
  assert.equal(pickFromText("Orientation Course(s):"), null)
  assert.equal(pickFromText("Other:"), null)
})

test("elective rows say what they accept", () => {
  assert.deepEqual(acceptsFromText("GEP Humanities"), { subjects: [], genEd: "GEP Humanities" })
  assert.deepEqual(acceptsFromText("GEP Global Knowledge (verify requirement)"), { subjects: [], genEd: "GEP Global Knowledge" })
  assert.deepEqual(acceptsFromText("ASTR --- Any ASTR course above 99"), { subjects: ["ASTR"], minLevel: 100 })
  assert.deepEqual(acceptsFromText("BUS 4**"), { subjects: ["BUS"], minLevel: 400 })
  assert.deepEqual(acceptsFromText("Five additional COMP courses numbered 420 or higher"), { subjects: ["COMP"], minLevel: 420 })
  assert.equal(acceptsFromText("Senior thesis approved by the advisor"), null)
})

test("unlinked code text is read as bundles and alternatives", () => {
  assert.deepEqual(codesFromText("ASTR 100/100L or ASTR 101/100L"), [
    ["ASTR 100", "ASTR 100L"],
    ["ASTR 101", "ASTR 100L"],
  ])
  assert.equal(codesFromText("An organismal structure course"), null)
})

const link = (code: string) => `<a class="bubblelink code" title="${code}">${code}</a>`
const course = (code: string, hours: string, extra = "") =>
  `<tr class="${extra}"><td class="codecol">${link(code)}</td><td>Title</td><td class="hourscol">${hours}</td></tr>`
const orRow = (code: string) => `<tr class="orclass"><td class="codecol orclass">or ${link(code)}</td><td colspan="2">Title</td></tr>`
const comment = (text: string, hours: string) =>
  `<tr><td colspan="2"><span class="courselistcomment">${text}</span></td><td class="hourscol">${hours}</td></tr>`
const child = (code: string, or = false) =>
  `<tr class="${or ? "orclass" : ""}"><td class="codecol"><div class="blockindent">${or ? "or " : ""}${link(code)}</div></td><td>Title</td><td class="hourscol"></td></tr>`

function build(rows: string, hours: Record<string, number>) {
  const html = `<div id="c"><table class="sc_courselist"><tbody>${rows}</tbody></table></div>`
  const $ = cheerio.load(html)
  const catalog = { hoursOf: (code: string) => (code in hours ? { min: hours[code], max: hours[code] } : null) }
  return buildSections(parseTables($, $("#c") as cheerio.Cheerio<Element>), catalog, "m")
}

test("requirement tables become required, one-of, and pick-N slots", () => {
  const parsed = build(
    [
      `<tr class="areaheader"><td colspan="2"><span class="courselistcomment areaheader">Core Requirements</span></td><td class="hourscol"></td></tr>`,
      course("COMP 210", "3"),
      course("COMP 283", "3"),
      orRow("MATH 381"),
      comment("Two of the following:", "6"),
      child("BIOL 220"),
      child("BIOL 240"),
      child("BIOL 250"),
      `<tr class="listsum"><td colspan="2">Total Hours</td><td class="hourscol">12</td></tr>`,
    ].join(""),
    { "COMP 210": 3, "COMP 283": 3, "MATH 381": 3, "BIOL 220": 3, "BIOL 240": 3, "BIOL 250": 3 },
  )
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(parsed.totalHours, { min: 12, max: 12 })
  assert.equal(parsed.sections[0].core, true)
  const slots = parsed.sections[0].slots
  assert.deepEqual(slots.map((slot) => slot.kind), ["course", "one-of", "pick-n"])
  assert.deepEqual(slots[1].options, [["COMP 283"], ["MATH 381"]])
  assert.deepEqual(slots[2].pick, { count: 2 })
})

test("a heading with no number is settled by hours: take all, or take one", () => {
  const all = build(
    [comment("Orientation Course(s):", "4"), child("E 101"), child("E 102"), child("E 115"), `<tr class="listsum"><td colspan="2">Total Hours</td><td class="hourscol">4</td></tr>`].join(""),
    { "E 101": 1, "E 102": 2, "E 115": 1 },
  )
  assert.deepEqual(all.issues, [])
  assert.deepEqual(all.sections[0].slots.map((slot) => slot.kind), ["course", "course", "course"])
  const one = build(
    [comment("Other:", "3"), child("EC 205"), child("EC 201", true), `<tr class="listsum"><td colspan="2">Total Hours</td><td class="hourscol">3</td></tr>`].join(""),
    { "EC 205": 3, "EC 201": 3 },
  )
  assert.deepEqual(one.sections[0].slots.map((slot) => slot.kind), ["one-of"])
  const unclear = build([comment("Related work:", "7"), child("AA 100"), child("BB 100")].join(""), { "AA 100": 3, "BB 100": 3 })
  assert.ok(unclear.issues.some((issue) => issue.startsWith("Group meaning unclear")))
})

test("a total that does not match its rows is reported", () => {
  const parsed = build(
    [course("COMP 210", "3"), `<tr class="listsum"><td colspan="2">Total Hours</td><td class="hourscol">10</td></tr>`].join(""),
    { "COMP 210": 3 },
  )
  assert.ok(parsed.issues.some((issue) => issue.includes("add up to 3")))
})

const table = (rows: string) => `<table class="sc_courselist"><tbody>${rows}</tbody></table>`
const total = (hours: string) => `<tr class="listsum"><td colspan="2">Total Hours</td><td class="hourscol">${hours}</td></tr>`
const titled = (id: string, title: string) => `<h3><a id="${id}"></a>${title}</h3>`
const pointer = (text: string, href: string, hours = "") =>
  `<tr><td colspan="2"><span class="courselistcomment"><a href="${href}">${text}</a></span></td><td class="hourscol">${hours}</td></tr>`
const bare = (code: string, title = "", hours = "3") =>
  `<tr><td class="codecol">${code}</td><td>${title}</td><td class="hourscol">${hours}</td></tr>`
const split = (code: string, text: string) =>
  `<tr><td class="codecol"><span class="courselistcomment">${code}</span></td><td><span class="courselistcomment">${text}</span></td><td class="hourscol">3</td></tr>`

function page(html: string, known: string[]) {
  const $ = cheerio.load(`<div id="c">${html}</div>`)
  const catalog = { hoursOf: (code: string) => (known.includes(code) ? { min: 3, max: 3 } : null) }
  return buildSections(parseTables($, $("#c") as cheerio.Cheerio<Element>), catalog, "m")
}
const slotsOf = (parsed: ReturnType<typeof page>) => parsed.sections.flatMap((section) => section.slots)

test("open-ended rows are read as wildcards", () => {
  assert.deepEqual(wildcardFromText("ASTR --- Any ASTR course above 99"), { subjects: ["ASTR"], minLevel: 100 })
  assert.deepEqual(wildcardFromText("BIOL --- Any BIOL course above 101, except BIOL 213"), {
    subjects: ["BIOL"],
    minLevel: 102,
    except: ["BIOL 213"],
  })
  assert.deepEqual(wildcardFromText("MATH --- Any MATH course above 110, except MATH 129P"), {
    subjects: ["MATH"],
    minLevel: 111,
    except: ["MATH 129P"],
  })
  assert.deepEqual(wildcardFromText("MAE 2**"), { subjects: ["MAE"], minLevel: 200, maxLevel: 299 })
  assert.deepEqual(wildcardFromText("ECE 3** (except for ECE 309)"), {
    subjects: ["ECE"],
    minLevel: 300,
    maxLevel: 399,
    except: ["ECE 309"],
  })
  assert.deepEqual(wildcardFromText("Any course between NSCI 300 - 699, with some exceptions (see footnote)"), {
    subjects: ["NSCI"],
    minLevel: 300,
    maxLevel: 699,
  })
  assert.deepEqual(wildcardFromText("Any 200+ Level BIO, BCH, or ZO course"), { subjects: ["BIO", "BCH", "ZO"], minLevel: 200 })
  assert.equal(wildcardFromText("DSA 200 or higher level courses, up to 3 credit hours"), null)
  assert.equal(wildcardFromText("Any ES or MEA 3**/4** Level Course"), null)
  assert.deepEqual(wildcardFromText("Any ES or MEA course, including additional lab courses."), { subjects: ["ES", "MEA"] })
  assert.equal(wildcardFromText("Any PHI course on the approved GEP Humanities list."), null)
  assert.equal(wildcardFromText("College of Science courses 400-level or higher with permission of advisor"), null)
})

test("a list keeps its open-ended rows as wildcards and notes the rows it cannot read", () => {
  const parsed = page(
    [
      table(pointer("Allied Electives", "#allied", "6") + total("6")),
      titled("allied", "Allied Electives"),
      table(
        [
          course("ANTH 143", "3"),
          split("ASTR ---", "Any ASTR course above 99"),
          comment("MAE 2**", ""),
          comment("EC 5**", ""),
          comment("Other electives with departmental approval", ""),
        ].join(""),
      ),
    ].join(""),
    ["ANTH 143"],
  )
  const [slot] = slotsOf(parsed)
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(slot.options, [["ANTH 143"]])
  assert.deepEqual(slot.wildcards, [
    { subjects: ["ASTR"], minLevel: 100 },
    { subjects: ["MAE"], minLevel: 200, maxLevel: 299 },
    { subjects: ["EC"], minLevel: 500, maxLevel: 599 },
  ])
  assert.ok(parsed.notes.some((note) => note.includes("Other electives with departmental approval")))
})

test("a wildcard whose exceptions sit in a footnote sends the major to review", () => {
  const parsed = page(
    [
      table(pointer("Knowledge Electives", "#k", "6") + total("6")),
      titled("k", "Knowledge Electives"),
      table(course("BIOL 205", "3") + comment("Any course between NSCI 300 - 699, with some exceptions (see footnote)", "")),
    ].join(""),
    ["BIOL 205"],
  )
  assert.deepEqual(slotsOf(parsed)[0].wildcards, [{ subjects: ["NSCI"], minLevel: 300, maxLevel: 699 }])
  assert.ok(parsed.issues.some((issue) => issue.includes("exceptions that could not be read")))
})

test("a list row that points at another list brings in that list", () => {
  const parsed = page(
    [
      table(pointer("Group A", "#a", "6") + pointer("Group B", "#b", "6") + total("12")),
      titled("core", "CSC Restricted Electives"),
      table(course("CSC 401", "3")),
      titled("a", "Group A"),
      table(pointer("Other Electives - Group B", "#b") + course("ACC 200", "3")),
      titled("b", "Group B"),
      table(comment("CSC Restricted Elective Courses", "1-6") + course("ACC 310", "3") + comment("BUS 4**", "")),
    ].join(""),
    ["CSC 401", "ACC 200", "ACC 310"],
  )
  const [a, b] = slotsOf(parsed)
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(a.options, [["CSC 401"], ["ACC 310"], ["ACC 200"]])
  assert.deepEqual(a.wildcards, [{ subjects: ["BUS"], minLevel: 400, maxLevel: 499 }])
  assert.deepEqual(b.options, [["CSC 401"], ["ACC 310"]])
  const broken = page(
    [table(pointer("Group A", "#a", "6") + total("6")), titled("a", "Group A"), table(pointer("Missing List", "#nowhere") + course("ACC 200", "3"))].join(""),
    ["ACC 200"],
  )
  assert.ok(broken.issues.some((issue) => issue.includes('points to another list that could not be linked: "Missing List"')))
  const orphan = page(table(pointer("Science Electives", "#gone", "3") + total("3")), [])
  assert.deepEqual(orphan.issues, ['Row points to a list that could not be linked: "Science Electives"'])
  const closest = page(
    [
      table(comment("Choose Advanced Science Electives", "3") + total("3")),
      titled("s", "Science Electives"),
      table(course("ES 100", "3")),
      titled("as", "Advanced Science Electives"),
      table(course("ES 400", "3")),
    ].join(""),
    ["ES 100", "ES 400"],
  )
  assert.deepEqual(slotsOf(closest)[0].options, [["ES 400"]])
})

test("a second table right after a list, with no heading of its own, continues that list", () => {
  const parsed = page(
    [
      table(pointer("Open/Technical Elective", "#open", "12") + total("12")),
      `<h3><a id="open"></a>Open/Tech Electives</h3><h3>Open Electives</h3><p>Choose from either table.</p>`,
      table(course("ECE 402", "3")) + table(course("ECE 302", "4")),
    ].join(""),
    ["ECE 402", "ECE 302"],
  )
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(slotsOf(parsed)[0].options, [["ECE 402"], ["ECE 302"]])
})

test("or pairs and cross-listed codes in a list share an alternative group", () => {
  const parsed = page(
    [
      table(pointer("Restricted Electives", "#re", "6") + total("6")),
      titled("re", "Restricted Electives"),
      table(course("CSC 406", "3") + orRow("CSC 506") + course("ECE 461/561", "3") + course("AFS/HI 275", "3") + course("MA 414", "3")),
    ].join(""),
    ["CSC 406", "CSC 506", "ECE 461", "ECE 561", "HI 275", "MA 414"],
  )
  const [slot] = slotsOf(parsed)
  assert.deepEqual(slot.options, [["CSC 406"], ["CSC 506"], ["ECE 461"], ["ECE 561"], ["HI 275"], ["MA 414"]])
  assert.deepEqual(slot.altGroups, [0, 0, 1, 1, 2, 3])
})

test("unlinked code rows in a list stay as options and are noted", () => {
  const parsed = page(
    [
      table(pointer("Chemistry Electives", "#ch", "6") + total("6")),
      titled("ch", "Chemistry Electives"),
      table(course("CH 721", "3") + bare("CH 713", "", "2") + bare("ECE 460/560") + bare("BMME 461", "Wearable Biosensors")),
    ].join(""),
    ["CH 721"],
  )
  const [slot] = slotsOf(parsed)
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(slot.options, [["CH 721"], ["CH 713"], ["ECE 460"], ["ECE 560"], ["BMME 461"]])
  assert.deepEqual(slot.altGroups, [0, 1, 2, 2, 3])
  assert.ok(parsed.notes.includes('List "Chemistry Electives" has codes with no catalog link: CH 713, ECE 460/560, BMME 461'))
})

test("level floors use the lowest listed level and set aside the at-least clause", () => {
  assert.deepEqual(
    acceptsFromText("Four ECON courses at the 400, 500, or 600 level, with at least one course numbered ECON 500 or higher"),
    { subjects: ["ECON"], minLevel: 400, maxLevel: 699 },
  )
  assert.deepEqual(acceptsFromText("At least three more MATH courses numbered above 500."), { subjects: ["MATH"], minLevel: 501 })
  assert.deepEqual(acceptsFromText("Six ECON courses numbered 200 to 699"), { subjects: ["ECON"], minLevel: 200, maxLevel: 699 })
  assert.deepEqual(acceptsFromText("Two PSYC and/or NSCI courses numbered between 395 and 699; may not include PSYC 493"), {
    subjects: ["PSYC", "NSCI"],
    minLevel: 395,
    maxLevel: 699,
    except: ["PSYC 493"],
  })
  assert.deepEqual(acceptsFromText("Four GEOG elective courses, at least two of which must be at the 400-level or above."), {
    subjects: ["GEOG"],
  })
  assert.equal(acceptsFromText("One advanced elective from CHEM 395 or any chemistry course numbered higher than CHEM 420 (at least 3 hours)"), null)
  assert.equal(acceptsFromText("Three COMM courses at the 400-600 level within a chosen pathway"), null)
  const parsed = build(
    comment("Four ECON courses at the 400, 500, or 600 level, with at least one course numbered ECON 500 or higher.", "12") + total("12"),
    {},
  )
  assert.equal(parsed.sections[0].slots[0].kind, "elective")
  assert.ok(parsed.notes.some((note) => note.startsWith("Row has a further condition that is not checked")))
  assert.equal(pickFromText("Africa or Diaspora - 400 Level Elective"), null)
})

test("a prose sentence about free electives is a note, not a second slot", () => {
  assert.deepEqual(acceptsFromText("Free Electives (12 Hr S/U Lmt)"), { subjects: ["*"] })
  assert.equal(acceptsFromText("Free electives courses cannot be CH 100, CH 111, MA 100, MA 101."), null)
  const parsed = build(
    [
      `<tr class="areaheader"><td colspan="2"><span class="courselistcomment areaheader">Free Electives</span></td><td class="hourscol">2</td></tr>`,
      comment("Free electives courses cannot be CH 100, CH 111, MA 100, MA 101, MA 107.", ""),
      total("2"),
    ].join(""),
    {},
  )
  const slots = parsed.sections.flatMap((section) => section.slots)
  assert.deepEqual(slots.map((slot) => [slot.kind, slot.hours]), [["elective", { min: 2, max: 2 }]])
  assert.ok(parsed.notes.some((note) => note.includes("Free electives courses cannot be CH 100")))
})

test("rules the parser cannot model send the major to review", () => {
  const group = build(
    [comment("Courses must be taken from two different disciplines", "8"), child("CH 101"), child("PY 205"), child("BIO 181"), total("8")].join(""),
    { "CH 101": 4, "PY 205": 4, "BIO 181": 4 },
  )
  assert.ok(group.issues.includes('Rule cannot be checked automatically: "Courses must be taken from two different disciplines"'))
  for (const text of [
    "One course below 400 from each of the following program areas:",
    "One course below 400 from two of the three following psychology program areas:",
    "At least one course from three of the four geographic areas (see course lists below)",
  ]) {
    const parsed = build(comment(text, "3") + total("3"), {})
    assert.ok(parsed.issues.some((issue) => issue.startsWith("Rule cannot be checked automatically")), text)
  }
  const plain = build([comment("Select one of the following:", "3"), child("EC 205"), child("EC 201"), total("3")].join(""), { "EC 205": 3, "EC 201": 3 })
  assert.deepEqual(plain.issues, [])
  const listed = page(
    [
      table(pointer("Social Science", "#soc", "9") + total("9")),
      titled("soc", "Social Sciences"),
      table(comment("12 credit hours required from 3 different disciplines, chosen from college approved list.", "") + course("ANT 251", "3")),
    ].join(""),
    ["ANT 251"],
  )
  assert.ok(listed.issues.some((issue) => issue.startsWith('List "Social Sciences" has a rule that cannot be checked automatically')))
})

test("a level-based elective named in words stays text and says so", () => {
  const parsed = build(comment("Four biology electives (each of three or more credits) numbered above 200", "14") + total("14"), {})
  assert.equal(parsed.sections[0].slots[0].kind, "text")
  assert.ok(parsed.notes.some((note) => note.includes("credit cannot fill it automatically")))
})

test("a course cross-listed in a different order on another campus is one record", () => {
  const item = (title: string) =>
    `<ul><li class="course_listing_selected"><span class="course_title">${title}</span><p class="course_body">Dept: Mathematics<br>Credits: 1</p></li></ul>`
  const source = (url: string) => ({ url, fetchedAt: "2026-11-09" })
  const result = readCatalogs([
    { campus: "durham", url: "d", body: item("MA4200/CS4200 Cryptography"), source: source("d") },
    { campus: "morganton", url: "m", body: item("CS4200/MA4200 Cryptography (*M*)"), source: source("m") },
  ])
  assert.equal(result.courses.length, 1)
  const [merged] = result.courses
  assert.deepEqual([merged.code, merged.aliases, merged.campuses, merged.tags], ["MA4200", ["CS4200"], ["durham", "morganton"], ["math-intensive"]])
  assert.deepEqual(merged.sources.map((entry) => entry.url), ["d", "m"])
  assert.deepEqual(result.perCampus, { durham: 1, morganton: 1, online: 0 })
})

test("course descriptions say which courses cannot both earn credit", () => {
  assert.deepEqual(noCreditWith("Corequisite: MA 141. Credit is not allowed for both PY 201 and PY 205 or PY 211.", "PY 201"), ["PY 205", "PY 211"])
  assert.deepEqual(noCreditWith("Credit not allowed for more than one of PY 211, PY 201 or PY 205", "PY 211"), ["PY 201", "PY 205"])
  assert.deepEqual(noCreditWith("Credit is not allowed for both PY 211 & PY 201 or PY 205", "PY 211"), ["PY 201", "PY 205"])
  assert.deepEqual(
    noCreditWith("Students may not receive credit for PHYS 114 in addition to PHYS 104, 116, or 118.", "PHYS 114"),
    ["PHYS 104", "PHYS 116", "PHYS 118"],
  )
  assert.deepEqual(noCreditWith("Students may not receive credit for both GERM 206 and GERM 203 or GERM 204.", "GERM 203"), ["GERM 206"])
  assert.deepEqual(noCreditWith("Credit will not be given for both CH 463 and CH 563.", "CH 563", ["CH 463", "CH 563"]), ["CH 463"])
  assert.deepEqual(noCreditWith("Credit will not be given for both HI (AFS) 475 and HI 575.", "AFS 475", ["HI 475", "AFS 475"]), ["HI 575"])
  assert.deepEqual(
    noCreditWith("Some programs do not allow for more than one of PY 201, PY 205, or PY 211 to be counted for credit toward degree requirements.", "PY 205"),
    [],
  )
  assert.deepEqual(noCreditWith("A student cannot receive credit for this course after receiving credit for MATH 152.", "MATH 231"), [])
  assert.deepEqual(noCreditWith("Credit is not allowed for both MA 403 and MA 407. Prerequisite: MA 225", "MA 305"), [])
})

test("the AP footnote is read from the footnote list under the chart", () => {
  const $ = cheerio.load(
    `<div><table class="sc_sctable"><tr><td>x</td></tr></table><dl class="sc_footnotes"><dt>*</dt><dd><p>Students who wish to continue Chinese, German, or Japanese at UNC must take a departmental placement exam.</p></dd></dl></div>`,
  )
  assert.equal(
    footnoteOf($, $("table.sc_sctable").first()),
    "Students who wish to continue Chinese, German, or Japanese at UNC must take a departmental placement exam.",
  )
})

test("review reasons are counted once per major under a readable label", () => {
  assert.equal(reasonLabel('Group "Two courses" has a nested heading or list reference: "One must be a lab:"'), "Group has a nested heading or list reference")
  assert.equal(reasonLabel('List "Electives" has no stated amount to take'), "List has no stated amount to take")
  assert.equal(reasonLabel("Row hours add up to 76-80 but the table total says 125-126"), "Row hours add up to N but the table total says N")
  assert.equal(reasonLabel("Required course codes not found in the course catalog: FOR 303, FOR 304"), "Required course codes not found in the course catalog")
  const review = (id: string, parseIssues: string[]) =>
    ({ id, university: "unc", name: id, degree: "B.A.", url: "", parseStatus: "needs-review", parseIssues }) as Major
  const report = majorsReport(
    [
      review("a", ['Group "X" has a nested heading or list reference: "One:"', 'Group "X" has a nested heading or list reference: "Two:"']),
      review("b", ['Group "Y" has a nested heading or list reference: "Three:"', 'List "Z" has no stated amount to take']),
    ],
    "2026-11-09",
  )
  assert.ok(report.includes("- 2: Group has a nested heading or list reference"))
  assert.ok(report.includes("- 1: List has no stated amount to take"))
})
