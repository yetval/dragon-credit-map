import "@fontsource-variable/overpass"
import "./styles.css"
import { apRules, courses, exams, loadCollege, loadMajor, majors, policies, rules } from "./data.ts"
import { evaluate, recommend } from "./engine/index.ts"
import type { GradeBand } from "./engine/index.ts"
import { SETUP_STEPS, TABS, UNDECIDED, canContinue, freshState, idleReading, toProfile } from "./state.ts"
import type { CourseFilter, Tab } from "./state.ts"
import { parseTranscript } from "./transcript/parse.ts"
import type { Univ } from "./types.ts"
import { header, nav, setupBar, steps } from "./ui/parts.ts"
import { creditsTab, majorTab, nextTab, overview, recKey, sourcesTab, summary } from "./ui/portal.ts"
import type { Computed } from "./ui/portal.ts"
import { FOOTNOTE, privacyPolicy } from "./ui/privacy.ts"
import { courseList, coursesTab, examsTab, importPanel, majorList, profileTab, setupOne, setupThree, setupTwo } from "./ui/screens.ts"

const root = document.querySelector<HTMLElement>("#app")!
root.innerHTML = `<div id="top"></div><div id="shell"></div>`
const top = root.querySelector<HTMLElement>("#top")!
const shell = root.querySelector<HTMLElement>("#shell")!

let state = freshState(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
let computed: Computed = null
let memo = { key: "", value: null as Computed }

function compute(withRecs: boolean) {
  const profile = toProfile(state, courses)
  if (!profile || !state.college || state.loading) {
    computed = null
    return
  }
  const key = JSON.stringify([profile, state.major?.id ?? "", withRecs])
  if (memo.key !== key) {
    const data = { courses, rules, apRules, exams, policies, college: state.college, major: state.major }
    memo = { key, value: { result: evaluate(profile, data), recs: withRecs ? recommend(profile, data) : [] } }
  }
  computed = memo.value
}

function tabView(): string {
  if (state.tab === "overview") return overview(state, computed)
  if (state.tab === "credits") return creditsTab(state, computed)
  if (state.tab === "major") return majorTab(state, computed)
  if (state.tab === "next") return nextTab(state, computed)
  if (state.tab === "courses") return coursesTab(state)
  if (state.tab === "exams") return examsTab(state)
  if (state.tab === "profile") return profileTab(state)
  if (state.tab === "privacy") return privacyPolicy(false)
  return sourcesTab(state, computed)
}

function keepFocus(change: () => void) {
  const key = document.activeElement?.getAttribute("data-key")
  change()
  if (key) root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true })
}

function draw(moved: boolean) {
  document.documentElement.dataset.theme = state.theme
  top.innerHTML = header(state)
  const arriving = moved ? " is-arriving" : ""
  let title = "Dragon Credit Map"
  if (state.view === "setup" && state.showPolicy) {
    shell.innerHTML = `<main class="screen${arriving}">${privacyPolicy(true)}</main>`
    title = "Privacy policy, Dragon Credit Map"
  } else if (state.view === "setup") {
    const screen = [setupThree, setupOne, setupTwo][state.setupStep](state)
    shell.innerHTML = `<main class="screen${arriving}">${steps(state)}${screen}${setupBar(state)}</main>`
  } else {
    compute(state.tab === "overview" || state.tab === "next")
    shell.innerHTML = `<div class="portal">${nav(state, summary(state, computed))}<main class="pane${arriving}">${tabView()}${state.tab === "privacy" ? "" : FOOTNOTE}</main></div>`
    title = `${TABS.find(([id]) => id === state.tab)![1]}, Dragon Credit Map`
    if (moved) shell.querySelector<HTMLElement>('.tab[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" })
  }
  document.title = title
  for (const element of shell.querySelectorAll<HTMLElement>("[data-grow]")) element.style.flexGrow = element.dataset.grow!
}

function render(moved = false) {
  if (moved) {
    draw(true)
    window.scrollTo(0, 0)
    shell.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true })
  } else {
    keepFocus(() => draw(false))
  }
}

function renderImport() {
  const holder = shell.querySelector<HTMLElement>("#import")
  if (!holder) return render()
  keepFocus(() => {
    holder.innerHTML = importPanel(state)
  })
}

async function load() {
  const { university, majorId } = state
  if (!university || !majorId) return
  state.loading = true
  state.failed = false
  try {
    const entry = majors.find((major) => major.id === majorId)
    const [college, major] = await Promise.all([loadCollege(university), entry ? loadMajor(entry) : null])
    if (state.university !== university || state.majorId !== majorId) return
    state.college = college
    state.major = major
  } catch (error) {
    console.error(error)
    if (state.university !== university || state.majorId !== majorId) return
    state.failed = true
  }
  state.loading = false
  if (state.view === "portal") render()
}

function setUniversity(university: Univ) {
  if (state.university === university) return
  state.university = university
  state.majorId = state.view === "portal" ? UNDECIDED : null
  state.major = null
  state.college = null
  state.majorQuery = ""
  state.failed = false
  state.loading = false
  void load()
}

function readText(text: string) {
  const result = parseTranscript(text, courses, exams)
  for (const course of result.courses) course.line = ""
  for (const exam of result.exams) exam.line = ""
  state.reading = { status: "review", text: "", message: "", result, skip: new Set() }
  renderImport()
}

async function readFile(file: File) {
  const mine = { ...idleReading(), status: "reading" as const }
  state.reading = mine
  renderImport()
  try {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const text = isPdf ? await (await import("./transcript/pdf.ts")).pdfText(await file.arrayBuffer()) : await file.text()
    if (state.reading !== mine) return
    readText(text)
  } catch (error) {
    console.error(error)
    if (state.reading !== mine) return
    state.reading = {
      ...idleReading(),
      status: "error",
      message: "That file could not be read. If it is a scan or a photo, paste the transcript text instead.",
    }
    renderImport()
  }
}

function applyReading() {
  const { result, skip } = state.reading
  if (!result) return
  for (const course of result.courses) {
    if (skip.has(course.code)) continue
    state.courses.set(course.code, { status: course.status, grade: course.grade ?? "B" })
  }
  for (const exam of result.exams) {
    if (!skip.has(exam.id)) state.exams.set(exam.id, { score: exam.score, status: "taken" })
  }
  if (!state.campus && result.campus) state.campus = result.campus
  if (!state.year && result.gradeLevel) state.year = result.gradeLevel
  state.reading = idleReading()
  state.courseFilter = "picked"
}

function openPortal() {
  state.view = "portal"
  state.tab = state.courses.size + state.exams.size > 0 ? "overview" : "courses"
  render(true)
}

root.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")
  if (!target || (target as HTMLButtonElement).disabled) return
  const { action, code, exam, status, score, filter, rec, tab } = target.dataset
  if (action !== "restart") state.confirmRestart = false
  if (action === "theme") state.theme = state.theme === "dark" ? "light" : "dark"
  if (action === "policy" || action === "policy-close") {
    if (state.view === "portal") state.tab = "privacy"
    else state.showPolicy = action === "policy"
    return render(true)
  }
  if (action === "tab") {
    state.tab = tab as Tab
    return render(true)
  }
  if (action === "back") {
    state.setupStep = Math.max(0, state.setupStep - 1)
    return render(true)
  }
  if (action === "next" && canContinue(state)) {
    if (state.setupStep === 0 && state.reading.status === "review") applyReading()
    if (state.setupStep === SETUP_STEPS - 1) return openPortal()
    state.setupStep += 1
    return render(true)
  }
  if (action === "restart") {
    if (!state.confirmRestart) {
      state.confirmRestart = true
      return render()
    }
    state = freshState(state.theme)
    computed = null
    return render(true)
  }
  if (action === "retry") void load()
  if (action === "filter") state.courseFilter = filter as CourseFilter
  if (action === "more") state.showAllNext = true
  if (action === "course" && code) {
    const pick = state.courses.get(code)
    if (pick?.status === status) state.courses.delete(code)
    else state.courses.set(code, { status: status as "completed" | "planned", grade: pick?.grade ?? "B" })
  }
  if (action === "score" && exam) {
    const pick = state.exams.get(exam)
    if (pick?.score === Number(score)) state.exams.delete(exam)
    else state.exams.set(exam, { score: Number(score), status: pick?.status ?? "taken" })
  }
  if (action === "exam-status" && exam) {
    const pick = state.exams.get(exam)
    if (pick) state.exams.set(exam, { ...pick, status: status as "taken" | "planned" })
  }
  if (action === "add" && computed) {
    const found = computed.recs.find((item) => recKey(item) === rec)
    if (found?.kind === "course") for (const add of found.add) state.courses.set(add, { status: "planned", grade: "B" })
    if (found?.kind === "exam") state.exams.set(found.add[0], { score: found.minScore ?? 5, status: "planned" })
  }
  if (action === "reading-paste") {
    if (state.reading.text.trim()) return readText(state.reading.text)
    state.reading = { ...idleReading(), status: "error", message: "Paste your transcript text first." }
    return renderImport()
  }
  if (action === "reading-reset") {
    state.reading = idleReading()
    return renderImport()
  }
  if (action === "reading-apply") {
    applyReading()
    if (state.view === "setup") {
      state.setupStep = 1
      return render(true)
    }
  }
  render()
})

root.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement
  const field = input.dataset.change
  if (!field) return
  if (field === "file") {
    const file = input.files?.[0]
    if (file) void readFile(file)
    return
  }
  if (field === "keep") {
    const id = input.dataset.id!
    if (input.checked) state.reading.skip.delete(id)
    else state.reading.skip.add(id)
    return renderImport()
  }
  if (field === "grade") {
    const pick = state.courses.get(input.dataset.code!)
    if (pick) pick.grade = input.value as GradeBand
  }
  if (field === "campus") state.campus = input.value as "durham" | "morganton"
  if (field === "year") state.year = input.value as "junior" | "senior"
  if (field === "university") setUniversity(input.value as Univ)
  if (field === "major") {
    state.majorId = input.value === UNDECIDED ? UNDECIDED : input.value
    void load()
  }
  if (field === "track") state.track = input.checked
  render()
})

root.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement
  if (input.dataset.input === "majorQuery") {
    state.majorQuery = input.value
    shell.querySelector("#major-list")!.innerHTML = majorList(state)
  }
  if (input.dataset.input === "courseQuery") {
    state.courseQuery = input.value
    shell.querySelector("#course-list")!.innerHTML = courseList(state)
  }
  if (input.dataset.input === "paste") state.reading.text = input.value
})

const hasFiles = (event: DragEvent) => Boolean(event.dataTransfer?.types.includes("Files"))

window.addEventListener("dragover", (event) => {
  if (hasFiles(event)) event.preventDefault()
})

window.addEventListener("drop", (event) => {
  if (!hasFiles(event)) return
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file && (event.target as HTMLElement).closest?.("[data-drop]")) void readFile(file)
})

render()
