import { UNIVERSITY, courses, exams, apRules, majors, policies, rules } from "../data.ts"
import { pickerCourses } from "../engine/index.ts"
import { UNDECIDED } from "../state.ts"
import type { State } from "../state.ts"
import type { NcssmCourse, Univ } from "../types.ts"
import { choice, esc, plural } from "./parts.ts"

const count = (campus: "durham" | "morganton") => courses.filter((course) => course.campuses.includes(campus)).length

function campusYear(state: State): string {
  return `<h2 id="h-campus">Campus</h2>
  <div class="choices is-pair" role="radiogroup" aria-labelledby="h-campus">
    ${choice("campus", "durham", state.campus === "durham", "Durham", `${count("durham")} courses`)}
    ${choice("campus", "morganton", state.campus === "morganton", "Morganton", `${count("morganton")} courses`)}
  </div>
  <h2 id="h-year">Class year</h2>
  <div class="choices is-pair" role="radiogroup" aria-labelledby="h-year">
    ${choice("year", "junior", state.year === "junior", "Junior", "Planning senior year")}
    ${choice("year", "senior", state.year === "senior", "Senior", "Finishing up")}
  </div>`
}

const majorTitle = (major: { name: string; degree: string }) => `${major.name}, ${major.degree}`

export function majorList(state: State): string {
  if (!state.university) return ""
  const words = state.majorQuery.toLowerCase().split(/\s+/).filter(Boolean)
  const own = majors.filter((major) => major.university === state.university)
  const found = own.filter((major) => {
    const text = `${major.name} ${major.degree} ${major.concentration ?? ""} ${major.college ?? ""}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const picked = own.find((major) => major.id === state.majorId)
  const shown = found.slice(0, 30)
  if (picked && words.length === 0 && !shown.includes(picked)) shown.unshift(picked)
  const undecided =
    words.length === 0 ? choice("major", UNDECIDED, state.majorId === UNDECIDED, "Not sure yet", "Skip the requirement checklist") : ""
  const items = shown
    .map((major) => {
      const detail = [major.concentration, major.parseStatus === "needs-review" ? "Needs review" : ""].filter(Boolean).join(". ")
      return choice("major", major.id, state.majorId === major.id, majorTitle(major), detail)
    })
    .join("")
  const more =
    found.length > shown.length
      ? `<p class="hint">Showing ${shown.length} of ${found.length}. Type to narrow the list.</p>`
      : found.length === 0
        ? `<p class="hint">No major matches that. Try a shorter word, or pick Not sure yet.</p>`
        : ""
  return `${undecided}${items}${more}`
}

function universityMajor(state: State): string {
  const picked = (university: Univ) => state.university === university
  const total = (university: Univ) => majors.filter((major) => major.university === university).length
  const search = state.university
    ? `<h2 id="major-heading">Intended major</h2>
    <div class="field">
      <label for="major-search">Search ${total(state.university)} majors at ${UNIVERSITY[state.university].name}</label>
      <input id="major-search" type="search" autocomplete="off" spellcheck="false" data-input="majorQuery" data-key="major-search" value="${esc(state.majorQuery)}" placeholder="Biology, engineering, economics" />
    </div>
    <div class="choices is-compact" id="major-list" role="radiogroup" aria-labelledby="major-heading">${majorList(state)}</div>
    <label class="check">
      <input type="checkbox" data-change="track" data-key="track"${state.track ? " checked" : ""} />
      <span>I am on a pre-med or other pre-professional track</span>
    </label>`
    : ""
  return `<h2 id="h-univ">University</h2>
  <div class="choices is-pair" role="radiogroup" aria-labelledby="h-univ">
    ${choice("university", "unc", picked("unc"), "UNC-Chapel Hill", `${total("unc")} majors`)}
    ${choice("university", "ncsu", picked("ncsu"), "NC State", `${total("ncsu")} majors`)}
  </div>
  ${search}`
}

export function setupOne(state: State): string {
  const read = state.courses.size > 0 ? ` ${plural(state.courses.size, "course")} read from your transcript.` : ""
  return `<h1 tabindex="-1">Your campus and year.</h1>
  <p class="lede">Your course list depends on the campus. Your advice depends on the year.${read}</p>
  ${campusYear(state)}`
}

export function setupTwo(state: State): string {
  return `<h1 tabindex="-1">Where are you headed?</h1>
  <p class="lede">Pick a university, then the major you have in mind.</p>
  ${universityMajor(state)}`
}

export function profileTab(state: State): string {
  return `<h1 tabindex="-1">Profile</h1>
  <p class="lede">Change anything here and the whole portal updates.</p>
  ${campusYear(state)}
  ${universityMajor(state)}
  <div class="bar is-static"><button type="button" class="back" data-action="restart" data-key="restart">${
    state.confirmRestart ? "Tap again to clear everything" : "Start over"
  }</button></div>`
}

const GRADE_WORDS: Record<string, string> = { "B+": "B+ or higher", B: "B or B-", below: "below B-" }

export function importPanel(state: State): string {
  const reading = state.reading
  if (reading.status === "reading") {
    return `<div class="import"><p class="import-title">Reading your transcript</p><div class="skeleton" aria-hidden="true"><i></i><i></i></div></div>`
  }
  if (reading.status === "review" && reading.result) {
    const { result } = reading
    const kept = result.courses.filter((course) => !reading.skip.has(course.code)).length + result.exams.filter((exam) => !reading.skip.has(exam.id)).length
    const terms = [...new Set(result.courses.map((course) => course.term))]
    const courseRows = terms
      .map((term) => {
        const rows = result.courses
          .filter((course) => course.term === term)
          .map((course) => {
            const detail =
              course.status === "planned"
                ? "In progress, counts as planned"
                : course.grade
                  ? `Grade ${course.rawGrade}, counts as ${GRADE_WORDS[course.grade]}`
                  : `Marked ${course.rawGrade || "without a grade"}, counts as B or B-`
            return `<li class="${course.confident ? "" : "is-unsure"}"><label class="check">
              <input type="checkbox" data-change="keep" data-id="${esc(course.code)}" data-key="keep-${esc(course.code)}"${reading.skip.has(course.code) ? "" : " checked"} />
              <span><b>${esc(course.code)}</b> ${esc(course.title)}<small>${esc(detail)}${course.confident ? "" : ". Please check this one"}</small></span>
            </label></li>`
          })
          .join("")
        const heading = term ? `<li class="term">${esc(term.replace(/\s*-\s*/g, " to ").replace(/ to (\d+\w* Grade)/i, ", $1"))}</li>` : ""
        return `${heading}${rows}`
      })
      .join("")
    const examRows = result.exams
      .map((exam) => {
        const name = exams.find((item) => item.id === exam.id)?.name ?? exam.id
        return `<li><label class="check">
          <input type="checkbox" data-change="keep" data-id="${esc(exam.id)}" data-key="keep-${esc(exam.id)}"${reading.skip.has(exam.id) ? "" : " checked"} />
          <span><b>AP ${esc(name)}</b><small>Score ${exam.score}</small></span>
        </label></li>`
      })
      .join("")
    const unread = result.unread.length
      ? `<details class="aside"><summary>${plural(result.unread.length, "line")} could not be matched to a course</summary><ul class="unread">${result.unread
          .map((line) => `<li>${esc(line)}</li>`)
          .join("")}</ul><p>Add these by hand in Courses if they belong.</p></details>`
      : ""
    const other = result.other.length
      ? `<details class="aside"><summary>${plural(result.other.length, "other course")} with no credit agreement</summary><ul class="unread">${result.other
          .map((item) => `<li>${esc(item.code)} ${esc(item.title)}</li>`)
          .join("")}</ul><p>These are on your transcript but are not in NCSSM's credit agreements, so they add nothing here.</p></details>`
      : ""
    const hinted = result.apCourseHints
      .map((id) => exams.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .map((name) => `AP ${name}`)
    const hints = hinted.length
      ? `<p class="hint">Your transcript lists AP classes from another school: ${esc(hinted.join(", "))}. A class grade is not an exam score. If you sat those exams, add your scores under AP exams.</p>`
      : ""
    const where = [
      result.campus ? (result.campus === "durham" ? "Durham campus" : "Morganton campus") : "",
      result.gradeLevel ? (result.gradeLevel === "senior" ? "senior year" : "junior year") : "",
    ].filter(Boolean)
    const read = where.length ? `<p class="hint">Also read: ${where.join(", ")}.</p>` : ""
    if (result.courses.length + result.exams.length === 0) {
      return `<div class="import"><p class="import-title">No courses found in that transcript.</p>
      <p class="hint">It may be a scanned image, which cannot be read here. Try pasting the text, or add your courses by hand.</p>
      ${other}${unread}
      <div class="row"><button type="button" class="back" data-action="reading-reset" data-key="reading-reset">Try another file</button></div></div>`
    }
    return `<div class="import">
      <p class="import-title">Found ${plural(result.courses.length, "course")}${result.exams.length ? ` and ${plural(result.exams.length, "AP score")}` : ""}</p>
      <p class="hint">Untick anything that is wrong. You can change grades later in Courses.</p>
      <ul class="found">${courseRows}${examRows}</ul>
      ${read}${hints}${other}${unread}
      <div class="row">
        <button type="button" class="go is-inline" data-action="reading-apply" data-key="reading-apply"${kept ? "" : " disabled"}>Use ${plural(kept, "item")}</button>
        <button type="button" class="back" data-action="reading-reset" data-key="reading-reset">Discard</button>
      </div>
    </div>`
  }
  const error = reading.status === "error" ? `<p class="warn" role="alert">${esc(reading.message)}</p>` : ""
  return `<div class="import" data-drop>
    ${error}
    <p class="import-title">Add your transcript</p>
    <p class="hint">Choose the PDF, or drop it here. It is read in this tab and never uploaded. Only course codes, grades, and AP scores are kept.</p>
    <div class="row">
      <label class="go is-inline file"><input type="file" accept=".pdf,.txt,application/pdf,text/plain" data-change="file" data-key="file" /><span>Choose a file</span></label>
    </div>
    <details class="aside"${reading.text ? " open" : ""}>
      <summary>Paste the text instead</summary>
      <label class="sr" for="paste">Transcript text</label>
      <textarea id="paste" rows="6" spellcheck="false" autocomplete="off" data-input="paste" data-key="paste" placeholder="Paste your transcript text here">${esc(reading.text)}</textarea>
      <div class="row"><button type="button" class="back" data-action="reading-paste" data-key="reading-paste">Read this text</button></div>
    </details>
  </div>`
}

export function setupThree(state: State): string {
  return `<h1 tabindex="-1">Start with your transcript.</h1>
  <p class="lede">It fills in your campus, year, courses, and grades for you. No transcript handy? Continue and add courses by hand.</p>
  <div id="import" aria-live="polite">${importPanel(state)}</div>`
}

const TAGS: Record<string, string> = { research: "Research", "math-intensive": "Math-intensive" }

function creditCodes(university: Univ): Set<string> {
  return new Set(rules.filter((rule) => rule.university === university).flatMap((rule) => rule.ncssmCourses))
}

function courseRow(course: NcssmCourse, state: State, hasCredit: boolean, past: boolean): string {
  const pick = state.courses.get(course.code)
  const gone = course.campuses.length === 0
  const meta = [
    course.campuses.includes("online") && !course.campuses.includes(state.campus!) ? "Online" : "",
    ...course.tags.map((tag) => TAGS[tag]),
    gone ? "Not in the current catalog, campus unknown" : past ? "Not offered at your campus now" : "",
    hasCredit ? "" : `No agreement at ${UNIVERSITY[state.university!].short}`,
  ].filter(Boolean)
  const toggle = (status: "completed" | "planned", label: string) =>
    `<button type="button" class="toggle" data-action="course" data-code="${esc(course.code)}" data-status="${status}" data-key="course-${esc(course.code)}-${status}" aria-pressed="${pick?.status === status}" aria-label="${label}: ${esc(course.code)} ${esc(course.title)}">${label}</button>`
  const grades =
    pick?.status === "completed"
      ? `<fieldset class="grades"><legend>Grade<span class="sr"> in ${esc(course.code)}</span></legend>
        ${(
          [
            ["B+", "B+ or higher"],
            ["B", "B or B-"],
            ["below", "Below B-"],
          ] as const
        )
          .map(
            ([value, label]) =>
              `<label><input type="radio" name="grade-${esc(course.code)}" value="${value}" data-change="grade" data-code="${esc(course.code)}" data-key="grade-${esc(course.code)}-${value}"${pick.grade === value ? " checked" : ""} /><span>${label}</span></label>`,
          )
          .join("")}
      </fieldset>`
      : ""
  return `<li class="course${pick ? " is-on" : ""}">
    <div class="course-name"><b>${esc(course.code)}</b> ${esc(course.title)}${meta.length ? `<small>${esc(meta.join(". "))}</small>` : ""}</div>
    <div class="toggles">${toggle("completed", "Completed")}${past ? "" : toggle("planned", "Planned")}</div>
    ${grades}
  </li>`
}

export function courseList(state: State): string {
  if (!state.campus || !state.university) return ""
  const { current, past } = pickerCourses(courses, state.campus)
  const credit = creditCodes(state.university)
  const words = state.courseQuery.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (course: NcssmCourse) => {
    const text = `${course.code} ${course.aliases.join(" ")} ${course.title} ${course.subject ?? ""} ${course.department}`.toLowerCase()
    return words.every((word) => text.includes(word))
  }
  const pool =
    state.courseFilter === "past"
      ? past
      : state.courseFilter === "picked"
        ? courses.filter((course) => state.courses.has(course.code))
        : state.courseFilter === "credit"
          ? current.filter((course) => credit.has(course.code))
          : current
  const found = pool.filter(matches)
  if (found.length === 0) {
    const empty =
      state.courseFilter === "picked"
        ? "Nothing marked yet. Mark a course as completed or planned and it shows up here."
        : "No course matches that. Try the course code, like MA4060, or switch to All courses."
    return `<li class="empty">${empty}</li>`
  }
  const offered = new Set(current.map((course) => course.code))
  return found.map((course) => courseRow(course, state, credit.has(course.code), !offered.has(course.code))).join("")
}

export function coursesTab(state: State): string {
  const short = UNIVERSITY[state.university!].short
  const filters: [State["courseFilter"], string][] = [
    ["credit", `With an agreement at ${short}`],
    ["all", "All courses"],
    ["picked", `Marked (${state.courses.size})`],
    ["past", "Past courses"],
  ]
  const markers = policies.ncssm.markers
  const open = state.reading.status !== "idle" || state.reading.text !== ""
  return `<h1 tabindex="-1">Courses</h1>
  <p class="lede">Mark each course as completed or planned. A planned course is assumed to earn the grade its agreement asks for.</p>
  <details class="panel"${open ? " open" : ""}>
    <summary>Read a transcript</summary>
    <div id="import" aria-live="polite">${importPanel(state)}</div>
  </details>
  <div class="field">
    <label for="course-search">Search by course code or name</label>
    <input id="course-search" type="search" autocomplete="off" spellcheck="false" data-input="courseQuery" data-key="course-search" value="${esc(state.courseQuery)}" placeholder="MA4060 or calculus" />
  </div>
  <div class="filters" role="group" aria-label="Which courses to show">
    ${filters
      .map(
        ([value, label]) =>
          `<button type="button" class="chip" data-action="filter" data-filter="${value}" data-key="filter-${value}" aria-pressed="${state.courseFilter === value}">${label}</button>`,
      )
      .join("")}
  </div>
  <ul class="courses" id="course-list">${courseList(state)}</ul>
  <details class="aside">
    <summary>What Research and Math-intensive mean</summary>
    <p>${esc(markers.research)}</p>
    <p>${esc(markers.mathIntensive)}</p>
    <p><a href="${esc(markers.source.url)}" target="_blank" rel="noreferrer noopener">NCSSM Science course descriptions</a></p>
  </details>`
}

export function examsTab(state: State): string {
  const listed = new Set(apRules.filter((rule) => rule.university === state.university).flatMap((rule) => rule.exams))
  const rows = exams
    .filter((exam) => exam.group !== "retired")
    .map((exam) => {
      const pick = state.exams.get(exam.id)
      const scores = [1, 2, 3, 4, 5]
        .map(
          (score) =>
            `<button type="button" class="score" data-action="score" data-exam="${exam.id}" data-score="${score}" data-key="score-${exam.id}-${score}" aria-pressed="${pick?.score === score}" aria-label="${esc(exam.name)}, score ${score}">${score}</button>`,
        )
        .join("")
      const status = pick
        ? `<div class="toggles">${(["taken", "planned"] as const)
            .map(
              (value) =>
                `<button type="button" class="toggle" data-action="exam-status" data-exam="${exam.id}" data-status="${value}" data-key="exam-${exam.id}-${value}" aria-pressed="${pick.status === value}" aria-label="${value === "taken" ? "Taken" : "Planned"}: AP ${esc(exam.name)}">${value === "taken" ? "Taken" : "Planned"}</button>`,
            )
            .join("")}</div>`
        : ""
      const note = listed.has(exam.id) ? "" : `<small>No credit listed at ${UNIVERSITY[state.university!].short}</small>`
      return `<li class="course${pick ? " is-on" : ""}">
        <div class="course-name"><b>${esc(exam.name)}</b>${note}</div>
        <div class="scores" role="group" aria-label="Score on ${esc(exam.name)}">${scores}</div>
        ${status}
      </li>`
    })
    .join("")
  return `<h1 tabindex="-1">AP exams</h1>
  <p class="lede">Tap a score for each exam you have taken or plan to take, self-studied ones included. Tap it again to remove it.</p>
  <ul class="courses" id="exam-list">${rows}</ul>
  <p class="hint">${plural(state.exams.size, "exam")} added. For a planned exam, pick the score you are aiming for.</p>`
}
