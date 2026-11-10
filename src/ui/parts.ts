import { RESULT_TABS, SETUP_STEPS, TABS, canContinue } from "../state.ts"
import type { State } from "../state.ts"
import { FOOTNOTE } from "./privacy.ts"

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export const esc = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char])

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export const hoursText = (hours: number) => `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`

export const DRAGON = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15c0-5.5 3.6-10 9-10 1.9 0 3.4.6 4.5 1.5L20.5 4l-.6 4.2c.4.9.6 1.8.6 2.8 0 4.7-3.6 8-8 8H3.5l3-2.6C5 15.9 4 15.8 4 15z" fill="currentColor"/><circle class="mark-eye" cx="14.6" cy="9.8" r="1.3"/></svg>`

export function header(state: State): string {
  const dark = state.theme === "dark"
  return `<header class="top">
    <span class="brand">${DRAGON}<span>Dragon Credit Map</span></span>
    <span class="pill">Unofficial</span>
    <button class="quiet" type="button" data-action="theme" data-key="theme" aria-label="Switch to ${dark ? "light" : "dark"} theme">${dark ? "Light" : "Dark"}</button>
  </header>`
}

export function steps(state: State): string {
  const items = Array.from({ length: SETUP_STEPS }, (_, index) => {
    const kind = index < state.setupStep ? "is-done" : index === state.setupStep ? "is-now" : ""
    return `<span class="${kind}" aria-hidden="true"></span>`
  }).join("")
  return `<div class="steps" role="img" aria-label="Step ${state.setupStep + 1} of ${SETUP_STEPS}">${items}</div>`
}

export function choice(name: string, value: string, checked: boolean, title: string, detail: string): string {
  return `<label class="choice${checked ? " is-on" : ""}">
    <input type="radio" name="${name}" value="${esc(value)}" data-change="${name}" data-key="${name}-${esc(value)}"${checked ? " checked" : ""} />
    <i aria-hidden="true"></i>
    <span><b>${esc(title)}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</span>
  </label>`
}

export function setupBar(state: State): string {
  const last = state.setupStep === SETUP_STEPS - 1
  const skipping = state.setupStep === 0 && state.reading.status !== "review" && state.courses.size === 0
  const label = last ? "Open my portal" : skipping ? "Continue without a transcript" : "Continue"
  return `<div class="bar">
    ${state.setupStep > 0 ? `<button type="button" class="back" data-action="back" data-key="back">Back</button>` : ""}
    <button type="button" class="${skipping ? "back is-wide" : "go"}" data-action="next" data-key="next"${canContinue(state) ? "" : " disabled"}>${label}</button>
  </div>
  ${FOOTNOTE}`
}

export function nav(state: State, summary: string): string {
  const items = TABS.map(
    ([id, label]) =>
      `<li><button type="button" class="tab" data-action="tab" data-tab="${id}" data-key="tab-${id}"${
        state.tab === id ? ' aria-current="page"' : ""
      }>${label}</button></li>`,
  )
  return `<div class="rail">
    <nav class="side${state.tab === "overview" ? " is-overview" : ""}" aria-label="Your results"><ul>${items.slice(0, RESULT_TABS).join("")}</ul>${summary}</nav>
    <nav class="more" aria-label="Your details and reference"><ul>${items.slice(RESULT_TABS).join("")}</ul></nav>
  </div>`
}
