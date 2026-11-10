# Dragon Credit Map

Dragon Credit Map is a static website for students at the North Carolina School of Science and Mathematics (NCSSM) in Durham and Morganton. A student adds a transcript or marks courses by hand, then picks a campus, a class year, a target university, and an intended major. The site then shows the college credit those courses and AP scores earn, a checklist for the major, and what to take next. It covers UNC-Chapel Hill and NC State only. It is unofficial. It is not run by or affiliated with NCSSM, UNC-Chapel Hill, or NC State, and a student should confirm any credit with the university.

It is built with Vite and TypeScript, with no UI framework. `package.json` lists dev dependencies only. Vite bundles what the site needs at build time, including the font and pdf.js.

`TASKS.md` is a working task list. It can lag behind the code.

## Run it

You need Node 26. The scripts and tests are TypeScript files that Node runs directly, so they have no build step.

```sh
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server. |
| `npm run build` | Type-checks with `tsc --noEmit`, then writes the static site to `dist/`. |
| `npm run preview` | Serves the built `dist/` folder locally. |
| `npm test` | Runs `tests/*.test.ts` with Node's built-in test runner. One test runs a Vite build into a temporary folder. |
| `npm run refresh` | Runs every scraper again and rewrites `data/` and `reports/`. See "Refresh the data". |

The Content-Security-Policy tag is added only by `npm run build`. Use `npm run preview` to check the page as it will be deployed. The headers in `netlify.toml` are sent only by Netlify.

## How the site works

### Setup and portal

The site opens with three short setup screens:

1. Transcript. This step is optional. The student chooses a PDF or text file, drops one on the page, or pastes the text. The student can also continue without a transcript and mark courses by hand later.
2. Campus and class year.
3. University and intended major. "Not sure yet" skips the requirement checklist.

Then a portal opens. It has nine sections:

| Section | What it shows |
| --- | --- |
| Overview | The projected credit hours, split into earned and planned. A tally of the major's requirements. The top three picks to take next. |
| Credits | One row for each course, combination, or AP exam, with the credit it becomes, the hours, and the status. |
| Major | The requirement checklist. Each requirement is covered, planned, open, or left to take at the university. |
| Next | Ranked recommendations, 12 at first. Each one can be added as planned. |
| Courses | Every course for the campus. The student marks a course as completed or planned and sets a grade band. The transcript reader is here too. |
| AP exams | A score for each exam, marked as taken or planned. |
| Profile | Campus, class year, university, and major. Start over. |
| Sources | Notes about the result and links to the source pages. |
| Privacy | The privacy policy. |

Everything stays editable in the portal. Nothing is saved. A reload starts over.

Where the code is:

- `src/main.ts` handles events and draws the page.
- `src/state.ts` holds the state, the list of portal sections, and `toProfile`, which turns the state into the engine's input.
- `src/ui/` builds the screens: `screens.ts` for setup, Courses, AP exams, and Profile, `portal.ts` for the result sections, `privacy.ts` for the privacy policy, and `parts.ts` for shared pieces.
- `src/engine/` is the credit engine.
- `src/transcript/` is the transcript reader.

### Transcript reader

`src/transcript/parse.ts` turns transcript text into courses, grades, AP scores, a campus, and a grade level. `src/transcript/pdf.ts` gets the text out of a PDF with pdf.js, in the browser. The pdf.js code and its worker file are loaded only when a PDF is chosen. A text file or pasted text goes straight to the parser.

The parser is built for the layout of the NCSSM transcript:

- A heading for each school year, such as `2025 - 2026 - 11th Grade`.
- One row per course: the course code and title, the code again in its own column, the credit, and the final grade.
- Titles that wrap onto a second line.
- Sections for earlier schools, each under the school's name.

It also reads simpler text: rows that start with a course code under a term heading, rows with only a course title, and a list of AP scores.

What it ignores:

- Identity lines. A line with a name, student number, birth date, address, phone number, email, GPA, class rank, page header, legend, or total is skipped. Nothing from it is kept.
- Other schools. In the NCSSM layout, a line that looks like a school name starts another school's section. Course rows there are ignored until the next year heading. A class there whose title starts with "AP" and names one AP exam becomes a hint. The review screen then tells the student to add the score by hand if they sat the exam. A row there is read as an AP score only if it is an AP exam name followed by one digit from 1 to 5.
- Rows marked withdrawn, dropped, incomplete, or unsatisfactory.

How marks map to the three grade bands:

| Mark on the transcript | Result |
| --- | --- |
| A+, A, A-, B+, or a number of 87 or more | Completed, "B+ or higher" |
| B, B-, or a number from 80 to below 87 | Completed, "B or B-" |
| C+ or lower, or a number below 80 | Completed, "below B-" |
| P, S, CR, Pass, or Satisfactory | Completed with no grade. The site counts it as "B or B-". |
| IP, In Progress, CUR, or no grade at all | Planned |

A number counts as a grade only if the row has no letter grade, the number is from 50 to 100, and it is the only such number on the row. A row with two such numbers is completed with no grade. If a course appears twice, the completed row with the better grade is kept.

What the parser returns:

- `courses`: rows matched to an NCSSM course, by code or by title. A row is marked for checking when the match or the grade is uncertain. That covers a numeric grade, a pass mark, a code with an extra section letter, a title that is not identical to the catalog title, and a blank grade in a term older than the latest graded term.
- `exams`: AP scores. The highest score is kept for each exam.
- `other`: in the NCSSM layout, a row whose code is not in `data/ncssm-courses.json`, such as a seminar. It is listed by code and title and adds no credit.
- `unread`: lines that look like course rows but could not be matched to one course or one exam. Examples are an unknown code outside the NCSSM layout, a title that fits more than one course, and an AP row with a score that fits no single exam.
- `apCourseHints`: AP exams named by a class title for which no score was read.
- `campus`: set only when the text names exactly one of Durham or Morganton as the school or campus, for example in the school's address. A line labeled as an address is not used.
- `gradeLevel`: senior if a 12th grade heading or statement appears, otherwise junior if an 11th grade one does.

The student confirms what was read. The site lists every course and score it found, each with a checkbox. The student unticks anything wrong and uses the rest. On the first setup screen, Continue also uses the ticked items. Grades can be changed later in Courses. The campus and year from the transcript are filled in only if the student has not set them. The `other` and `unread` lines are shown once in that list and then discarded. After that, the site keeps only course codes, their status and grade band, AP scores, the campus, and the year, and only in memory.

## Refresh the data

```sh
npm run refresh
```

This runs every scraper in `scripts/`, rewrites `data/` and `reports/`, and prints what changed. It never runs git and never commits.

It writes one file for each major under `data/majors/` and then removes any other file it finds there. Do not keep hand-made files in that folder.

### What it fetches

The current data came from 738 URLs. Each one is listed in `data/manifest.json` with its fetch date and a SHA-256 hash of the page.

| Source | URLs |
| --- | --- |
| NCSSM course catalogs | `https://courses.ncssm.edu/course_catalog.php?id=1` (Durham), `?id=3` (Morganton), `?id=2` (Online) |
| University course descriptions | `https://catalog.unc.edu/courses/` and `https://catalog.ncsu.edu/course-descriptions/`, plus every subject page each index links to (157 and 209 pages now, index included) |
| AP credit charts | `https://catalog.unc.edu/policies-procedures/credit-evaluation/` and `https://admissions.ncsu.edu/apply/credit-opportunities/advanced-placement-ap/` |
| NCSSM articulation sheets | Two Google Sheets. UNC-Chapel Hill: `https://docs.google.com/spreadsheets/d/10g_g1nww1EUNV2AAlHBe7_uotrgXwtXMCiSxIOEhIlM/`. NC State: `https://docs.google.com/spreadsheets/d/1ItTyQvD15A5SOQp4ZUBNFQq0ZdIqSFS242mYFzljEO0/`. Each sheet is read three ways: `htmlview` for the list of tabs, `export?format=csv&gid=0` for the rows, and `htmlview/sheet?headers=true&gid=0` for the syllabus links. |
| Major requirements | `https://catalog.unc.edu/undergraduate/programs-study/` and `https://catalog.ncsu.edu/undergraduate/`, plus every major page each index lists (96 and 259 now). UNC minors are skipped. |
| Policy pages | `https://catalog.unc.edu/policies-procedures/credit-evaluation/`, `https://catalog.unc.edu/undergraduate/degree-requirements/`, `https://catalog.unc.edu/undergraduate/ideas-in-action/`, `https://engr.ncsu.edu/academics/undergraduate/coda/`, and a published Google Doc that explains NCSSM's `(*R*)` and `(*M*)` science course markers: `https://docs.google.com/document/d/e/2PACX-1vQln7G8aAN6ndZq1pJztgH4ODepxNeh00Op2SlbMBqZuJSNg3gSB_TYxJRbNZDi-ahNsRH0K4lvJ5dI/pub` |

How it behaves toward those sites:

- It sends one request at a time to each host and waits one second after each. Different hosts run side by side.
- A failed request is tried three times in total, with waits of 2 and 4 seconds.
- It refuses any URL whose path contains `/ribbit/`, `/search/`, `/archives/`, `/pdf/`, or `/courseleaf/`. That list is written into `scripts/lib/http.ts` to match what the catalogs' robots.txt disallow. The script does not download robots.txt itself, so recheck the list if a catalog changes its rules.
- Every page it downloads is saved in `.cache/`, which git ignores.

The busiest host is `catalog.ncsu.edu` with about 470 pages, so a full run takes eight minutes or more.

### Flags

Pass flags after `--`:

```sh
npm run refresh -- --cached
npm run refresh -- --full-diff
```

- `--cached` reuses pages already in `.cache/` and keeps their original fetch dates. Pages missing from the cache are still downloaded. Use it to test a parser change without crawling again.
- `--full-diff` prints every added, removed, and changed record. Without it, the list stops at 40 of each.

### What the diff shows

The script reads the JSON files under `data/` before and after the run and compares them record by record. A record is matched by its `id` or `code`. Files with no record list (`policies.json`, the two `college-lite` files, and each major file) are compared as one record each.

- `+ file#id` is a new record.
- `- file#id` is a record that is gone.
- `~ file#id` is a changed record, followed by up to six changed fields as `path: old -> new`.

The diff skips `data/manifest.json` and `data/summary.json`, and ignores every `fetchedAt` and `sha256` field. A plain re-fetch shows no changes. It also skips any file under `data/majors/` that is not at the path its own `id` gives, so a stray copy does not show up as a record.

After the diff it prints the top of the counts report.

### Review, then commit

1. Run `npm run refresh`.
2. Read the printed diff. Look at removed records first.
3. Read `reports/counts.md` and `reports/majors-review.md`.
4. Run `git diff data reports` for the full detail.
5. Run `npm test` and `npm run build`.
6. Commit `data/` and `reports/` together.

The data is bundled into the site at build time. A refresh reaches students only after the next deploy.

### When it stops and asks for a human

The script stops with an error in these cases:

- One of the three NCSSM catalogs (Durham, Morganton, Online) returns no course listings, or none of its listings can be parsed.
- An articulation sheet does not have exactly one tab. A second tab would hold rows the script does not read.
- An AP chart has an exam name that is not in `scripts/ap-exams.ts`, or the chart has no rows.
- An expected sentence is missing from a policy page.
- A university's program index lists no majors.
- A page still fails after three tries.
- A URL is on the refused list above.

All scraping finishes before anything is written. If the script stops, `data/` and `reports/` are left as they were.

### Reports

- `reports/counts.md`: course, rule, and major counts, the number of rules per flag, every flagged articulation row, and every skipped source row.
- `reports/majors-review.md`: a table of the reasons majors fail, by how many majors each reason affects. Then every `needs-review` major with its catalog URL and each failed check.

## Deploy

The site is the `dist/` folder. `vite.config.ts` sets `base: "./"`, so the built site works from the root of a domain or from any subpath.

### GitHub Pages

`.github/workflows/deploy.yml` runs on every push to `main` and can be started by hand from the Actions tab. It uses Node 26 and runs `npm ci`, `npm test`, and `npm run build`. Then it uploads `dist` with `actions/upload-pages-artifact` and publishes it with `actions/deploy-pages`. A failing test stops the deploy.

One-time setup: in the repository, open Settings, then Pages, and set Source to "GitHub Actions". The workflow asks for the `pages: write` and `id-token: write` permissions that the deploy step needs.

GitHub Pages cannot send custom headers. There the Content-Security-Policy comes from the meta tag only. See the limits under Privacy.

### Netlify

`netlify.toml` sets the build command to `npm run build`, the publish folder to `dist`, and the Node version to 26. It also sends two headers with every file: the same Content-Security-Policy as the meta tag, and `Referrer-Policy: no-referrer`. Connect the repository in Netlify and it needs no other settings. The Netlify build does not run the tests.

## Privacy

What the site does not do:

- It has no backend, no accounts, and no analytics.
- It sets no cookies and uses no localStorage, sessionStorage, or IndexedDB.
- It loads nothing from other sites. Fonts and all other assets are served from the site's own origin.
- It keeps a student's answers in memory only. They are gone when the tab closes or reloads.
- It does not upload or save a transcript. The transcript is read in the tab.

The site has its own privacy policy, in `src/ui/privacy.ts`. Every setup screen and every portal section links to it, and it is also a portal section. If the behavior described here changes, change that text too.

How that is enforced:

- All data is imported into the bundle at build time (`src/data.ts`). There is no API to call. The bundle is split into files on the site's own origin. A university's course data loads once the student has picked that university and either a major or "Not sure yet". Its majors file loads only when a major is picked. pdf.js loads when the student chooses a PDF.
- `npm run build` adds a Content-Security-Policy meta tag to `dist/index.html`. The policy is `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'`.
- Under that policy the browser loads scripts, styles, fonts, images, and workers from the site's own origin only. Images from `data:` URIs are not allowed. Inline scripts do not run. Forms cannot submit anywhere.
- The policy has no `connect-src`, so `default-src 'none'` applies. The browser blocks `fetch`, XHR, WebSocket, and beacon calls from the page, even to the site's own origin.
- On Netlify, `netlify.toml` sends the same policy as a response header with every file, along with `Referrer-Policy: no-referrer`.
- `index.html` sets the referrer policy to `no-referrer`, and each source link carries `rel="noreferrer noopener"`. A click on a source link does not tell the university site where it came from.
- `tests/site.test.ts` checks the source and a fresh build on every `npm test`. See Tests.

Limits of that enforcement:

- The policy tag is in the built site only. The dev server does not add it.
- The policy text is written twice, in `vite.config.ts` and in `netlify.toml`. Nothing checks that the two match. Keep them the same.
- The policy does not cover browser storage. That part holds because the code never calls those APIs. `tests/site.test.ts` scans `src/` and the built scripts for them. It does not scan the pdf.js files.
- pdf.js runs in a worker that is loaded from a file on the site's own origin. By the specification, a policy set in a meta tag covers the page, and a worker loaded from a URL takes its policy from the headers sent with its own file. So a meta-tag policy does not bind that worker in every browser. On Netlify the header is sent with the worker file, so the worker is bound by the policy. GitHub Pages cannot send the header, so there the worker may run with no policy. pdf.js is third-party code. The site hands it the file's bytes and gives it no URL to fetch.
- The host that serves the files (GitHub Pages or Netlify) still sees ordinary request logs, like any web server: the IP address, the time, and which files were asked for. Each university's data is in its own files (`src/majors.unc.ts`, `src/majors.ncsu.ts`, and the two `college-lite` files). So the logs can show which university was picked and whether a major was picked. All majors of one university are in one file, so the logs cannot show which major. The pdf.js files are requested only when a PDF is chosen, so the logs can show that a PDF was read. The logs never show the transcript, courses, grades, or scores.

## How the data is organized

Everything under `data/` is written by `npm run refresh`. Every file carries `schemaVersion: 1`. The record shapes are in `src/types.ts`. Each course, rule, and major record keeps the URL it came from and the date it was fetched.

| Path | Contents |
| --- | --- |
| `data/manifest.json` | Data-as-of date (the latest fetch date), catalog editions, counts, and every fetched URL with its fetch date and SHA-256 hash. |
| `data/summary.json` | The manifest without the URL list. This is the copy the site loads. |
| `data/ncssm-courses.json` | NCSSM courses: code, former and cross-listed codes, title, department, campuses, and the research and math-intensive tags. A course listed under two codes is one record, even when the campuses give the codes in a different order. An empty campus list means a past course. |
| `data/articulation.json` | One rule per articulation sheet row: the NCSSM course or combination, the minimum grade, the credit awarded, the row exactly as written, syllabus links, and flags. |
| `data/ap-credit.json` | One rule per AP chart row: exam, minimum score, the credit awarded, the cells exactly as written, whether it is placement only, and flags. |
| `data/ap-exams.json` | The AP exams that appear in either chart, each marked as a current exam, a subscore, or a retired exam. |
| `data/college-courses.unc.json`, `data/college-courses.ncsu.json` | Every course in each university catalog: code, title, minimum and maximum hours, general education tags, same-as codes, and `noCreditWith`, the courses that cannot earn credit together with this one. |
| `data/college-lite.unc.json`, `data/college-lite.ncsu.json` | Only the university courses that a rule or a major refers to, keyed by code, with title, hours, general education tags, and `noCreditWith`. This is the copy the site loads. |
| `data/majors-index.json` | One entry per major: id, university, name, degree, concentration, college, parse status, and the current-year, CODA, and professional-track marks. |
| `data/majors/unc/`, `data/majors/ncsu/` | One file per major: sections, requirement slots, catalog year, total hours, `parseStatus`, `parseIssues`, and `parseNotes`. |
| `data/policies.json` | Policy sentences quoted word for word with their sources, plus the NC State prefix pairs. |

Two display decisions made by the project owner:

- A course that appears in an articulation sheet but in no current catalog is a past course. It is offered at both campuses in its own group, can be marked completed only, and is never recommended.
- NCSSM Online courses are shown at both campuses.

### Requirement slots

Each requirement in a major file is a slot. Its kind is `course`, `one-of`, `pick-n`, `elective`, or `text`. Some details of how the majors parser fills them:

- Open-ended rows in a linked course list become wildcards (`Slot.wildcards`). Examples are `MAE 2**` and "Any ASTR course above 99". A wildcard holds subjects, an optional lowest and highest course number, and optional exceptions. In the checklist, credit for a specific course that fits a wildcard counts toward that list's slot. Each credit is used once. Generic credit does not fit a wildcard.
- In a list, a row that starts with "or" joins the row above it. A cross-listed code such as `ECE 461/561` is split into its parts. These alternatives share one group (`Slot.altGroups`), and the checklist counts one option from each group.
- A list row that points to another list brings in that list's rows.
- An elective row can carry a highest level and exceptions as well as a lowest level (`Accepts.maxLevel` and `Accepts.except`). "ECON courses at the 400, 500, or 600 level" accepts 400 through 699. "May not include PSYC 493" becomes an exception. A clause such as "with at least one course numbered 500 or higher" is set aside and recorded as a note.
- A group or list worded like "from two different disciplines", "one course from each area", or "two of the three areas" cannot be modeled. It makes the major `needs-review`.

`noCreditWith` is read from university course descriptions that say things like "credit is not allowed for both". 151 UNC-Chapel Hill courses and 489 NC State courses carry it now. The engine counts only one course of such a set. It keeps earned credit before planned credit, then a course that the selected major lists. The other course stays on its row in Credits with the reason and adds no hours.

### `verified` and `needs-review`

Every major has a `parseStatus`.

- `verified` means the parser raised no issue. `parseIssues` is empty. No person reviewed it.
- `needs-review` means at least one automated check failed. Each failure is a line in `parseIssues`.
- `parseNotes` do not change the status. They record things the parser saw and did not model.

### Counts, data as of 2026-11-09

From `reports/counts.md`. Catalog editions: UNC-Chapel Hill 2026-2027, NC State 2026-2027, NCSSM not stated on the source.

NCSSM courses, 394 records in all:

| Group | Courses |
| --- | --- |
| Durham | 266 |
| Morganton | 209 |
| Online | 53 |
| Durham and Morganton both | 156 |
| In an articulation sheet but not in any current catalog | 54 |

Rules and majors:

| | UNC-Chapel Hill | NC State |
| --- | --- | --- |
| Articulation rules | 137 (23 combinations, 48 flagged) | 104 (20 combinations, 43 flagged) |
| AP rules | 75 (9 flagged) | 76 (4 flagged) |
| Majors | 96 (50 verified, 46 needs-review) | 259 (102 verified, 157 needs-review) |
| Majors not on the current catalog year | 0 | 0 |

## What is unverified

No person has checked this data against the sources line by line. Treat every result as an estimate.

### Majors

- `verified` means the automated checks passed. It does not mean a person reviewed the major.
- 203 of 355 majors are `needs-review`: 46 at UNC-Chapel Hill and 157 at NC State. `reports/majors-review.md` lists every one with its catalog URL and each failed check.
- Why majors fail, by number of majors as of 2026-11-09. One major can fail several checks. The table at the top of `reports/majors-review.md` gives the same numbers.
  - 62: a linked course list has a rule that cannot be checked automatically, such as courses from different disciplines.
  - 53: a required course code is not in the university's course catalog.
  - 36: the page gives a semester plan instead of a requirement list.
  - 21: a linked course list does not say how many courses to take.
  - 20: the page has another requirement table with its own total, and that table is not included.
  - 20: a group does not say whether to take all, one, or some of its courses.
  - 19: a row points to a list that could not be linked.
  - 17: a group contains a nested heading or points to another list.
  - 14: a requirement row or group heading has a rule that cannot be checked automatically.
  - 7: a row is indented but has no group heading.
  - 5: the row hours do not add up to the table's stated total.
  - 4: an hours cell could not be read.
  - 1: the table states no total hours.
  - 1: an open-ended list row has exceptions that could not be read.
  - 1: an "or" row has nothing to attach to.
- A `verified` major can still carry `parseNotes`. 112 of the 152 verified majors have at least one. Across all 355 majors, 280 do. The kinds, by number of majors:
  - 190: a choice list names course codes that are not in the course catalog.
  - 166: a list has a row that is not a course and was not read.
  - 145: a list has course codes written as plain text with no catalog link. They are kept as options.
  - 106: a requirement group holds an open-ended option or a note. It is recorded as a note and not modeled.
  - 30: an elective described by level in words is kept as text, so credit cannot fill it.
  - 14: a list row pointed to another list, and that list was brought in.
  - 12: an indented note with no hours is skipped.
  - 11: a row was matched to a course list by its position on the page, not by a name or a link.
  - 6: a sentence about free electives is kept as a note, not a requirement.
  - 6: a row has a further condition, such as "at least one at the 500 level", that is not checked.
- Wildcards are read from the row text by pattern. 21 slots in 18 majors carry them now. A row the patterns do not cover is noted and not applied.
- Wildcards apply only when a requirement row points straight to a list. When a group takes a list as one of its choices, that list's open-ended rows are not applied and a note is recorded. No major has that case now.
- A requirement written as plain text becomes a `text` slot. Nothing can fill it, so the checklist always marks it as a course to take at college. There are 601 such slots across 323 majors.
- An elective requirement with no stated hours is treated as needing 3 hours. There are 519 such slots.
- A program-list entry that does not match the expected name pattern is skipped without a report.
- UNC general education is not a checklist. The site adds a note when more than 5 counted credits carry a Focus Capacity tag, and nothing more.
- Every NC State major under the `/undergraduate/engineering/` catalog path (48 now) is marked as entering through CODA. A major is marked as a professional track by keywords in its name (14 now). Neither mark comes from a statement about that major.

### Credit rules

- UNC limits by-exam credit to 2 courses in the major core and 5 toward Focus Capacities. The quotes are in `data/policies.json`. Whether UNC posts NCSSM course credit as by-exam credit is not confirmed. The project owner decided to apply the limits to AP and NCSSM credit together, and the Sources section says that the NCSSM part is unconfirmed.
- The checklist enforces the major core limit. When a UNC major page does not label its core, the limit is applied to every section.
- UNC's rule that half of the major core must be taken at UNC is quoted in the Sources section. It is not computed.
- Repeated generic elective credit stacks. Two rules that each award `CSC 2**` count twice. Generic credit is totaled apart from specific-course credit. That was the project owner's decision. Whether all of it counts toward a degree is not confirmed.
- Hours are estimated at 3 in two cases, and the credit is marked as estimated. First, generic credit from an articulation sheet (120 awards now). Second, a specific award code that is missing from the university catalog (12 awards now).
- Generic credit from an AP chart takes its hours from the chart's hours column.
- A university course with variable hours is counted at its minimum and marked as estimated.
- NC State renamed some subject prefixes. `data/policies.json` lists 17 pairs, such as `FLS` to `WLSP`. A pair is inferred when the catalog page at the old prefix lists courses under the new one. The site treats old and new codes as the same course by swapping the prefix and keeping the number. NC State has not confirmed that the numbers carried over.
- GEP-coded generic credit, such as `ENG 2GEP`, counts as hours. It can fill a subject elective of the same subject at or above the required level. It is not mapped to a GEP category, so it never fills a GEP requirement.
- A rule with no stated minimum grade is treated as needing a B- or higher. A planned course is assumed to pass.
- A course marked completed by hand starts in the "B or B-" band until the student changes it. That band passes a B- rule and fails a B+ rule. A transcript row with a pass mark and no grade gets the same band.
- A completed course always counts, even if the catalog for the student's campus no longer lists it. A planned course counts only if it is offered at the student's campus or online. A planned course that is not offered there stays marked but is left out of the result (`toProfile` in `src/state.ts`).
- When an AP row awards one course or another, the site counts one. It picks the course that fills a major requirement, or else the one with the fewest hours. The university may choose differently.
- An AP "General Elective" with no subject is given the subject of a specific course awarded for the same exam.
- The "no credit for both" sets come from pattern matching on course descriptions. Wording the patterns do not cover is missed. A pair stated on only one of the two courses is applied both ways. Which course of a set the university would post is its choice. The site's pick is described under "Requirement slots".

### Transcript reader

- The parser was tuned on one real NCSSM transcript layout. The other shapes it accepts were tried only on made-up samples. A transcript printed in a different layout may be read wrongly or not at all.
- A scanned or image PDF has no text to extract, so it cannot be read. The site then finds no courses and asks the student to paste the text or add courses by hand.
- `src/transcript/pdf.ts` rebuilds lines from the positions of text pieces in the PDF. It has no tests. A PDF made by a different tool may come out with different spacing.
- AP classes from a previous school are hints, not scores. A class grade is not an exam score. The student adds real scores under AP exams.
- A blank grade is read as in progress and counted as planned. If the term is older than the latest graded term, the row is marked for checking.
- Numeric grades are banded at 87 and 80. Those cut-offs are the parser's own. A school may use a different scale.
- A title-only row is accepted when it fits exactly one catalog title. A shortened title can still fit the wrong course. Such rows are marked for checking.
- The campus is taken from a line that names Durham or Morganton, such as the school's address. An unlabeled home address near the top of the page could be taken for the campus. The student sees and can change the campus on the next screen.
- What the student confirms is what counts. The parser's result is never used without that step.

### Sources

- The NCSSM catalog prints no catalog year. `data/manifest.json` records it as "not stated on the source".
- A course code found in an articulation sheet but in no current catalog is treated as a past course (54 now). It could also be a typo or a renamed course.
- UNC's own NCSSM credit table at admissions.unc.edu blocked scripted access and was not used. No script reads that site. The UNC rules come from NCSSM's articulation sheet only.
- Each articulation sheet has one tab now, and only that tab is read.
- Four source rows had no readable course code and were skipped. They are listed under "Skipped source rows" in `reports/counts.md`.
- Source rows that look wrong are kept as written and flagged. They are never corrected. The flags and their current counts are below.

Flags set in `scripts/articulation.ts`:

- `course-not-in-catalog` (72): an NCSSM course code on the row is not in any current NCSSM catalog.
- `award-code-unresolved` (12): an awarded course code is not in the university catalog.
- `subject-unknown` (11): the subject prefix of an awarded code is not in the university catalog.
- `institution-blank` (3): the institution column is empty.
- `department-mismatch` (3): on a single-course row, the sheet's department is not part of the department the NCSSM catalog gives for that course.
- `grade-unstated` (2): the grade column names neither B- nor B+.
- `free-text-note` (2): the equivalency cell holds text besides course codes. The text is kept as a note and not interpreted.
- `parenthetical-code` (1): the course cell has an NCSSM code in parentheses. That code is left out of the rule.
- `dangling-separator` (1): the equivalency cell ends with a separator such as `/`, so something may be missing.
- `duplicate-row` (1): the same course cell and equivalency cell appear earlier in the sheet. Both rows are kept.
- `suspicious-code` (1): a generic code ends in `GEPU`, as in `IPUS 2GEPU`.
- `no-award-parsed` (0): no credit code could be read from the equivalency cell.

Flags set in `scripts/ap.ts`:

- `see-footnote` (6): the credit cell ends with an asterisk. The chart's footnote is attached to the rule as a note.
- `award-code-unresolved` (2): same meaning as above.
- `hours-mismatch` (2): the hours of the awarded courses do not add up to the chart's hours.
- `typo-suspect` (1): the exam name is a known misspelling, `Physics C Meachnics`, matched to the intended exam.
- `lab-listed-separately` (1): the credit cell names a lab on its own, as in `BIO 181 Lab`. The lab is not counted as a separate award.
- `hours-not-a-number` (1): the hours cell is not a plain number.

## Tests

`npm test` runs 104 tests in four files. The first three files below use small inline samples and made-up fixtures. They do not touch the network and do not read `data/`. The fourth reads the project's own source files and runs a Vite build, which bundles `data/`.

`tests/scrapers.test.ts` has 31 tests of the parsing functions:

- CSV with quoted commas, escaped quotes, and multi-line cells.
- NCSSM catalog titles split into codes, title, and science markers. A course cross-listed in a different order on two campuses as one record.
- Articulation course cells: every code across separators, former codes kept as aliases, codes in parentheses set aside.
- Equivalency cells: spacing normalized with the raw code kept, generic credit in every source spelling, odd cells flagged and not corrected.
- AP credit cells: credit separated from placement. The footnote read from the list under the chart.
- Program listings split into name, degree, and concentration.
- The catalog year rolling over in June.
- Requirement tables: how much a group heading asks for, what an elective row accepts, code bundles and alternatives, required, one-of, and pick-N slots, groups settled by hours, and a total that does not match its rows.
- Course lists: open-ended rows read as wildcards, exceptions in a footnote sending the major to review, a row that points to another list, a second table that continues a list, "or" pairs and cross-listed codes sharing an alternative group, and unlinked codes kept and noted.
- Elective rows: level floors and ceilings, a sentence about free electives kept as a note, and an elective described by level in words kept as text.
- Rules the parser cannot model sending the major to review.
- Course descriptions that say which courses cannot both earn credit.
- Review reasons counted once per major.

`tests/engine.test.ts` has 46 tests of the credit engine in `src/engine/`:

- The campus filter, with online courses at both campuses and past courses apart.
- Combination rules beating the single-course rules they contain, and merged rows for rules with the same courses.
- Former course codes resolving to the catalog course.
- Grade floors, including the B- default and a B+ rule that blocks a B.
- Earned and planned credit, and the same course from two sources counting once.
- Generic credit stacking and its separate total.
- Where hours come from: the award, then the catalog, then a flagged estimate.
- NC State old and new prefixes as the same course.
- AP score tiers, the combined economics rows, one-of awards, and placement-only rows.
- Checklist filling: one slot per credit, one-of and pick-N slots, electives by subject, level, and GEP tag, and free electives last.
- Wildcards: a pick slot filled by a listed option or by credit that fits a wildcard, and a wildcard credit used once.
- Mutually exclusive courses: only one counts, the rule keeps its awards, and earned credit beats planned credit.
- The UNC major core limit, the Focus Capacity note, the NC State CODA note, and the needs-review flag.
- Recommendations: the ranking, and never suggesting past, off-campus, already held, retired, or zero-gain options.

`tests/transcript.test.ts` has 23 tests of the transcript parser in `src/transcript/parse.ts`:

- Grade bands and title normalization.
- Code rows and title rows under term headings, ragged spacing, wrapped titles, and cells split across lines.
- Title-only rows: a unique match is accepted, and anything short of identical is marked for checking.
- In-progress rows as planned, and a blank grade in an older term not trusted.
- Pass marks as completed with no grade, withdrawn rows dropped, numeric grades banded and never trusted outright.
- Credits, levels, section numbers, teacher initials, and a single capital letter in a title not read as grades.
- Former codes, an unknown code sent to `unread`, and the same course twice.
- AP scores read beside course rows named AP, and an AP class row with a grade never read as a score.
- Campus and grade level only when stated plainly.
- Empty input, page headers, legends, and totals.
- Personal details never appearing anywhere in the result.
- The NCSSM layout: the repeated code column, wrapped titles, other schools ignored, the same result from PDF-style text and from a single-spaced paste, and nothing personal in the result.

`tests/site.test.ts` has 4 tests of the project as a whole:

- No em dash in any `.ts`, `.css`, or `.html` file under `src/`, `scripts/`, and `tests/`, or in `index.html` and `vite.config.ts`.
- No code comment in those same files.
- No `.ts` file under `src/` names a storage or network API: `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, or a `fetch(` call.
- A build into a temporary folder is locked to its own origin. The policy tag has `default-src 'none'`, `script-src 'self'`, and `font-src 'self'`, and has no `unsafe` keyword, no URL, no wildcard, and no `connect-src`. `index.html` loads nothing from another origin. No stylesheet has a remote `url()` or an `@import`. No built script other than the pdf.js files names a storage API or `sendBeacon`.

Not covered by tests: the code that downloads pages, the contents of `data/`, the PDF text extraction in `src/transcript/pdf.ts`, the pdf.js library itself, and the user interface in `src/main.ts` and `src/ui/`.
