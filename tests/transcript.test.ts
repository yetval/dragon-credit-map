import { test } from "node:test"
import assert from "node:assert/strict"
import { gradeBand, normalizeTitle, parseTranscript } from "../src/transcript/parse.ts"
import type { TranscriptCourse, TranscriptResult } from "../src/transcript/parse.ts"
import type { ApExam, NcssmCourse } from "../src/types.ts"

const course = (code: string, title: string, aliases: string[] = []): NcssmCourse => ({
  code,
  aliases,
  title,
  rawTitle: `${code} ${title}`,
  department: "Test",
  campuses: ["durham", "morganton"],
  tags: [],
  sources: [],
})

const catalog: NcssmCourse[] = [
  course("MA4060", "Multivariable Calculus"),
  course("MA4000", "Precalculus & Modeling w/ Advanced Topics I"),
  course("MA4042", "Calculus I"),
  course("MA4046", "Calculus II"),
  course("MA4510", "Research in Mathematics"),
  course("MA4512", "Research in Mathematics II"),
  course("AS4051", "American Studies I", ["AS4050a"]),
  course("CS4340", "Data Structures with C"),
  course("CS4320", "Machine Learning"),
  course("HU4455", "World War I: The Great War A Century Later"),
  course("PH4240", "AP Physics C: Mechanics"),
  course("PH4020", "Physics Core: Mechanics (Math Intensive)"),
  course("SS4050", "AP Psychology"),
  course("SS4060", "AP Microeconomics"),
  course("CH4020", "AP Chemistry (I): Atoms & Molecules"),
  course("EN4000", "Creative Writing"),
  course("EN4300", "Creative Writing"),
  course("BI4010", "Anatomy & Physiology"),
  course("AR4100", "Drawing"),
  course("MU4100", "Chorale"),
  course("PA1020", "Fit for Life"),
  course("SL1001", "Campus Service"),
  course("CN4151", "Navigating in Chinese"),
  course("CN4161", "Navigating in Chinese + Global Understanding I"),
]

const exams: ApExam[] = [
  { id: "calculus-ab", name: "Calculus AB", group: "exam" },
  { id: "calculus-bc", name: "Calculus BC", group: "exam" },
  { id: "calculus-ab-subscore", name: "Calculus BC: AB subscore", group: "subscore" },
  { id: "physics-1", name: "Physics 1", group: "exam" },
  { id: "physics-2", name: "Physics 2", group: "exam" },
  { id: "physics-b", name: "Physics B", group: "retired" },
  { id: "physics-c-em", name: "Physics C: Electricity and Magnetism", group: "exam" },
  { id: "physics-c-mechanics", name: "Physics C: Mechanics", group: "exam" },
  { id: "psychology", name: "Psychology", group: "exam" },
  { id: "microeconomics", name: "Microeconomics", group: "exam" },
  { id: "computer-science-a", name: "Computer Science A", group: "exam" },
  { id: "computer-science-principles", name: "Computer Science Principles", group: "exam" },
  { id: "spanish-language", name: "Spanish Language and Culture", group: "exam" },
  { id: "spanish-literature", name: "Spanish Literature and Culture", group: "exam" },
  { id: "us-history", name: "United States History", group: "exam" },
  { id: "chemistry", name: "Chemistry", group: "exam" },
]

const parse = (text: string): TranscriptResult => parseTranscript(text, catalog, exams)
const empty: TranscriptResult = {
  courses: [],
  exams: [],
  unread: [],
  other: [],
  apCourseHints: [],
  campus: null,
  gradeLevel: null,
}
const brief = (c: TranscriptCourse) => [c.code, c.status, c.grade, c.rawGrade, c.confident] as const
const briefs = (text: string) => parse(text).courses.map(brief)

test("grade bands and title normalization", () => {
  assert.deepEqual(
    ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F"].map(gradeBand),
    ["B+", "B+", "B+", "B+", "B", "B", "below", "below", "below", "below"],
  )
  assert.deepEqual(["100", "87", "86.9", "80", "79", "IP", "1.0x"].map(gradeBand), ["B+", "B+", "B", "B", "below", null, null])
  assert.equal(normalizeTitle("Precalc & Modeling w/ Adv Topics I"), "precalculus and modeling with advanced topics 1")
  assert.equal(normalizeTitle("Precalculus & Modeling w/ Advanced Topics I"), "precalculus and modeling with advanced topics 1")
  assert.equal(normalizeTitle("AP Chemistry (I): Atoms & Molecules"), "ap chemistry 1 atoms and molecules")
  assert.equal(normalizeTitle("Women's Literature"), "womens literature")
})

test("code and title rows under term headings", () => {
  const result = parse(
    [
      "2024-2025 Semester 1",
      "MA4042 Calculus I  A-  1.0",
      "AS4051 American Studies I  B  1.0",
      "2024-2025 Semester 2",
      "MA4046 Calculus II  C+  0.5",
    ].join("\n"),
  )
  assert.deepEqual(result, {
    ...empty,
    courses: [
      {
        code: "MA4042",
        title: "Calculus I",
        status: "completed",
        grade: "B+",
        rawGrade: "A-",
        term: "2024-2025 Semester 1",
        matchedBy: "code",
        confident: true,
        line: "MA4042 Calculus I A- 1.0",
      },
      {
        code: "AS4051",
        title: "American Studies I",
        status: "completed",
        grade: "B",
        rawGrade: "B",
        term: "2024-2025 Semester 1",
        matchedBy: "code",
        confident: true,
        line: "AS4051 American Studies I B 1.0",
      },
      {
        code: "MA4046",
        title: "Calculus II",
        status: "completed",
        grade: "below",
        rawGrade: "C+",
        term: "2024-2025 Semester 2",
        matchedBy: "code",
        confident: true,
        line: "MA4046 Calculus II C+ 0.5",
      },
    ],
  })
})

test("ragged spacing, a wrapped title, cells split across lines, and a term column", () => {
  const result = parse(
    [
      "Fall 2025",
      "MA4000     Precalculus & Modeling w/ Advanced",
      "           Topics I                              A-      1.0",
      "   MA4060 \t Multivariable    Calculus     B+   1.0",
      "CS4320",
      "Machine Learning",
      "B-",
      "1.0",
      "Spring 2026   MU4100   Chorale   A   0.5",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["MA4000", "completed", "B+", "A-", true],
    ["MA4060", "completed", "B+", "B+", true],
    ["CS4320", "completed", "B", "B-", true],
    ["MU4100", "completed", "B+", "A", true],
  ])
  assert.equal(result.courses[0].line, "MA4000 Precalculus & Modeling w/ Advanced Topics I A- 1.0")
  assert.equal(result.courses[2].line, "CS4320 Machine Learning B- 1.0")
  assert.deepEqual(result.courses.map((c) => c.term), ["Fall 2025", "Fall 2025", "Fall 2025", "Spring 2026"])
  assert.deepEqual(result.unread, [])
})

test("title only rows accept a unique match and flag anything short of identical", () => {
  const result = parse(
    [
      "Grade 11",
      "Multivariable Calculus    A    1.0",
      "Anatomy and Physiology    B-   1.0",
      "Precalc & Modeling with Adv Topics 1   B+  1.0",
      "Machine Learn   B   1.0",
      "Research in Mathematics",
      "II     A    1.0",
      "Navigating in Chinese + Global Underst. I   A-   1.0",
      "Creative Writing   A   1.0",
      "Research in   A   1.0",
      "English II   A-   1.0",
      "Calculus   A   1.0",
    ].join("\n"),
  )
  assert.deepEqual(
    result.courses.map((c) => [c.code, c.grade, c.matchedBy, c.confident, c.term]),
    [
      ["MA4060", "B+", "title", true, "Grade 11"],
      ["BI4010", "B", "title", true, "Grade 11"],
      ["MA4000", "B+", "title", true, "Grade 11"],
      ["CS4320", "B", "title", false, "Grade 11"],
      ["MA4512", "B+", "title", true, "Grade 11"],
      ["CN4161", "B+", "title", false, "Grade 11"],
    ],
  )
  assert.deepEqual(result.unread, ["Creative Writing A 1.0", "Research in A 1.0", "English II A- 1.0", "Calculus A 1.0"])
  assert.equal(result.gradeLevel, "junior")
})

test("in progress rows are planned", () => {
  const result = parse(
    [
      "2025-2026 Semester 1",
      "MA4060 Multivariable Calculus  A  1.0",
      "2025-2026 Semester 2",
      "CS4320 Machine Learning  IP  1.0",
      "BI4010 Anatomy & Physiology  In Progress",
      "MU4100 Chorale      1.0",
      "AR4100 Drawing  CUR",
      "Calculus II",
      "PA1020 Fit for Life   TR   1.0",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["MA4060", "completed", "B+", "A", true],
    ["CS4320", "planned", null, "IP", true],
    ["BI4010", "planned", null, "In Progress", true],
    ["MU4100", "planned", null, "", true],
    ["AR4100", "planned", null, "CUR", true],
    ["MA4046", "planned", null, "", true],
    ["PA1020", "planned", null, "", false],
  ])
})

test("a blank grade in a term older than the latest graded term is not trusted", () => {
  const result = parse(
    ["Fall 2024", "MU4100 Chorale  1.0", "Spring 2025", "MA4060 Multivariable Calculus  A  1.0", "Fall 2025", "AR4100 Drawing  1.0"].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["MU4100", "planned", null, "", false],
    ["MA4060", "completed", "B+", "A", true],
    ["AR4100", "planned", null, "", true],
  ])
})

test("pass marks are completed without a grade and withdrawn rows are dropped", () => {
  const result = parse(
    [
      "SL1001 Campus Service  P  0.0",
      "PA1020 Fit for Life  S",
      "MU4100 Chorale  CR  0.5",
      "AR4100 Drawing  Satisfactory",
      "CS4320 Machine Learning  W",
      "MA4046 Calculus II  WD  1.0",
      "MA4042 Calculus I  Withdrawn",
      "MA4060 Multivariable Calculus  Unsatisfactory",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["SL1001", "completed", null, "P", false],
    ["PA1020", "completed", null, "S", false],
    ["MU4100", "completed", null, "CR", false],
    ["AR4100", "completed", null, "Satisfactory", false],
  ])
  assert.deepEqual(result.unread, [])
})

test("numeric grades are banded and never confident", () => {
  assert.deepEqual(
    briefs(
      [
        "MA4060 Multivariable Calculus  93  1.0",
        "MA4046 Calculus II  84  1.0",
        "CS4320 Machine Learning  71.5  0.5",
        "MA4042 Calculus I  87  1.0",
        "AR4100 Drawing  95  91  1.0",
        "MU4100 Chorale  A  95  1.0",
      ].join("\n"),
    ),
    [
      ["MA4060", "completed", "B+", "93", false],
      ["MA4046", "completed", "B", "84", false],
      ["CS4320", "completed", "below", "71.5", false],
      ["MA4042", "completed", "B+", "87", false],
      ["AR4100", "completed", null, "95 91", false],
      ["MU4100", "completed", "B+", "A", true],
    ],
  )
})

test("credits, levels, section numbers, and teacher initials are not grades", () => {
  assert.deepEqual(
    briefs(
      [
        "MA4060 Multivariable Calculus  Smith, B  A-  1.0",
        "MA4046 Calculus II  J. Doe  1.0  B",
        "MA4042-01 Calculus I  H  1.0  0.5  4.000  C",
        "CS4320 Machine Learning  D. Poe  1.0",
        "AR4100 Drawing  12  1.0",
      ].join("\n"),
    ),
    [
      ["MA4060", "completed", "B+", "A-", true],
      ["MA4046", "completed", "B", "B", true],
      ["MA4042", "completed", "below", "C", true],
      ["CS4320", "planned", null, "", true],
      ["AR4100", "planned", null, "", true],
    ],
  )
})

test("former codes resolve to the canonical course and a section suffix is flagged", () => {
  const result = parse(["AS4050a American Studies I  A  1.0", "MA4060H Multivariable Calculus  B  1.0", "MA 4046 Calculus II  A  1.0"].join("\n"))
  assert.deepEqual(result.courses.map(brief), [
    ["AS4051", "completed", "B+", "A", true],
    ["MA4060", "completed", "B", "B", false],
    ["MA4046", "completed", "B+", "A", true],
  ])
  assert.equal(result.courses[0].title, "American Studies I")
})

test("an unknown code goes to unread with its line", () => {
  const result = parse(["Fall 2025", "ZZ9999 Underwater Basket Weaving   A   1.0", "MA4060 Multivariable Calculus  A  1.0"].join("\n"))
  assert.deepEqual(result.unread, ["ZZ9999 Underwater Basket Weaving A 1.0"])
  assert.deepEqual(result.courses.map((c) => c.code), ["MA4060"])
  assert.deepEqual(result.other, [])
})

test("the same course twice keeps the completed row with the better grade", () => {
  const result = parse(
    [
      "Fall 2024",
      "MA4060 Multivariable Calculus  B-  1.0",
      "CS4320 Machine Learning  IP",
      "AR4100 Drawing  A  1.0",
      "Spring 2025",
      "MA4060 Multivariable Calculus  A  1.0",
      "CS4320 Machine Learning  C  1.0",
      "AR4100 Drawing  B  1.0",
      "CS4200/MA4060 Multivariable Calculus  B+  1.0",
    ].join("\n"),
  )
  assert.deepEqual(
    result.courses.map((c) => [c.code, c.status, c.grade, c.term]),
    [
      ["MA4060", "completed", "B+", "Spring 2025"],
      ["CS4320", "completed", "below", "Spring 2025"],
      ["AR4100", "completed", "B+", "Fall 2024"],
    ],
  )
})

test("AP scores are read beside course rows named AP", () => {
  const result = parse(
    [
      "Fall 2025",
      "PH4240 AP Physics C: Mechanics  A-  1.0",
      "AP Psychology   A   1.0",
      "AP Microeconomics   IP",
      "AP Chemistry (I): Atoms & Molecules   1.0",
      "AP Exam Scores",
      "AP Calculus BC  5",
      "Calculus BC: AB Subscore  5",
      "May 2025  AP Physics C: Mechanics   Score: 4",
      "AP Calc AB  3",
      "AP Physics B 4",
      "AP Phys B 3",
      "AP Physics 3",
      "AP Spanish Language",
      "2",
      "AP U.S. History 5",
      "AP Psychology 4",
      "AP Psychology 5",
      "SAT Math 780",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["PH4240", "completed", "B+", "A-", true],
    ["SS4050", "completed", "B+", "A", true],
    ["SS4060", "planned", null, "IP", true],
    ["CH4020", "planned", null, "", true],
  ])
  assert.deepEqual(result.courses.map((c) => c.matchedBy), ["code", "title", "title", "title"])
  assert.deepEqual(result.exams, [
    { id: "calculus-bc", score: 5, line: "AP Calculus BC 5" },
    { id: "calculus-ab-subscore", score: 5, line: "Calculus BC: AB Subscore 5" },
    { id: "physics-c-mechanics", score: 4, line: "May 2025 AP Physics C: Mechanics Score: 4" },
    { id: "calculus-ab", score: 3, line: "AP Calc AB 3" },
    { id: "physics-b", score: 4, line: "AP Physics B 4" },
    { id: "spanish-language", score: 2, line: "AP Spanish Language 2" },
    { id: "us-history", score: 5, line: "AP U.S. History 5" },
    { id: "psychology", score: 5, line: "AP Psychology 5" },
  ])
  assert.deepEqual(result.unread, ["AP Phys B 3", "AP Physics 3"])
  assert.deepEqual(result.apCourseHints, ["microeconomics", "chemistry"])
})

test("an AP titled course row with a letter grade or a credit is never an exam score", () => {
  const result = parse(["Fall 2025", "AP Psychology   B+   1", "AP Microeconomics   1", "AP Calculus BC   A   1.0"].join("\n"))
  assert.deepEqual(result.exams, [])
  assert.deepEqual(result.courses.map(brief), [
    ["SS4050", "completed", "B+", "B+", true],
    ["SS4060", "planned", null, "", true],
  ])
  assert.deepEqual(result.unread, ["AP Calculus BC A 1.0"])
  assert.deepEqual(result.apCourseHints, ["psychology", "microeconomics", "calculus-bc"])
})

test("a single capital letter inside a title is not a grade", () => {
  const one = (line: string) => brief(parse(`Fall 2025\n${line}`).courses[0])
  assert.deepEqual(one("CS4340 Data Structures with C"), ["CS4340", "planned", null, "", true])
  assert.deepEqual(one("CS4340 Data Structures with C   1.0"), ["CS4340", "planned", null, "", true])
  assert.deepEqual(one("CS4340 Data Structures with C   A-   1.0"), ["CS4340", "completed", "B+", "A-", true])
  assert.deepEqual(one("CS4340 Data Structures with C   C   1.0"), ["CS4340", "completed", "below", "C", true])
  assert.deepEqual(one("CS4340 Data Struct w/ C   1.0"), ["CS4340", "planned", null, "", true])
  assert.deepEqual(one("CS4340 Data Struct w/ C   B   1.0"), ["CS4340", "completed", "B", "B", true])
  assert.deepEqual(one("CS4340 DS in C   1.0"), ["CS4340", "planned", null, "", false])
  assert.deepEqual(one("CS4340 DS in C   C   1.0"), ["CS4340", "completed", "below", "C", true])
  assert.deepEqual(one("HU4455 World War I: The Great War A Century Later"), ["HU4455", "planned", null, "", true])
  assert.deepEqual(one("HU4455 World War I: The Great War A Century Later  B  1.0"), ["HU4455", "completed", "B", "B", true])
  assert.deepEqual(one("HU4455 WWI: The Great War A Century Later  B+  1.0"), ["HU4455", "completed", "B+", "B+", true])
  assert.deepEqual(one("PH4240 AP Physics C Mechanics   1.0"), ["PH4240", "planned", null, "", true])
  assert.deepEqual(one("PH4240 AP Physics C Mechanics   B-   1.0"), ["PH4240", "completed", "B", "B-", true])
  assert.deepEqual(one("Data Structures with C"), ["CS4340", "planned", null, "", true])
  assert.deepEqual(one("Data Structures with C   A   1.0"), ["CS4340", "completed", "B+", "A", true])
  assert.deepEqual(one("World War I: The Great War A Century Later   0.5"), ["HU4455", "planned", null, "", true])
})

test("campus and grade level only when stated plainly", () => {
  assert.equal(parse("NCSSM Durham\nGrade 11\nMA4060 Multivariable Calculus A 1.0").campus, "durham")
  assert.equal(parse("Campus: Morganton\nMA4060 Multivariable Calculus A 1.0").campus, "morganton")
  assert.equal(parse("Address: 12 Oak St, Durham, NC 27701\nMA4060 Multivariable Calculus A").campus, null)
  assert.equal(parse("NCSSM Durham\nNCSSM Morganton").campus, null)
  assert.equal(parse("MA4060 Multivariable Calculus A").campus, null)
  assert.equal(parse("Grade 11\nMA4060 Multivariable Calculus A").gradeLevel, "junior")
  assert.equal(parse("Grade 11\nMA4060 Multivariable Calculus A\nGrade 12\nAR4100 Drawing").gradeLevel, "senior")
  assert.equal(parse("Senior Year\nAR4100 Drawing\nJunior Year\nMU4100 Chorale A").gradeLevel, "senior")
  assert.equal(parse("Name: Sam Sample   Grade: 12   ID: 5550001").gradeLevel, "senior")
  assert.equal(parse("Fall 2025\nMA4060 Multivariable Calculus A").gradeLevel, null)
  assert.equal(parse("MR4051 Mentorship: Senior Research II  A  1.0").gradeLevel, null)
})

test("an empty string and text with no courses return an empty result", () => {
  assert.deepEqual(parse(""), empty)
  assert.deepEqual(parse("   \n\n\t\n"), empty)
  assert.deepEqual(parse("Dear family,\nThank you for visiting our open house.\nSee you soon!"), empty)
})

test("page headers, legends, totals, and summaries are ignored", () => {
  const result = parse(
    [
      "Official Transcript   Page 1 of 2",
      "Course   Title   Grade   Credit",
      "Fall 2025",
      "MA4060 Multivariable Calculus  A  1.0",
      "Total Credits Earned: 5.0",
      "A = 90-100   B = 80-89   IP = In Progress",
      "IP In Progress   W Withdrawn",
      "Semester GPA 4.75",
      "Official Transcript   Page 2 of 2",
      "Course   Title   Grade   Credit",
      "3",
      "AR4100 Drawing  B+  0.5",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map(brief), [
    ["MA4060", "completed", "B+", "A", true],
    ["AR4100", "completed", "B+", "B+", true],
  ])
  assert.equal(result.courses[0].line, "MA4060 Multivariable Calculus A 1.0")
  assert.deepEqual(result.unread, [])
})

test("personal details never appear anywhere in the result", () => {
  const result = parse(
    [
      "North Carolina School of Science and Mathematics",
      "Student Name: Avery Quinn Testerson",
      "Student ID: 4471209",
      "Date of Birth: 03/14/2008",
      "Address: 12 Oak Lane, Cary, NC 27511",
      "Cumulative GPA: 4.62   Class Rank: 7 of 310",
      "2025-2026 Semester 1",
      "MA4060 Multivariable Calculus  A  1.0",
      "Testerson, Avery Q   12   4.62",
      "Avery Testerson   A-   1.0",
      "Underwater Basket Weaving   A-   1.0",
      "ZZ9999 Mystery Course   B   1.0",
      "Weighted 4.62   Unweighted 3.98",
      "03/14/2008",
      "4471209",
    ].join("\n"),
  )
  assert.deepEqual(result.courses.map((c) => c.code), ["MA4060"])
  assert.deepEqual(result.unread, ["Underwater Basket Weaving A- 1.0", "ZZ9999 Mystery Course B 1.0"])
  const json = JSON.stringify(result)
  for (const secret of ["Avery", "Quinn", "Testerson", "4471209", "03/14", "2008", "Oak", "27511", "4.62", "3.98", "310", "Rank", "GPA"]) {
    assert.equal(json.includes(secret), false, secret)
  }
})

const listed = [
  "Jordan Example                                                     Jordan Q Example",
  "                                                                   99S000000",
  "",
  "Birth date:            1/1/2009                                    North Carolina School of Science &",
  "Enroll date:           8/12/2025                                   Mathematics",
  "Expected graduation:   May 2027                                    901 Burkemont Avenue",
  "Cumulative GPA:        4.500                                       Morganton, NC 28655",
  "",
  "                                        Unofficial Transcript",
  "2026 - 2027 - 12th Grade",
  "",
  "2025 - 2026 - 11th Grade                                                            Year GPA: 4.500",
  "",
  "Course title                                Course code   Credit           Final Grade",
  "",
  "SEM0707 Forum: Topics in Experimental       SEM0707       0.00             Satisfactory",
  "Aerospace",
  "",
  "AS4051 American Studies I                   AS4051        2.00             B+",
  "",
  "PH4020 Physics Core: Mechanics (Math        PH4020        1.00             A",
  "Intensive) (*M*)",
  "",
  "MA4046 Calculus II                          MA4046        1.00             A",
  "",
  "PA1020 Fit for Life                         PA1020        1.00             A+",
  "",
  "SL1001 Campus Service                       SL1001        0.00             Satisfactory",
  "",
  "JT0388 Ctrl+Alt+Create: Hands on Hacking    JT0388        0.00             Satisfactory",
  "and Making for the Total Noob",
  "",
  "2024 - 2025 - 10th Grade",
  "",
  "Example High School",
  "",
  "AP Computer Science Principles              0A027         1.00             96",
  "",
  " 11/9/2026                                                                                 Page 1 of 2",
  "Example High School",
  "",
  "English III Honors                            10235   1.00               95",
  "",
  "Spanish II                                    11422   1.00               96",
  "",
  "AP Calculus AB                                2A007   1.00               96",
  "",
  "2023 - 2024 - 9th Grade",
  "",
  "Example High School",
  "",
  "Biology Honors                                33205   1.00               96",
  "",
  "______________________________________________________________________",
  "    GPA Previous School Weighted:         4.5",
  "    GPA Previous School Unweighted:       4",
  "",
  " 11/9/2026                                                                    Page 2 of 2",
].join("\n")

const year = "2025 - 2026 - 11th Grade"
const listedRow = (
  code: string,
  title: string,
  rawGrade: string,
  line: string,
  grade: TranscriptCourse["grade"] = "B+",
): TranscriptCourse => ({
  code,
  title,
  status: "completed",
  grade,
  rawGrade,
  term: year,
  matchedBy: "code",
  confident: grade !== null,
  line,
})
const listedResult: TranscriptResult = {
  courses: [
    listedRow("AS4051", "American Studies I", "B+", "AS4051 American Studies I AS4051 2.00 B+"),
    listedRow("PH4020", "Physics Core: Mechanics (Math Intensive)", "A", "PH4020 Physics Core: Mechanics (Math PH4020 1.00 A"),
    listedRow("MA4046", "Calculus II", "A", "MA4046 Calculus II MA4046 1.00 A"),
    listedRow("PA1020", "Fit for Life", "A+", "PA1020 Fit for Life PA1020 1.00 A+"),
    listedRow("SL1001", "Campus Service", "Satisfactory", "SL1001 Campus Service SL1001 0.00 Satisfactory", null),
  ],
  exams: [],
  unread: [],
  other: [
    { code: "SEM0707", title: "Forum: Topics in Experimental Aerospace" },
    { code: "JT0388", title: "Ctrl+Alt+Create: Hands on Hacking and Making for the Total Noob" },
  ],
  apCourseHints: ["computer-science-principles", "calculus-ab"],
  campus: "morganton",
  gradeLevel: "senior",
}

test("the real NCSSM layout: repeated code column, wrapped titles, other schools ignored", () => {
  assert.deepEqual(parse(listed), listedResult)
})

test("the real layout reads the same from a PDF extractor with no blank lines and from a single spaced paste", () => {
  const pages = listed.replace(" Page 1 of 2\n", " Page 1 of 2\n\f").split("\f")
  const extracted = pages
    .map((page) =>
      page
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => l.trim().replace(/\s{2,}/g, "   "))
        .join("\n"),
    )
    .join("\n\n")
  assert.deepEqual(parse(extracted), listedResult)
  const pasted = listed
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.trim().replace(/\s+/g, " "))
    .join("\n")
  assert.deepEqual(parse(pasted), listedResult)
})

test("the real layout returns nothing personal and nothing from another school", () => {
  const json = JSON.stringify(parse(listed))
  for (const secret of [
    "Jordan",
    "Example",
    "99S000000",
    "1/1/2009",
    "2009",
    "8/12",
    "2027",
    "4.5",
    "Burkemont",
    "28655",
    "11/9",
    "Page",
    "Course title",
    "Final Grade",
    "____",
    "GPA",
    "Birth",
    "Enroll",
    "graduation",
    "English III",
    "Spanish II",
    "Biology",
    "0A027",
    "10235",
    "96",
  ]) {
    assert.equal(json.includes(secret), false, secret)
  }
})

test("the real layout: grade level, campus, unsatisfactory, and catalog titles at another school", () => {
  const head = (address: string, years: string[]) =>
    ["Sam Sample   Sam T Sample", "Cumulative GPA:   3.900   " + address, "Unofficial Transcript", ...years].join("\n")
  const junior = parse(
    [
      head("Durham, NC 27705", ["2025 - 2026 - 11th Grade   Year GPA: 3.900"]),
      "Course title   Course code   Credit   Final Grade",
      "MA4060 Multivariable Calculus   MA4060   1.00   B-",
      "JT0101 Knitting for Beginners   JT0101   0.00   Unsatisfactory",
      "CS4320 Machine Learning   CS4320   1.00   Unsatisfactory",
      "SEM0303 Student Leadership Forum   SEM0303   0.00   Satisfactory",
      "MU4100 Chorale   MU4100   0.50",
      "2024 - 2025 - 10th Grade",
      "Durham Arts Academy",
      "AP Psychology   2A001   1.00   97",
      "Multivariable Calculus   2B002   1.00   91",
      "AP Physics   2C003   1.00   88",
      "AP Spanish Language   2D004   1.00   90",
      "Drawing",
    ].join("\n"),
  )
  assert.deepEqual(junior.courses.map(brief), [
    ["MA4060", "completed", "B", "B-", true],
    ["MU4100", "planned", null, "", true],
  ])
  assert.deepEqual(junior.other, [{ code: "SEM0303", title: "Student Leadership Forum" }])
  assert.deepEqual(junior.apCourseHints, ["psychology", "spanish-language"])
  assert.deepEqual(junior.exams, [])
  assert.deepEqual(junior.unread, [])
  assert.equal(junior.campus, "durham")
  assert.equal(junior.gradeLevel, "junior")

  const fresh = parse([head("Morganton, NC 28655", ["2026 - 2027 - 12th Grade", "2025 - 2026 - 11th Grade"]), "Riverbend Collegiate", "AP Psychology   2A001   1.00   97"].join("\n"))
  assert.deepEqual(fresh, { ...empty, apCourseHints: ["psychology"], campus: "morganton", gradeLevel: "senior" })
})
