# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + TypeScript, no UI framework, static output deployable to GitHub Pages or Netlify. Chosen by the user in the build brief ("Vite + TypeScript is fine. Keep dependencies minimal").

## Users

NCSSM (North Carolina School of Science and Mathematics) juniors and seniors at the Durham or Morganton campus. The primary user is a student alone, on a phone, in a short session, often around course registration. They want to know what their NCSSM courses and AP scores are worth at UNC-Chapel Hill or NC State and what to take next.

## Product Purpose

Dragon Credit Map tells an NCSSM student how their courses and AP scores become college credit at UNC-Chapel Hill and NC State, and which NCSSM courses and AP exams to take next. Scope is these two universities only.

Success, as the user defined it, is all three results together: the projected credit total (earned vs. planned), the major requirement checklist (covered, planned, open, must take at college), and ranked recommendations for what to take next. None is subordinate to the others. Juniors get recommendations for senior year. Seniors get what they have earned plus what is still worth adding.

## Positioning

Every answer is computed from scraped, sourced records: NCSSM's articulation agreements, both campus course catalogs, each university's AP credit chart, and every undergraduate major's requirements at both universities. Each record keeps its source URL and fetch date. Nothing is invented, and odd-looking source rows are shown as the source states them and flagged, never silently corrected.

## Operating Context

A short setup comes first, then a portal. Setup has three screens: transcript (optional), campus and class year, target university and intended major. The transcript reader takes a PDF or pasted text and fills in campus, year, courses, grades, and AP scores; the student confirms what was read. Courses can also be marked by hand as completed (with a grade band: B+ or higher, B or B-, below B-) or planned. The course picker shows only courses offered at the student's campus, plus NCSSM Online courses and a separate group of past courses that are no longer in the current catalog.

The portal has sections: Overview (credit total, earned vs. planned, requirement tally, top next picks), Credits (the course-by-course mapping table), Major (the requirement checklist), Take next (ranked recommendations), Courses, AP exams, Profile, Sources, and Privacy. Everything stays editable from the portal. The user asked for this portal on 2026-11-09 in place of a one-question-per-screen flow ending in a single results page, and asked that it not use a line or route treatment.

## Capabilities and Constraints

- Fully anonymous. Everything computes in the browser. No backend, accounts, analytics, cookies, localStorage, sessionStorage, or IndexedDB. No third-party requests at runtime; fonts and all assets are self-hosted. State lives in memory only and is gone when the tab closes, and the page says so plainly.
- A transcript is read only in the browser tab. Only course codes, grades, and AP scores are kept, in memory. Names, student numbers, birth dates, addresses, GPA, and class rank are discarded as it is read. A privacy policy saying that no data is collected and no transcript is stored is reachable from every screen.
- The tool is unofficial. Every results page says so, links each source, and shows a "data as of" date.
- Majors whose requirements did not pass every automated parsing check are marked needs-review and shown with a visible warning.
- Credit hours that could not be found in a university catalog are marked as estimated.
- On pre-med or any professional track, the results note that many medical schools want prerequisites taken in college.
- UNC by-exam credit limits are applied to AP and NCSSM credit together, with a visible note that the NCSSM part is unconfirmed.
- Copy is plain and short. No em dashes anywhere in UI text.
- No comments in code, in any language.

## Brand Commitments

- Name: Dragon Credit Map.
- Independent identity. No NCSSM, UNC, or NC State logos, colors, wordmarks, or mascots. Universities and the school are named in plain text only.
- An original dragon motif of the tool's own is welcome as a small signature detail.
- Color, set by the user on 2026-11-09 after seeing the first directions: a green-and-white theme (white ground, green as the theme color) used together with the colors already proposed (warm paper, warm dark ink, a small warm red accent, blue and amber for status). Green is a theme color only and never carries status meaning.
- Do not copy Anthropic's or Apple's logos, wordmarks, or exact brand assets.
- Visual constraints the user made binding in the brief: the feel of Apple product pages (very large confident headlines, generous whitespace, one idea per screen, calm scroll and fade transitions, restrained detail, excellent typography); a warm, soft palette in the spirit of Claude's interface (warm off-white and paper tones, warm dark neutrals for text, one warm accent); light and dark themes, both designed with care.

## Evidence on Hand

- Scraped data in `data/`: NCSSM courses per campus, articulation rules for both universities, AP credit rules, college course hours, per-major requirement slots, verbatim policy quotes, and a manifest of sources with fetch dates.
- `reports/counts.md` and `reports/majors-review.md` list counts and every major that needs review.
- There are no testimonials, usage numbers, endorsements, or official affiliations. Do not fabricate any.

## Product Principles

- Sourced or absent: show only what a source states, link it, and date it.
- Never overpromise credit: where a rule is uncertain, take the conservative reading and say so.
- One decision per screen, answerable with a thumb.
- Flag, do not fix: odd source rows stay as written and are visibly marked.
- Private by construction, not by promise.

## Accessibility & Inclusion

- Never rely on red vs. green for meaning. Status uses blue vs. amber, plus a text label and a shape.
- Keyboard accessible with visible focus states.
- Respects `prefers-reduced-motion`.
- Fully responsive, phone first.
