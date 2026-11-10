import { test } from "node:test"
import assert from "node:assert/strict"
import { evaluate, pickerCourses, recommend } from "../src/engine/index.ts"
import type { EngineData, GradeBand, Profile, Result } from "../src/engine/index.ts"
import type { ApExam, ApRule, Award, Campus, Major, NcssmCourse, Policies, Rule, Section, Slot } from "../src/types.ts"

const source = { url: "https://example.test/", fetchedAt: "2026-11-09" }
const quote = (text: string) => ({ quote: text, source })

const policies: Policies = {
  unc: {
    beLimits: { ...quote("BE limits"), majorCoreCourses: 2, focusCapacityCourses: 2 },
    halfCoreAtUnc: quote("Students must take at least half of their major core at UNC."),
    focusCapacities: quote("Focus Capacities"),
  },
  ncsu: { prefixAliases: { FLS: "WLSP" }, prefixEvidence: [], coda: { ...quote("CODA"), successCourses: [] } },
  ncssm: { markers: { research: "", mathIntensive: "", source } },
}

const exams: ApExam[] = [
  { id: "biology", name: "Biology", group: "exam" },
  { id: "microeconomics", name: "Microeconomics", group: "exam" },
  { id: "macroeconomics", name: "Macroeconomics", group: "exam" },
  { id: "statistics", name: "Statistics", group: "exam" },
  { id: "spanish-language", name: "Spanish Language and Culture", group: "exam" },
  { id: "environmental-science", name: "Environmental Science", group: "exam" },
  { id: "calculus-bc", name: "Calculus BC", group: "exam" },
  { id: "calculus-ab-subscore", name: "Calculus BC: AB subscore", group: "subscore" },
  { id: "physics-b", name: "Physics B", group: "retired" },
]

const course = (code: string, campuses: Campus[] = ["durham", "morganton"], aliases: string[] = []): NcssmCourse => ({
  code,
  aliases,
  title: `Title ${code}`,
  rawTitle: code,
  department: "Science",
  campuses,
  tags: [],
  sources: [source],
})

const award = (code: string, hours: number | null = 3): Award => ({
  code,
  rawCode: code,
  generic: null,
  hours,
  hoursEstimated: false,
})

const generic = (code: string, subject: string, level: number | null = null, gep = false): Award => ({
  code,
  rawCode: code,
  generic: { subject, level, gep },
  hours: null,
  hoursEstimated: true,
})

let row = 0

const rule = (ncssmCourses: string[], awards: Award[], extra: Partial<Rule> = {}): Rule => ({
  id: `r${++row}`,
  university: "unc",
  ncssmCourses,
  minGrade: "B-",
  awards,
  raw: { row, department: "", course: "", grade: "", equivalency: "", institution: "" },
  syllabusUrls: [],
  flags: [],
  source,
  ...extra,
})

const ap = (examIds: string[], minScore: number, awards: Award[], extra: Partial<ApRule> = {}): ApRule => ({
  id: `ap${++row}`,
  university: "unc",
  exams: examIds,
  examMode: "all",
  rawExam: examIds.join(" "),
  minScore,
  awards,
  rawCredit: "",
  rawHours: "",
  awardMode: "all",
  placementOnly: false,
  flags: [],
  source,
  ...extra,
})

const slot = (id: string, kind: Slot["kind"], options: string[][], extra: Partial<Slot> = {}): Slot => ({
  id,
  kind,
  label: id,
  options,
  hours: { min: 3, max: 3 },
  hoursEstimated: false,
  raw: id,
  ...extra,
})

const need = (id: string, code: string) => slot(id, "course", [[code]])
const section = (title: string, slots: Slot[], core = false): Section => ({ title, core, slots })

const major = (sections: Section[], extra: Partial<Major> = {}): Major => ({
  id: "m",
  university: "unc",
  name: "Test",
  degree: "B.S.",
  url: "",
  catalogYear: "2026-2027",
  isCurrentYear: true,
  layout: "courselist",
  totalHours: null,
  sections,
  parseStatus: "verified",
  parseIssues: [],
  parseNotes: [],
  entersViaCoda: false,
  professionalTrack: false,
  source,
  ...extra,
})

const data = (extra: Partial<EngineData>): EngineData => ({
  courses: [],
  rules: [],
  apRules: [],
  exams,
  policies,
  college: {},
  major: null,
  ...extra,
})

const profile = (extra: Partial<Profile>): Profile => ({
  campus: "durham",
  year: "senior",
  university: "unc",
  courses: [],
  exams: [],
  ...extra,
})

const done = (code: string, grade?: GradeBand) => ({ code, status: "completed" as const, grade })
const plan = (code: string) => ({ code, status: "planned" as const })
const took = (id: string, score: number) => ({ id, score, status: "taken" as const })
const sitting = (id: string, score: number) => ({ id, score, status: "planned" as const })

const mapped = (result: Result, label: string) => result.mapping.find((item) => item.label === label)!
const counted = (result: Result) =>
  result.mapping.flatMap((item) => item.credits.filter((credit) => credit.counted).map((credit) => credit.code))
const slots = (result: Result) => Object.fromEntries(result.checklist.flatMap((part) => part.slots.map((item) => [item.id, item])))
const statuses = (result: Result) =>
  Object.fromEntries(result.checklist.flatMap((part) => part.slots.map((item) => [item.id, item.status])))

test("campus filter keeps each campus to its own courses plus online", () => {
  const courses = [
    course("DUR1", ["durham"]),
    course("MOR1", ["morganton"]),
    course("ONL1", ["online"]),
    course("BOTH1", ["durham", "morganton"]),
    course("OLD1", []),
  ]
  const durham = pickerCourses(courses, "durham")
  const morganton = pickerCourses(courses, "morganton")
  assert.deepEqual(durham.current.map((item) => item.code), ["DUR1", "ONL1", "BOTH1"])
  assert.deepEqual(morganton.current.map((item) => item.code), ["MOR1", "ONL1", "BOTH1"])
  assert.deepEqual(durham.past.map((item) => item.code), ["OLD1"])
  assert.deepEqual(morganton.past.map((item) => item.code), ["OLD1"])
})

test("a combination rule beats the single-course rules it contains", () => {
  const rules = [
    rule(["BI4210"], [award("BIOL 100", 3)]),
    rule(["BI4211"], [award("BIOL 105", 3)]),
    rule(["BI4210", "BI4211"], [award("BIOL 101", 3), award("BIOL 101L", 1)]),
  ]
  const result = evaluate(profile({ courses: [done("BI4210"), done("BI4211")] }), data({ rules }))
  assert.deepEqual(counted(result), ["BIOL 101", "BIOL 101L"])
  assert.equal(result.totals.total, 4)
  assert.equal(mapped(result, "BI4210 + BI4211").outcome, "earned")
  assert.equal(mapped(result, "BI4210 + BI4211").hours, 4)
  const single = mapped(result, "BI4210")
  assert.equal(single.outcome, "replaced")
  assert.equal(single.hours, 0)
  assert.equal(single.reason, "Counted as part of the BI4210 + BI4211 combination instead.")
  assert.equal(mapped(result, "BI4211").outcome, "replaced")
})

test("a single-course rule still fires when its combination is incomplete", () => {
  const rules = [rule(["BI4210"], [award("BIOL 100", 3)]), rule(["BI4210", "BI4211"], [award("BIOL 101", 4)])]
  const result = evaluate(profile({ courses: [done("BI4210")] }), data({ rules }))
  assert.deepEqual(counted(result), ["BIOL 100"])
  assert.equal(result.mapping.length, 1)
})

test("a three-course combination beats a two-course one", () => {
  const rules = [
    rule(["EE1", "EE2"], [award("APPL 110", 3)]),
    rule(["EE1", "EE2", "EE3"], [award("APPL 240", 3), award("BMME 160", 3)]),
  ]
  const result = evaluate(profile({ courses: [done("EE1"), done("EE2"), done("EE3")] }), data({ rules }))
  assert.deepEqual(counted(result), ["APPL 240", "BMME 160"])
  assert.equal(mapped(result, "EE1 + EE2").outcome, "replaced")
  assert.equal(result.totals.total, 6)
})

test("rules with the same course set merge into one row without duplicates", () => {
  const rules = [
    rule(["MA4000"], [award("MATH 231", 4)]),
    rule(["MA4000"], [award("MATH 231", 4), generic("MATH ---", "MATH")]),
  ]
  const result = evaluate(profile({ courses: [done("MA4000")] }), data({ rules }))
  assert.equal(result.mapping.length, 1)
  assert.equal(result.mapping[0].id, `${rules[0].id}+${rules[1].id}`)
  assert.deepEqual(counted(result), ["MATH 231", "MATH ---"])
  assert.deepEqual(result.duplicates, [])
  assert.equal(result.totals.total, 7)
})

test("profile codes given as aliases resolve to the catalog course", () => {
  const courses = [course("AS4051W", ["durham"], ["AS4030a"])]
  const rules = [rule(["AS4051W"], [award("ENGL 105", 3)])]
  const result = evaluate(profile({ courses: [done("AS4030a")] }), data({ courses, rules }))
  assert.deepEqual(counted(result), ["ENGL 105"])
})

test("an unstated grade floor means B- or higher", () => {
  const rules = [rule(["CH4000"], [award("CHEM 101", 3)], { minGrade: null })]
  const grade = (band: GradeBand) => evaluate(profile({ courses: [done("CH4000", band)] }), data({ rules }))
  assert.equal(grade("B").totals.total, 3)
  assert.equal(grade("B+").totals.total, 3)
  const blocked = grade("below")
  assert.equal(blocked.totals.total, 0)
  assert.equal(blocked.mapping[0].outcome, "blocked")
  assert.equal(blocked.mapping[0].reason, "Needs a B- or higher in CH4000")
})

test("a B+ rule blocks a B and says why", () => {
  const rules = [rule(["PH4180"], [award("PHYS 118", 4)], { minGrade: "B+" })]
  const blocked = evaluate(profile({ courses: [done("PH4180", "B")] }), data({ rules }))
  assert.equal(blocked.totals.total, 0)
  assert.equal(blocked.mapping[0].outcome, "blocked")
  assert.equal(blocked.mapping[0].reason, "Needs a B+ or higher in PH4180")
  assert.equal(evaluate(profile({ courses: [done("PH4180", "B+")] }), data({ rules })).totals.earned, 4)
})

test("a completed course with no grade passes and a planned course is assumed to pass", () => {
  const rules = [rule(["PH4180"], [award("PHYS 118", 4)], { minGrade: "B+" })]
  const ungraded = evaluate(profile({ courses: [done("PH4180")] }), data({ rules }))
  assert.equal(ungraded.mapping[0].outcome, "earned")
  assert.equal(ungraded.totals.earned, 4)
  const planned = evaluate(profile({ courses: [plan("PH4180")] }), data({ rules }))
  assert.equal(planned.mapping[0].outcome, "planned")
  assert.deepEqual([planned.totals.earned, planned.totals.planned], [0, 4])
})

test("a blocked combination leaves its courses free for single rules", () => {
  const rules = [
    rule(["PH1"], [award("PHYS 114", 4)]),
    rule(["PH1", "PH2"], [award("PHYS 118", 4), award("PHYS 119", 4)], { minGrade: "B+" }),
  ]
  const result = evaluate(profile({ courses: [done("PH1", "B+"), done("PH2", "B")] }), data({ rules }))
  assert.deepEqual(counted(result), ["PHYS 114"])
  assert.equal(mapped(result, "PH1 + PH2").reason, "Needs a B+ or higher in PH2")
})

test("credit is earned only when every course in the rule is completed", () => {
  const rules = [rule(["BI4210", "BI4211"], [award("BIOL 101", 4)])]
  const result = evaluate(profile({ courses: [done("BI4210"), plan("BI4211")] }), data({ rules }))
  assert.equal(result.mapping[0].outcome, "planned")
  assert.deepEqual([result.totals.total, result.totals.earned, result.totals.planned], [4, 0, 4])
})

test("the same course from AP and from an NCSSM course counts once", () => {
  const input = data({
    rules: [rule(["BI4210"], [award("BIOL 101", 4)])],
    apRules: [ap(["biology"], 4, [award("BIOL 101", 4)])],
  })
  const result = evaluate(profile({ courses: [done("BI4210")], exams: [took("biology", 5)] }), input)
  assert.equal(result.totals.total, 4)
  assert.deepEqual(counted(result), ["BIOL 101"])
  assert.deepEqual(result.duplicates, [
    {
      code: "BIOL 101",
      from: "BI4210",
      keptFrom: "AP Biology",
      reason: "You already get BIOL 101 from AP Biology, so this adds no extra credit.",
    },
  ])
  assert.equal(mapped(result, "BI4210").hours, 0)
  assert.equal(mapped(result, "BI4210").credits[0].counted, false)
})

test("the same course from two NCSSM rules counts once", () => {
  const rules = [rule(["MA1"], [award("STOR 155", 3)]), rule(["MA2"], [award("STOR 155", 3)])]
  const result = evaluate(profile({ courses: [done("MA1"), done("MA2")] }), data({ rules }))
  assert.equal(result.totals.total, 3)
  assert.equal(result.duplicates.length, 1)
  assert.equal(result.duplicates[0].reason, "You already get STOR 155 from MA1, so this adds no extra credit.")
})

test("an earned credit is kept over a planned duplicate", () => {
  const input = data({
    rules: [rule(["BI4210"], [award("BIOL 101", 4)])],
    apRules: [ap(["biology"], 4, [award("BIOL 101", 4)])],
  })
  const result = evaluate(profile({ courses: [done("BI4210")], exams: [sitting("biology", 5)] }), input)
  assert.deepEqual([result.totals.total, result.totals.earned, result.totals.planned], [4, 4, 0])
  assert.equal(result.duplicates[0].from, "AP Biology")
  assert.equal(result.duplicates[0].keptFrom, "BI4210")
})

test("generic elective credit stacks and is counted apart from specific credit", () => {
  const rules = [
    rule(["MA1"], [generic("MATH ---", "MATH")]),
    rule(["MA2"], [generic("MATH ---", "MATH")]),
    rule(["MA3"], [award("MATH 231", 4)]),
  ]
  const result = evaluate(profile({ courses: [done("MA1"), done("MA2"), done("MA3")] }), data({ rules }))
  assert.deepEqual(result.duplicates, [])
  assert.deepEqual(result.totals, { total: 10, earned: 10, planned: 0, specific: 4, generic: 6, estimated: true })
})

test("hours come from the award, then the college catalog, then a flagged estimate", () => {
  const college = { "COMP 110": { title: "Intro", hours: 4, hoursMax: 4, genEd: [] } }
  const stated = evaluate(profile({ courses: [done("C1")] }), data({ rules: [rule(["C1"], [award("COMP 110", 3)])], college }))
  assert.deepEqual([stated.totals.total, stated.totals.estimated], [3, false])
  const looked = evaluate(profile({ courses: [done("C1")] }), data({ rules: [rule(["C1"], [award("COMP 110", null)])], college }))
  assert.deepEqual([looked.totals.total, looked.totals.estimated], [4, false])
  assert.equal(looked.mapping[0].credits[0].title, "Intro")
  const guessed = evaluate(profile({ courses: [done("C1")] }), data({ rules: [rule(["C1"], [award("COMP 999", null)])], college }))
  assert.deepEqual([guessed.totals.total, guessed.totals.estimated], [3, true])
})

test("NC State old and new prefixes are the same course", () => {
  const input = data({
    rules: [rule(["SP4000"], [award("FLS 201", 3)], { university: "ncsu" })],
    apRules: [ap(["spanish-language"], 4, [award("WLSP 201", 3)], { university: "ncsu" })],
  })
  const student = { university: "ncsu" as const, courses: [done("SP4000")], exams: [took("spanish-language", 4)] }
  const result = evaluate(profile(student), input)
  assert.equal(result.totals.total, 3)
  assert.deepEqual(counted(result), ["WLSP 201"])
  assert.equal(result.duplicates[0].code, "WLSP 201")
  const unc = evaluate(profile({ ...student, university: "unc" }), data({
    rules: [rule(["SP4000"], [award("FLS 201", 3)])],
    apRules: [ap(["spanish-language"], 4, [award("WLSP 201", 3)])],
  }))
  assert.equal(unc.totals.total, 6)
})

test("rules for the other university are ignored", () => {
  const input = data({
    rules: [rule(["BI4210"], [award("BIO 181", 4)], { university: "ncsu" })],
    apRules: [ap(["biology"], 3, [award("BIO 183", 4)], { university: "ncsu" })],
  })
  const result = evaluate(profile({ courses: [done("BI4210")], exams: [took("biology", 5)] }), input)
  assert.equal(result.totals.total, 0)
  assert.deepEqual(result.mapping, [])
})

test("AP credit uses the highest score tier the student meets", () => {
  const apRules = [
    ap(["biology"], 3, [award("BIOL 100", 3)]),
    ap(["biology"], 5, [award("BIOL 101", 3), award("BIOL 101L", 1)]),
  ]
  const at = (score: number) => evaluate(profile({ exams: [took("biology", score)] }), data({ apRules }))
  assert.deepEqual(counted(at(4)), ["BIOL 100"])
  assert.deepEqual(counted(at(5)), ["BIOL 101", "BIOL 101L"])
  assert.equal(at(5).mapping.length, 1)
  const low = at(2)
  assert.equal(low.totals.total, 0)
  assert.equal(low.mapping[0].outcome, "blocked")
  assert.equal(low.mapping[0].reason, "Needs a 3 or higher on AP Biology")
})

test("AP credit is earned for taken exams and planned for planned ones", () => {
  const apRules = [ap(["biology"], 3, [award("BIOL 101", 4)])]
  const taken = evaluate(profile({ exams: [took("biology", 4)] }), data({ apRules }))
  assert.deepEqual([taken.mapping[0].outcome, taken.totals.earned, taken.totals.planned], ["earned", 4, 0])
  const planned = evaluate(profile({ exams: [sitting("biology", 4)] }), data({ apRules }))
  assert.deepEqual([planned.mapping[0].outcome, planned.totals.earned, planned.totals.planned], ["planned", 0, 4])
})

test("both economics exams replace the either-exam row", () => {
  const pair = ["microeconomics", "macroeconomics"]
  const apRules = [
    ap(pair, 4, [award("ECON 100", 3)], { examMode: "any" }),
    ap(pair, 4, [award("ECON 100", 3), award("ECON 101", 3)]),
  ]
  const both = evaluate(profile({ exams: [took("microeconomics", 4), took("macroeconomics", 5)] }), data({ apRules }))
  assert.deepEqual(counted(both), ["ECON 100", "ECON 101"])
  assert.deepEqual(both.duplicates, [])
  assert.equal(both.mapping.length, 1)
  assert.equal(both.totals.total, 6)
  const one = evaluate(profile({ exams: [took("microeconomics", 4)] }), data({ apRules }))
  assert.deepEqual(counted(one), ["ECON 100"])
  assert.equal(one.mapping[0].label, "AP Microeconomics")
  const mixed = evaluate(profile({ exams: [took("microeconomics", 4), took("macroeconomics", 2)] }), data({ apRules }))
  assert.deepEqual(counted(mixed), ["ECON 100"])
})

test("a one-of AP award gives exactly one course, the smallest by default", () => {
  const apRules = [ap(["environmental-science"], 4, [award("ES 100", 4), award("MEA 100", 3)], { awardMode: "one-of" })]
  const student = profile({ exams: [took("environmental-science", 4)] })
  const result = evaluate(student, data({ apRules }))
  assert.deepEqual(counted(result), ["MEA 100"])
  assert.equal(result.totals.total, 3)
  assert.equal(result.mapping[0].reason, "You get one of ES 100 or MEA 100. Counting MEA 100 because it has the fewest hours.")
})

test("a one-of AP award prefers the course that fills an open major requirement", () => {
  const apRules = [ap(["environmental-science"], 4, [award("MEA 100", 3), award("ES 100", 4)], { awardMode: "one-of" })]
  const student = profile({ exams: [took("environmental-science", 4)] })
  const result = evaluate(student, data({ apRules, major: major([section("Core", [need("s1", "ES 100")])]) }))
  assert.deepEqual(counted(result), ["ES 100"])
  assert.equal(result.mapping[0].reason, "You get one of MEA 100 or ES 100. Counting ES 100 because it fills a requirement in your major.")
  assert.equal(statuses(result).s1, "covered")
})

test("placement-only AP rows give no hours", () => {
  const apRules = [ap(["calculus-bc"], 3, [award("MATH 231", 0)], { placementOnly: true, note: "Placement into MATH 232" })]
  const result = evaluate(profile({ exams: [took("calculus-bc", 3)] }), data({ apRules, major: major([section("Core", [need("s1", "MATH 231")])]) }))
  assert.equal(result.totals.total, 0)
  assert.equal(result.mapping[0].outcome, "placement")
  assert.equal(result.mapping[0].reason, "Placement into MATH 232")
  assert.equal(statuses(result).s1, "college")
})

test("checklist slots are covered, planned, open, or left for college", () => {
  const courses = [
    course("BI1"),
    course("CH1"),
    course("PH1", ["durham"]),
    course("MA1", ["morganton"]),
    course("ON1", ["online"]),
    course("OLD1", []),
  ]
  const input = data({
    courses,
    rules: [
      rule(["BI1"], [award("BIOL 101", 4)]),
      rule(["CH1"], [award("CHEM 101", 3)]),
      rule(["PH1"], [award("PHYS 118", 4)]),
      rule(["MA1"], [award("MATH 233", 3)]),
      rule(["ON1"], [award("ASTR 101", 3)]),
      rule(["OLD1"], [award("GEOL 101", 3)]),
    ],
    apRules: [ap(["statistics"], 3, [award("STOR 155", 3)]), ap(["physics-b"], 3, [award("PHYS 100", 3)])],
    major: major([
      section("Requirements", [
        need("covered", "BIOL 101"),
        need("planned", "CHEM 101"),
        need("open-course", "PHYS 118"),
        need("open-online", "ASTR 101"),
        need("open-exam", "STOR 155"),
        need("other-campus", "MATH 233"),
        need("past-course", "GEOL 101"),
        need("retired-exam", "PHYS 100"),
        need("no-route", "COMP 550"),
        slot("text", "text", []),
      ]),
    ], { university: "ncsu" }),
  })
  const result = evaluate(profile({ university: "ncsu", courses: [done("BI1"), plan("CH1")] }), {
    ...input,
    rules: input.rules.map((item) => ({ ...item, university: "ncsu" as const })),
    apRules: input.apRules.map((item) => ({ ...item, university: "ncsu" as const })),
  })
  assert.deepEqual(statuses(result), {
    covered: "covered",
    planned: "planned",
    "open-course": "open",
    "open-online": "open",
    "open-exam": "open",
    "other-campus": "college",
    "past-course": "college",
    "retired-exam": "college",
    "no-route": "college",
    text: "college",
  })
  assert.deepEqual(slots(result).covered.filledBy, ["BIOL 101"])
  assert.equal(result.checklist[0].title, "Requirements")
})

test("each credit fills at most one slot", () => {
  const input = data({
    rules: [rule(["BI1"], [award("BIOL 101", 4)])],
    major: major([section("A", [need("first", "BIOL 101"), need("second", "BIOL 101")])], { university: "ncsu" }),
  })
  input.rules[0].university = "ncsu"
  const result = evaluate(profile({ university: "ncsu", courses: [done("BI1")] }), input)
  assert.equal(statuses(result).first, "covered")
  assert.notEqual(statuses(result).second, "covered")
})

const ncsu = (rules: Rule[], sections: Section[], extra: Partial<EngineData> = {}) =>
  data({
    courses: rules.flatMap((item) => item.ncssmCourses.map((code) => course(code))),
    rules: rules.map((item) => ({ ...item, university: "ncsu" as const })),
    major: major(sections, { university: "ncsu" }),
    ...extra,
  })
const student = (...codes: string[]) => profile({ university: "ncsu", courses: codes.map((code) => done(code)) })

test("one-of slots need one whole option", () => {
  const rules = [rule(["C1"], [award("COMP 116", 3)]), rule(["CH1"], [award("CHEM 101", 3)])]
  const sections = [
    section("A", [
      slot("either", "one-of", [["COMP 110"], ["COMP 116"]]),
      slot("bundle", "one-of", [["CHEM 101", "CHEM 101L"], ["CHEM 102"]]),
    ]),
  ]
  const result = evaluate(student("C1", "CH1"), ncsu(rules, sections))
  assert.equal(slots(result).either.status, "covered")
  assert.deepEqual(slots(result).either.filledBy, ["COMP 116"])
  assert.notEqual(slots(result).bundle.status, "covered")
  assert.deepEqual(slots(result).bundle.filledBy, [])
})

test("pick-n by count treats alternatives in one group as a single pick", () => {
  const rules = [
    rule(["B1"], [award("BIOL 220", 3)]),
    rule(["B2"], [award("BIOL 221", 3)]),
    rule(["B3"], [award("BIOL 240", 3)]),
  ]
  const pick = slot("pick", "pick-n", [["BIOL 220"], ["BIOL 221"], ["BIOL 240"], ["BIOL 250"]], {
    pick: { count: 2 },
    altGroups: [0, 0, 1, 2],
  })
  const partial = evaluate(student("B1", "B2"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(partial).pick.progress, { have: 1, need: 2, unit: "courses" })
  assert.equal(slots(partial).pick.status, "open")
  const full = evaluate(student("B1", "B2", "B3"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(full).pick.progress, { have: 2, need: 2, unit: "courses" })
  assert.equal(slots(full).pick.status, "covered")
  assert.deepEqual(slots(full).pick.filledBy, ["BIOL 220", "BIOL 240"])
})

test("pick-n by hours adds up the hours of held options", () => {
  const rules = [rule(["B1"], [award("BIOL 220", 3)]), rule(["B2"], [award("BIOL 240", 4)])]
  const pick = slot("pick", "pick-n", [["BIOL 220"], ["BIOL 240"], ["BIOL 250"]], { pick: { hours: 6 } })
  const partial = evaluate(student("B1"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(partial).pick.progress, { have: 3, need: 6, unit: "hours" })
  assert.equal(slots(partial).pick.status, "open")
  const full = evaluate(student("B1", "B2"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(full).pick.progress, { have: 7, need: 6, unit: "hours" })
  assert.equal(slots(full).pick.status, "covered")
})

test("subject electives respect the minimum level", () => {
  const rules = [rule(["C1"], [award("COMP 110", 3)]), rule(["C2"], [award("COMP 210", 3)])]
  const elective = slot("elective", "elective", [], { accepts: { subjects: ["COMP"], minLevel: 200 } })
  const low = evaluate(student("C1"), ncsu(rules, [section("A", [elective])]))
  assert.equal(slots(low).elective.status, "open")
  assert.deepEqual(slots(low).elective.progress, { have: 0, need: 3, unit: "hours" })
  const high = evaluate(student("C1", "C2"), ncsu(rules, [section("A", [elective])]))
  assert.equal(slots(high).elective.status, "covered")
  assert.deepEqual(slots(high).elective.filledBy, ["COMP 210"])
})

test("electives fill up to their hours and report progress", () => {
  const rules = [rule(["C1"], [award("COMP 210", 3)]), rule(["C2"], [award("COMP 211", 3)]), rule(["C3"], [award("COMP 301", 3)])]
  const elective = slot("elective", "elective", [], { accepts: { subjects: ["COMP"] }, hours: { min: 6, max: 6 } })
  const spare = slot("spare", "elective", [], { accepts: { subjects: ["COMP"] } })
  const partial = evaluate(student("C1"), ncsu(rules, [section("A", [elective])]))
  assert.deepEqual(slots(partial).elective.progress, { have: 3, need: 6, unit: "hours" })
  assert.equal(slots(partial).elective.status, "open")
  const full = evaluate(student("C1", "C2", "C3"), ncsu(rules, [section("A", [elective, spare])]))
  assert.deepEqual(slots(full).elective.filledBy, ["COMP 210", "COMP 211"])
  assert.deepEqual(slots(full).spare.filledBy, ["COMP 301"])
})

test("an unfilled slot is open only when credit not yet held could still fill it", () => {
  const elective = slot("elective", "elective", [], { accepts: { subjects: ["COMP"] }, hours: { min: 6, max: 6 } })
  const one = [rule(["C1"], [award("COMP 210", 3)])]
  const stuck = evaluate(student("C1"), ncsu(one, [section("A", [elective])]))
  assert.deepEqual(slots(stuck).elective.progress, { have: 3, need: 6, unit: "hours" })
  assert.equal(slots(stuck).elective.status, "college")
  const more = evaluate(student("C1"), ncsu([...one, rule(["C2"], [award("COMP 211", 3)])], [section("A", [elective])]))
  assert.equal(slots(more).elective.status, "open")
  const apRules = [ap(["statistics"], 3, [award("COMP 210", 3)], { university: "ncsu" })]
  const sameCourse = evaluate(student("C1"), ncsu(one, [section("A", [elective])], { apRules }))
  assert.equal(slots(sameCourse).elective.status, "college")
})

test("GEP electives are filled by credits carrying the tag", () => {
  const college = {
    "ENG 251": { title: "Lit", hours: 3, hoursMax: 3, genEd: ["GEP Humanities"] },
    "PY 205": { title: "Physics", hours: 3, hoursMax: 3, genEd: ["GEP Natural Sciences"] },
    "E 115": { title: "Computing", hours: 1, hoursMax: 1, genEd: [] },
    "PSY 200": { title: "Psychology", hours: 3, hoursMax: 3, genEd: ["GEP Social Sciences"] },
  }
  const rules = [
    rule(["P1"], [award("PY 205", 3)]),
    rule(["E1"], [award("ENG 251", 3)]),
    rule(["X1"], [award("E 115", 3)]),
    rule(["S1"], [award("PSY 200", 3)]),
  ]
  const sections = [
    section("GEP", [
      slot("humanities", "elective", [], { accepts: { subjects: [], genEd: "GEP Humanities" } }),
      slot("any-gep", "elective", [], { accepts: { subjects: [], genEd: "GEP Elective" } }),
      slot("social", "elective", [], { accepts: { subjects: [], genEd: "GEP Social Sciences" } }),
      slot("second-gep", "elective", [], { accepts: { subjects: [], genEd: "GEP Elective" } }),
      slot("health", "elective", [], { accepts: { subjects: [], genEd: "GEP Health and Exercise Studies" } }),
    ]),
  ]
  const result = evaluate(student("P1", "E1", "X1"), ncsu(rules, sections, { college }))
  assert.deepEqual(slots(result).humanities.filledBy, ["ENG 251"])
  assert.deepEqual(slots(result)["any-gep"].filledBy, ["PY 205"])
  assert.equal(slots(result).social.status, "open")
  assert.deepEqual(slots(result)["second-gep"].filledBy, [])
  assert.equal(slots(result)["second-gep"].status, "open")
  assert.equal(slots(result).health.status, "college")
})

test("generic credit fills only elective slots that match its subject and level", () => {
  const rules = [
    rule(["M1"], [generic("MA 2**", "MA", 200)]),
    rule(["M2"], [generic("MA ---", "MA")]),
    rule(["E1"], [generic("ENG 2GEP", "ENG", 200, true)]),
  ]
  const sections = [
    section("A", [
      slot("free", "elective", [], { accepts: { subjects: ["*"] } }),
      need("course", "MA 241"),
      slot("leveled", "elective", [], { accepts: { subjects: ["MA"], minLevel: 200 } }),
      slot("leveled-again", "elective", [], { accepts: { subjects: ["MA"], minLevel: 200 } }),
      slot("any-level", "elective", [], { accepts: { subjects: ["MA"] } }),
      slot("humanities", "elective", [], { accepts: { subjects: [], genEd: "GEP Humanities" } }),
    ]),
  ]
  const college = { "ENG 2GEP": { title: "", hours: 4, hoursMax: 4, genEd: ["GEP Humanities"] } }
  const result = evaluate(student("M1", "M2", "E1"), ncsu(rules, sections, { college }))
  assert.equal(result.totals.generic, 9)
  assert.equal(result.totals.estimated, true)
  assert.deepEqual(slots(result).course.filledBy, [])
  assert.deepEqual(slots(result).leveled.filledBy, ["MA 2**"])
  assert.deepEqual(slots(result)["leveled-again"].filledBy, [])
  assert.deepEqual(slots(result)["any-level"].filledBy, ["MA ---"])
  assert.deepEqual(slots(result).humanities.filledBy, [])
  assert.deepEqual(slots(result).free.filledBy, ["ENG 2GEP"])
  assert.equal(slots(result).free.status, "covered")
})

test("free elective slots are filled last", () => {
  const rules = [rule(["C1"], [award("CSC 216", 3)]), rule(["C2"], [award("CSC 226", 3)])]
  const sections = [
    section("A", [
      slot("free", "elective", [], { accepts: { subjects: ["*"] } }),
      slot("subject", "elective", [], { accepts: { subjects: ["CSC"] } }),
      need("course", "CSC 216"),
    ]),
  ]
  const result = evaluate(student("C1", "C2"), ncsu(rules, sections))
  assert.deepEqual(slots(result).course.filledBy, ["CSC 216"])
  assert.deepEqual(slots(result).subject.filledBy, ["CSC 226"])
  assert.deepEqual(slots(result).free.filledBy, [])
  assert.equal(slots(result).free.status, "college")
})

const capRules = () => [
  rule(["K1"], [award("COMP 210", 3)]),
  rule(["K2"], [award("COMP 211", 3)]),
  rule(["K3"], [award("COMP 301", 3)]),
  rule(["K4"], [award("ENGL 105", 3)]),
]
const capStudent = profile({ courses: [done("K1"), done("K2"), done("K3"), done("K4")] })

test("UNC lets only two by-exam credits fill the major core", () => {
  const sections = [
    section("Core Requirements", [need("c1", "COMP 210"), need("c2", "COMP 211"), need("c3", "COMP 301")], true),
    section("Additional Requirements", [need("a1", "ENGL 105")]),
  ]
  const result = evaluate(capStudent, data({ rules: capRules(), major: major(sections) }))
  assert.deepEqual(statuses(result), { c1: "covered", c2: "covered", c3: "open", a1: "covered" })
  assert.equal(slots(result).c3.note, "You have credit that fits here, but UNC counts at most 2 credit-by-exam courses in the major core.")
  assert.equal(result.totals.total, 12)
  assert.ok(result.notes.some((note) => note.includes("not confirmed")))
  assert.ok(result.notes.includes("Students must take at least half of their major core at UNC."))
  assert.ok(!result.notes.some((note) => note.includes("does not label its core")))
})

test("with no core label every UNC section counts as core", () => {
  const sections = [
    section("Requirements", [need("c1", "COMP 210"), need("c2", "COMP 211")]),
    section("More", [need("c3", "COMP 301"), need("a1", "ENGL 105")]),
  ]
  const result = evaluate(capStudent, data({ rules: capRules(), major: major(sections) }))
  assert.deepEqual(statuses(result), { c1: "covered", c2: "covered", c3: "open", a1: "open" })
  assert.ok(result.notes.includes("This major's page does not label its core, so the limit is applied to every section."))
})

test("NC State has no by-exam cap and engineering majors get a CODA note", () => {
  const sections = [section("Core", [need("c1", "COMP 210"), need("c2", "COMP 211"), need("c3", "COMP 301")], true)]
  const rules = capRules().map((item) => ({ ...item, university: "ncsu" as const }))
  const input = data({ rules, major: major(sections, { university: "ncsu", entersViaCoda: true }) })
  const result = evaluate({ ...capStudent, university: "ncsu" }, input)
  assert.deepEqual(statuses(result), { c1: "covered", c2: "covered", c3: "covered" })
  assert.deepEqual(result.notes, ["At NC State, engineering majors enter the major through CODA (Change of Degree Audit)."])
  const plain = evaluate({ ...capStudent, university: "ncsu" }, { ...input, major: major(sections, { university: "ncsu" }) })
  assert.deepEqual(plain.notes, [])
})

test("too many Focus Capacity credits adds a note and a major needing review is flagged", () => {
  const tagged = (tag: string) => ({ title: "", hours: 3, hoursMax: 3, genEd: [tag] })
  const college = { "COMP 210": tagged("FC-QUANT"), "COMP 211": tagged("FC-QUANT"), "COMP 301": tagged("FC-LAB"), "ENGL 105": tagged("FY-SEMINAR") }
  const result = evaluate(capStudent, data({ rules: capRules(), college }))
  assert.deepEqual(result.notes, ["3 of your credits carry Focus Capacity tags. UNC lets at most 2 credit-by-exam courses count toward Focus Capacities."])
  assert.equal(result.needsReview, false)
  assert.deepEqual(result.checklist, [])
  const fewer = evaluate(profile({ courses: [done("K1"), done("K2")] }), data({ rules: capRules(), college }))
  assert.deepEqual(fewer.notes, [])
  const review = evaluate(capStudent, data({ rules: capRules(), major: major([], { parseStatus: "needs-review" }) }))
  assert.equal(review.needsReview, true)
})

const advice = () =>
  data({
    courses: [
      course("A1", ["durham"]),
      course("B1", ["durham"]),
      course("D1", ["durham"]),
      course("E1", ["online"]),
      course("F1", ["durham"]),
      course("H1", ["durham"]),
      course("M1", ["morganton"]),
      course("P1", []),
    ],
    rules: [
      rule(["B1"], [award("COMP 110", 3)]),
      rule(["D1", "E1"], [award("PHYS 118", 4), award("PHYS 119", 4)]),
      rule(["A1"], [award("BIOL 101", 4)]),
      rule(["F1"], [award("ENGL 105", 3)]),
      rule(["H1"], [award("ENGL 105", 3)]),
      rule(["M1"], [award("CHEM 101", 4)]),
      rule(["P1"], [award("ECON 101", 3)]),
    ],
    apRules: [
      ap(["statistics"], 3, [award("STOR 155", 3)]),
      ap(["statistics"], 5, [award("STOR 155", 3)]),
      ap(["calculus-bc"], 3, [award("MATH 231", 4)]),
      ap(["calculus-bc"], 5, [award("MATH 231", 4), award("MATH 232", 4)]),
      ap(["biology"], 3, [award("BIOL 101", 4)]),
      ap(["physics-b"], 3, [award("PHYS 100", 9)]),
      ap(["calculus-ab-subscore"], 3, [award("MATH 130", 9)]),
    ],
    major: major([section("Requirements", [need("bio", "BIOL 101"), need("chem", "CHEM 101"), need("econ", "ECON 101")])], {
      university: "ncsu",
    }),
  })

test("recommendations rank by requirements filled, then hours per course added", () => {
  const input = advice()
  for (const item of [...input.rules, ...input.apRules]) item.university = "ncsu"
  const recs = recommend(profile({ university: "ncsu", courses: [done("H1")], exams: [took("biology", 2)] }), input)
  assert.deepEqual(recs.map((rec) => rec.add.join("+")), ["A1", "calculus-bc", "D1+E1", "B1", "statistics"])
  const [first, calculus, pair, , statistics] = recs
  assert.equal(first.kind, "course")
  assert.deepEqual(first.fills, [{ slotId: "bio", section: "Requirements", label: "bio" }])
  assert.deepEqual(first.yields, [{ code: "BIOL 101", hours: 4 }])
  assert.equal(first.hoursGained, 4)
  assert.equal(first.text, "Take A1 Title A1. You would get BIOL 101 (4 hours). It fills 1 major requirement: bio.")
  assert.deepEqual([calculus.kind, calculus.minScore, calculus.hoursGained], ["exam", 5, 8])
  assert.equal(calculus.text, "Take the AP Calculus BC exam and score a 5. You would get MATH 231 (4 hours), MATH 232 (4 hours).")
  assert.equal(pair.hoursGained, 8)
  assert.equal(pair.label, "D1 Title D1 + E1 Title E1")
  assert.deepEqual([statistics.minScore, statistics.hoursGained], [3, 3])
  assert.equal(statistics.text, "Take the AP Statistics exam and score 3 or higher. You would get STOR 155 (3 hours).")
})

test("recommendations never include past, off-campus, held, retired, or zero-gain options", () => {
  const input = advice()
  for (const item of [...input.rules, ...input.apRules]) item.university = "ncsu"
  const recs = recommend(profile({ university: "ncsu", courses: [done("H1")], exams: [took("biology", 2)] }), input)
  const added = recs.flatMap((rec) => rec.add)
  for (const never of ["P1", "M1", "F1", "H1", "biology", "physics-b", "calculus-ab-subscore"]) {
    assert.ok(!added.includes(never), never)
  }
  const morganton = recommend(profile({ university: "ncsu", campus: "morganton" }), input).flatMap((rec) => rec.add)
  assert.ok(morganton.includes("M1"))
  assert.ok(!morganton.includes("A1"))
  assert.ok(!morganton.includes("D1"))
})

test("a recommendation adds only the missing courses of a combination", () => {
  const input = data({
    courses: [course("P1", []), course("A2", ["durham"])],
    rules: [rule(["P1", "A2"], [award("BIOL 101", 4), award("BIOL 102", 4)])],
  })
  const recs = recommend(profile({ courses: [done("P1")] }), input)
  assert.deepEqual(recs.map((rec) => rec.add), [["A2"]])
  assert.equal(recs[0].hoursGained, 8)
  assert.deepEqual(recommend(profile({}), input), [])
})

test("a pick slot is filled by a listed option or by credit that matches a wildcard", () => {
  const rules = [
    rule(["B1"], [award("BIOL 220", 3)]),
    rule(["M1"], [award("MATH 231", 4)]),
    rule(["M2"], [award("MATH 129", 3)]),
    rule(["M3"], [award("MATH 110", 3)]),
    rule(["E1"], [award("ECE 301", 3)]),
    rule(["E2"], [award("ECE 401", 3)]),
    rule(["G1"], [generic("MATH 2**", "MATH", 200)]),
  ]
  const pick = slot("pick", "pick-n", [["BIOL 220"]], {
    pick: { hours: 9 },
    wildcards: [
      { subjects: ["MATH"], minLevel: 111, except: ["MATH 129"] },
      { subjects: ["ECE"], minLevel: 300, maxLevel: 399 },
    ],
  })
  const none = evaluate(student("M2", "M3", "E2", "G1"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(none).pick.filledBy, [])
  assert.equal(slots(none).pick.status, "open")
  const some = evaluate(student("B1", "M1", "M2", "M3", "E2", "G1"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(some).pick.filledBy, ["BIOL 220", "MATH 231"])
  assert.deepEqual(slots(some).pick.progress, { have: 7, need: 9, unit: "hours" })
  const full = evaluate(student("B1", "M1", "E1"), ncsu(rules, [section("A", [pick])]))
  assert.deepEqual(slots(full).pick.filledBy, ["BIOL 220", "MATH 231", "ECE 301"])
  assert.equal(slots(full).pick.status, "covered")
  const counting = slot("count", "pick-n", [["BIOL 220"]], { pick: { count: 2 }, wildcards: [{ subjects: ["ECE"] }] })
  const byCount = evaluate(student("B1", "E2"), ncsu(rules, [section("A", [counting])]))
  assert.deepEqual(slots(byCount).count.progress, { have: 2, need: 2, unit: "courses" })
  const closed = evaluate(student("B1"), ncsu([rules[0]], [section("A", [pick])]))
  assert.equal(slots(closed).pick.status, "college")
})

test("a wildcard credit is used once across slots", () => {
  const rules = [rule(["E1"], [award("ECE 301", 3)])]
  const wild = (id: string) => slot(id, "pick-n", [], { pick: { hours: 3 }, wildcards: [{ subjects: ["ECE"], minLevel: 300, maxLevel: 399 }] })
  const result = evaluate(student("E1"), ncsu(rules, [section("A", [wild("first"), wild("second")])]))
  assert.deepEqual(statuses(result), { first: "covered", second: "college" })
})

const lite = (noCreditWith?: string[]) => ({ title: "", hours: 4, hoursMax: 4, genEd: [], ...(noCreditWith ? { noCreditWith } : {}) })
const physics = {
  "PY 201": lite(["PY 205", "PY 211"]),
  "PY 202": lite(["PY 208", "PY 212"]),
  "PY 205": lite(),
  "PY 208": lite(),
}

test("only one of two mutually exclusive courses counts, and the rule keeps its awards", () => {
  const rules = [rule(["PH1", "PH2"], [award("PY 201", 4), award("PY 202", 4), award("PY 205", 4), award("PY 208", 4)])]
  const input = ncsu(rules, [section("A", [need("first", "PY 201"), need("second", "PY 205")])], { college: physics })
  const result = evaluate(student("PH1", "PH2"), input)
  assert.deepEqual(counted(result), ["PY 201", "PY 202"])
  assert.equal(result.totals.total, 8)
  const row = mapped(result, "PH1 + PH2")
  assert.deepEqual(row.credits.map((credit) => credit.code), ["PY 201", "PY 202", "PY 205", "PY 208"])
  assert.equal(row.hours, 8)
  assert.deepEqual(
    row.credits.filter((credit) => !credit.counted).map((credit) => credit.reason),
    ["NC State does not give credit for both PY 201 and PY 205.", "NC State does not give credit for both PY 202 and PY 208."],
  )
  assert.deepEqual(statuses(result), { first: "covered", second: "college" })
})

test("between mutually exclusive courses, earned credit beats planned credit", () => {
  const rules = [rule(["A1"], [award("PY 201", 4)]), rule(["B1"], [award("PY 205", 4)])]
  const input = ncsu(rules, [], { college: physics })
  const result = evaluate(profile({ university: "ncsu", courses: [plan("A1"), done("B1")] }), input)
  assert.deepEqual(counted(result), ["PY 205"])
  assert.equal(mapped(result, "A1").credits[0].reason, "NC State does not give credit for both PY 205 and PY 201.")
  assert.deepEqual([result.totals.earned, result.totals.planned], [4, 0])
  const first = evaluate(profile({ university: "ncsu", courses: [done("A1"), done("B1")] }), input)
  assert.deepEqual(counted(first), ["PY 201"])
  const alone = evaluate(profile({ university: "ncsu", courses: [done("B1")] }), input)
  assert.deepEqual(counted(alone), ["PY 205"])
})
