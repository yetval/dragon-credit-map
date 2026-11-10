# Dragon Credit Map: task list

Updated 2026-11-09. Owner in brackets: [me] is the main session, [agent] is a delegated agent.

## Done

- [x] Data schema and scraper plan approved
- [x] Scrapers: NCSSM catalogs (Durham, Morganton, Online), both articulation sheets, both AP charts, college course hours, every major at both universities, policy quotes
- [x] `npm run refresh` with record-level diff, counts report, needs-review report
- [x] First data run: 395 NCSSM courses, 241 articulation rules, 151 AP rules, 355 majors (203 verified, 152 needs-review)
- [x] Credit engine: combinations, grade floors, duplicates, generic stacking, prefix aliases, AP tiers, UNC by-exam cap, checklist, recommendations
- [x] 58 unit tests (16 parser, 42 engine)
- [x] Product facts recorded in `PRODUCT.md`
- [x] First working app: six question screens and a results page, light and dark, builds to a static site with a content security policy and self-hosted font
- [x] README, Netlify config, GitHub Pages workflow (first draft)
- [x] Independent audit of the data against the live sources (findings feed the fixes below)

- [x] Audit findings fixed in the majors parser and data: open-ended elective rows, "or" pairs in lists, level floors, missing second tables, mutually exclusive college courses, duplicate cross-listed course, stray sync files
- [x] Transcript parser, tuned to the real NCSSM transcript layout and tested on a made-up lookalike (the real file stays outside the project)
- [x] PDF and pasted-text transcript reading in the browser, with a review step
- [x] Interface rebuilt as a portal: three setup screens (transcript, campus and year, university and major), then Overview, Credits, Major, Take next, Courses, AP exams, Profile, Sources, Privacy
- [x] Privacy policy page, linked from every screen
- [x] Independent interface review (bugs, keyboard and screen reader use, security policy, privacy claims) and its fixes
- [x] Site guard tests: no storage or network calls, no third-party URLs, no em dashes, no code comments
- [x] 104 tests passing; site builds; real transcript read end to end in a headless browser with no errors

- [x] Independent design finish review, and its eight fixes applied (phone navigation and running total, grouped next picks, clearer wording, one control style, warm dark theme)
- [x] README updated for the portal, transcript reader, privacy, and new data counts

- [x] Design reviewer's verdict: ship (all eight fixes resolved)
- [x] Design system recorded in `DESIGN.md`
- [x] Public repository `yetval/dragon-credit-map`, GitHub Pages deploy, live site checked with a real transcript and no browser errors

## To do

- [ ] Choose a license (none is included yet, so by default others may not reuse the code)
- [ ] Redraw the dragon mark (the design review says it reads as a leaf or bird at header size)
- [ ] Animate the meter fills (the design brief names them; they currently appear in one step)
- [ ] Have an adult at NCSSM look over the privacy policy if the tool is shared widely

## Known limits after the data fixes

- 152 of 355 majors pass every automated check (50 of 96 at UNC, 102 of 259 at NC State). The count went down from 203 because the parser now refuses to call a major verified when it has a rule it cannot model, such as "12 hours from 3 different disciplines" (44 NC State humanities and social science majors).
- Recommendations can suggest a lower course than ones already completed (for example Calculus I for a student with Calculus II), because it would fill an open requirement.

## Waiting on you

- [ ] UNC row 35 (`EE4540 Statics`: "APPL 2-- for taking both EE 4000 and EE 4540; BMME 160"): give credit for both codes, only BMME 160, or none until confirmed?
- [ ] This year's courses are not on a transcript until grades post, so seniors still add current courses by hand as planned. Is that acceptable, or should setup ask for them explicitly?
