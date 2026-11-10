---
name: Dragon Credit Map
description: An unofficial student portal that shows how NCSSM courses and AP scores become college credit.
colors:
  green: "#1f6b45"
  on-green: "#ffffff"
  green-tint: "#e7f1ea"
  red: "#c9463d"
  blue: "#2f5fa8"
  blue-tint: "#dfe8f5"
  amber: "#8f5b0c"
  amber-tint: "#f8ecd6"
  ground: "#ffffff"
  paper: "#f5f0e8"
  ink: "#23211d"
  soft: "#615c54"
  line: "#d9d5cc"
  rail: "#e4e0d7"
  edge: "#8a857b"
  green-dark: "#63c592"
  on-green-dark: "#0d1f15"
  green-tint-dark: "#1d2b22"
  red-dark: "#ee7d72"
  blue-dark: "#93b8f2"
  blue-tint-dark: "#1c2940"
  amber-dark: "#e5ab4f"
  amber-tint-dark: "#33270f"
  ground-dark: "#171512"
  paper-dark: "#221f1a"
  ink-dark: "#f1ede4"
  soft-dark: "#b0ab9f"
  line-dark: "#3b362e"
  rail-dark: "#2e2a24"
  edge-dark: "#8f887c"
typography:
  figure:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "6rem"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  display:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  display-setup-wide:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "4.25rem"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  display-portal:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title-row:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 400
    lineHeight: 1.38
  body:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
  label:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
  control:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 700
  meta:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
  fine:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
rounded:
  mark: "2px"
  bar: "3px"
  quiet: "10px"
  tab: "12px"
  field: "14px"
  action: "16px"
  panel: "18px"
  pill: "99px"
spacing:
  control-gap: "0.45rem"
  row-gap: "0.6rem"
  block: "1rem"
  gutter: "1.25rem"
  group: "1.5rem"
  section: "2.5rem"
  columns: "3rem"
  portal-gap: "3.5rem"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.on-green}"
    typography: "{typography.button}"
    rounded: "{rounded.action}"
    padding: "0.2rem 1.4rem 0"
    height: "56px"
  button-primary-disabled:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.soft}"
  button-secondary:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.action}"
    padding: "0.2rem 1.4rem 0"
    height: "56px"
  button-quiet:
    textColor: "{colors.soft}"
    rounded: "{rounded.quiet}"
    padding: "0.3rem 0.5rem"
    height: "44px"
  link-action:
    textColor: "{colors.green}"
    typography: "{typography.label}"
    height: "44px"
  chip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 1rem 0"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  score-button:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  score-button-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  choice-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.panel}"
    padding: "1.05rem 1.1rem"
  choice-row-selected:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 1rem"
    height: "54px"
  tab:
    textColor: "{colors.soft}"
    typography: "{typography.label}"
    rounded: "{rounded.tab}"
    padding: "0.15rem 0.5rem 0"
    height: "44px"
  tab-current:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green}"
  pill-unofficial:
    textColor: "{colors.soft}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.7rem 0.15rem"
  transcript-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.4rem"
  notice-unofficial:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.85rem 1rem"
  notice-warning:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.9rem 1rem"
---

# Design System: Dragon Credit Map

## Overview

**Creative North Star: "The Paper Ledger"**

Dragon Credit Map looks like a clean ruled ledger a student keeps for themselves: white ground, one warm paper tone for the places where something is handed over or stated, warm near-black ink, and a single green that says "this is the tool, and this is the next step". Results are not boxed. They sit in ruled lists that open under a 2px ink rule and separate with 1px hairlines, so a long checklist reads as one page of a ledger, not a wall of tiles.

The voice is large, plain, and short. Each setup screen opens with one very heavy full-sentence prompt, and the portal Overview opens with one very large number. Everything below those is quiet: soft grey supporting text, small bold labels, tabular figures wherever hours or counts appear. Meaning that matters (earned, planned, open, take at college) is carried three ways at once: a text label, a shape, and a blue or amber color.

Both themes are designed. The light theme is white and paper; the dark theme is a warm near-black with the same roles, re-tuned so every text pair keeps its contrast. The line map direction that was built first and replaced is the confirmed anti-reference: no route rails, no interchange capsules.

**Key Characteristics:**
- White ground, warm paper second surface, warm ink. No cool greys.
- One green for theme and action. Blue and amber for status. Red only on the dragon mark.
- Ruled lists under a 2px ink rule in place of result cards.
- One heavy sans family, Overpass, from weight 400 to 900, self-hosted.
- Status is a label plus a shape plus a color, never a color alone.
- Flat. No drop shadows anywhere.
- Phone first. Every control is at least 44px tall.

## Colors

A warm neutral page with one green voice; blue and amber appear only where something has a status. Dark-theme values are the same tokens with a `-dark` suffix in the frontmatter and are applied by `prefers-color-scheme` or by the theme button in the header.

### Primary
- **Dragon Green** (`green`, with `on-green` for text on it): the theme and action color. Primary buttons, links, the current setup step, the current section tab's text, the caret, native checkbox and radio accents, text selection, list markers, the rank numerals in ranked picks, and the border of a selected choice row.
- **Green Tint** (`green-tint`): the fill behind a selected choice row and the current section tab.

### Secondary
- **Status Blue** (`blue`, `blue-tint`): credit that counts. Solid for earned or covered, hatched blue over the tint for planned. Also the keyboard focus ring (3px, offset 3px), which is its only use outside status.
- **Status Amber** (`amber`, `amber-tint`): needs attention. The ring on an open requirement, the "No credit" label, the bold lead of a warning, a flagged source row, and a transcript line the reader was unsure about. The tint is the fill of warning notices.

### Tertiary
- **Dragon Red** (`red`): the dragon mark in the header and the favicon. Nothing else.

### Neutral
- **Ground** (`ground`): the page, inputs, and the resting fill of every chip and secondary button. In the light theme it is pure white, which the user chose as the theme ground.
- **Paper** (`paper`): the second surface. The transcript panel and the "Unofficial estimate" notice.
- **Ink** (`ink`): text, the 2px rule that opens every ledger, the selected fill of chips and toggles, and the square "take at college" mark.
- **Soft** (`soft`): supporting text, field labels, resting tab text, placeholders.
- **Line** (`line`): 1px row dividers and the 2px resting border of chips, toggles, choice rows, and secondary buttons.
- **Rail** (`rail`): unfilled tracks. Remaining setup steps, the "take at college" share of a requirement meter, the disabled primary button, loading placeholders.
- **Edge** (`edge`): the stronger border for things that must read as empty and fillable: text inputs and the unselected radio dot.

### Named Rules
**The Blue And Amber Rule.** Status never relies on red against green. Good or counted is blue, needs attention is amber, and every status also carries a text label and a shape.

**The Green Is Not A Verdict Rule.** Green is the theme and the action color. It never means passed, earned, covered, or correct. If a state needs a verdict, it gets blue or amber.

**The One Red Rule.** Red appears on the dragon mark only. It is never an error color; errors and warnings are amber.

## Typography

**Display Font:** Overpass Variable (with Overpass, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** the same family
**Label/Mono Font:** none; figures use Overpass tabular numerals

**Character:** One family doing everything, from weight 900 set tight for prompts and totals down to regular for reading. The contrast between the very heavy display line and the quiet grey text under it is the hierarchy; there is no second face.

### Hierarchy
- **Figure** (900, 6rem, line-height 0.78, -0.04em, tabular): the credit total on the Overview. One per screen. A 2.4rem version sits under the sidebar tabs on wide screens.
- **Display** (900, 3.25rem, line-height 0.98, -0.035em, balanced wrap): the one prompt or title per screen. Setup prompts grow to 4.25rem from 720px wide; portal section titles are 2.6rem.
- **Headline** (800, 1.4rem, line-height 1.15, -0.02em): group headings inside a screen. 1.2rem inside long prose.
- **Title** (800, 1.35rem, -0.02em): the name on a choice row and the transcript panel title (1.3rem). A row-size title (800, 1.08rem, -0.01em) names a ranked pick or a collapsible requirement section.
- **Lede** (400, 1.15rem, line-height 1.38, soft, max 44ch): one or two sentences under the display line.
- **Body** (400, 1.0625rem, line-height 1.45): default text. Prose is capped at 62ch.
- **Label** (700, 0.95rem): tabs, the header name, legends, requirement group names. Chips and toggles use 0.88rem; field labels are 600 at 0.9rem in soft.
- **Meta** (400, 0.85rem, soft): the second line of any row. Fine print is 0.8rem.

### Named Rules
**The Counting Figures Rule.** Any number a student might compare (hours, counts, course codes, scores, ranks) is set in tabular figures.

**The Sentence Rule.** Every heading and label is sentence case. There are no uppercase labels and no letter-spaced small caps anywhere in the build.

**The Plain Words Rule.** Copy is plain and short, and interface text contains no em dashes. Use a period, a comma, or a colon.

## Layout

Phone first, single column, with a 1.25rem gutter that respects the safe-area insets. The app is a column: header, then either a setup screen or the portal.

- **Setup screens** are a centered column capped at 41rem. Order is fixed: three-segment progress bar, display prompt, lede, content, then an action bar that sticks to the bottom edge over a ground-colored fade, with the privacy line under it.
- **The portal** is one column below 960px: the four result tabs sit in a sticky four-column row under the header with the running total on one line beneath them, and the reference tabs wrap below. From 960px it becomes a 13.5rem sticky sidebar and a content pane (max 54rem) with a 3.5rem gap; tabs stack vertically, the reference tabs sit under a hairline, and the running total moves under the tabs beneath a 2px ink rule. The whole frame is capped at 74rem.
- **Two-up content** appears only where the pieces are peers: paired choice rows from 560px, and the Overview's requirements and next picks side by side from 1180px with a 3rem gap.
- **The credits table** is a real four-column table from 700px. Below that each row becomes a two-column grid: source and credit full width, then status left and hours right, with the unit word shown inline.
- **Course rows** stack name, toggles, and grade bands on a phone, and resolve to one line from 960px.

Vertical rhythm is loose around headings and tight inside rows: 2.5rem above a group heading, 1.5rem above a major block, 1.25rem between stacked controls, 1rem above lists, 0.45 to 0.6rem between sibling controls. Rows have 0.7 to 0.95rem of vertical padding.

Motion is one grammar. A screen or section arrives with a single 0.3s fade and 8px rise on `cubic-bezier(0.16, 1, 0.3, 1)`. Controls change color over 0.15 to 0.18s on the same curve, buttons press to 0.985 scale, and the setup progress segments change color over 0.4s. Under reduced motion every animation and transition is switched off.

## Elevation & Depth

Flat. There are no drop shadows in the build. Depth is tonal and ruled: paper against ground for a second surface, a 2px ink rule to open a ledger, 1px hairlines between rows. The only layered effects are the sticky phone tab row (ground fill with a hairline under it) and the sticky action bar, which sits on a gradient from ground to transparent so content fades out beneath it. One `box-shadow` exists, and it is an inset 2.5px amber ring that draws the open segment of a requirement meter, not a shadow.

### Named Rules
**The Flat Page Rule.** Nothing lifts off the page. If something needs separating, rule it or put it on paper.

## Shapes

Soft and round, with radius tied to role: full pills (99px) for chips, toggles, grade bands, the Unofficial pill, and the earned and planned bar; circles for score buttons and radio dots; 18px for choice rows and the transcript panel; 16px for the two large buttons; 14px for inputs and notices; 12px for tabs. Small bars are barely rounded (3px on setup steps, 2px on meter segments).

Borders are 2px on anything tappable and 1px for dividers. The one dashed border in the system is the transcript panel, because it is the one place a file can be dropped.

Status marks are 16px shapes drawn in CSS, and each status has its own silhouette:
- **Earned or covered:** a filled blue circle.
- **Planned:** a blue circle, left half filled.
- **Open or no credit:** an amber ring.
- **Take at college, placement only, or replaced:** an ink square with 2px corners.

Bars repeat the same code: solid blue for earned, a 135 degree blue hatch over blue tint for planned, an amber outline for open, a rail fill for the share to take at college.

The dragon mark is the only illustration: a single-path vector head with a round eye, 1.5rem in the header, colored by `red` with the eye in `ground`. There are no raster images and no icon set. The disclosure chevron is drawn with two borders.

### Named Rules
**The Shape Carries It Rule.** A status mark must be readable in one color. Circle, half circle, ring, and square are never swapped or reused for anything else.

## Components

### Buttons
Large, round-cornered, and plainly labeled; the primary one is the only green block on a screen.
- **Shape:** softly rounded (16px), 56px tall, weight 800 at 1.05rem.
- **Primary:** green fill, `on-green` text, no border. Fills the action bar on setup; sits inline at its natural width elsewhere, including as the "Choose a file" label over a hidden file input.
- **Secondary:** ground fill, 2px line border, ink text at weight 700. Used for Back, Discard, Start over, and for "Continue without a transcript", where it takes the full bar width in place of the primary.
- **Hover / Focus:** secondary border darkens to soft; both press to 0.985 scale. Focus is the global 3px blue outline at 3px offset.
- **Disabled:** rail fill with soft text.
- **Quiet:** borderless text button in soft at 0.85rem, 44px tall (the theme switch). Its link form is green, underlined 2px with a 4px offset, and is used for "See every requirement" style moves between sections; a small inline form sits inside a sentence with an enlarged hit area.

### Chips, toggles, grade bands, score buttons
One family, one selected state.
- **Style:** ground fill, 2px line border, weight 700 at 0.88rem, 44px tall pills. Score buttons are 44px circles with tabular numerals at weight 800.
- **State:** hover darkens the border to soft. Selected is an ink fill with an ink border and ground text, for filter chips, Completed and Planned toggles, grade bands, and score buttons alike. Selection is exposed through `aria-pressed` or a checked radio, never by color alone.

### Choice rows
- **Style:** a full-width label wrapping a hidden radio: 2px line border, 18px radius, a 24px ring dot with a 5px edge-colored border, a title, and an optional soft second line. A compact form (14px radius, 20px dot, 1.05rem title) is used for the long major list.
- **State:** hover darkens the border. Selected takes a green border, green tint fill, and a green dot with a filled center. This is a choice the student made, not a status.

### Inputs / Fields
- **Style:** 54px tall, 2px edge border, 14px radius, ground fill, with a soft 600-weight label above. The paste area is the same treatment as a resizable textarea.
- **Focus:** the border turns green, inside the global blue outline.
- **Checkbox rows:** a native 22px checkbox tinted green by `accent-color`, with a label and an optional soft second line, 44px minimum height.

### Navigation
- **Header:** the dragon mark and name at weight 700, the outlined "Unofficial" pill, and the quiet theme button.
- **Setup progress:** three 6px segments; done and current are green, the rest rail.
- **Section tabs:** borderless 44px buttons in soft at weight 700; hover turns the text ink; the current tab has a green tint fill and green text and carries `aria-current`. Four result tabs first, then five reference tabs in a second group.
- **Running total:** the credit total under the result tabs. One 0.85rem line on a phone; a 2.4rem weight 900 figure under a 2px ink rule on wide screens, hidden while the Overview shows the large figure.

### Ledgers
The system's container. A list or table that opens with a 2px ink rule and separates rows with 1px lines, with no fill, no radius, and no side borders.
- **Credits table:** source, credit, hours (right-aligned, tabular, weight 800), and a status cell with a shape and a label.
- **Requirement list:** collapsible sections, each a 2px ink rule, a row-size title, and a "filled" count; rows are a status shape, the requirement with a soft detail line, and the status label at the right in blue, amber, or ink.
- **Ranked picks:** a green weight 900 numeral, a row-size title, soft detail lines, and an "Add as planned" chip.
- **Course and exam picker:** name with a soft detail line, then toggles or score buttons.

### Meters
- **Earned and planned bar:** a 16px pill outlined 2px in blue, solid for earned and hatched for planned, with a two-item legend beneath that repeats the shapes and gives the hours in words.
- **Requirement meters:** 10px segmented bars, one per requirement group, with a "filled of total" count beside the group name and a key above that names each shape.

### Notices
- **Unofficial estimate:** a paper block (14px radius) with a bold lead and a link to Sources. Present on every results section.
- **Warning and flagged row:** an amber tint block (14px radius) with an amber bold lead; the body stays ink.

### Transcript panel (signature)
The one dashed container: paper fill, 2px dashed line border, 18px radius, 1.4rem padding. It has four states in the same frame: an invitation with a primary "Choose a file" and a "Paste the text instead" disclosure; a reading state with two breathing rail placeholders; a review state titled with what was found, listing each course as a ticked checkbox row grouped under term headings (each group opens with a 2px ink rule), with unsure lines noted in amber, then "Use N items" and Discard; and an empty state with a retry. It appears first in setup and again inside a collapsible panel on Courses.

## Do's and Don'ts

### Do:
- **Do** give every status a text label, a shape, and blue or amber. Check each new status in greyscale.
- **Do** use the ink fill as the single selected treatment for toggles, grade bands, score buttons, and filter chips.
- **Do** open result lists with a 2px ink rule and divide rows with 1px lines.
- **Do** keep one display line or one figure per screen, at weight 900, with a soft lede under it.
- **Do** set hours, counts, codes, scores, and ranks in tabular figures.
- **Do** design every new surface in both themes, using the token pairs; never a raw hex in a component.
- **Do** keep every tap target at least 44px tall and keep the visible 3px focus outline.
- **Do** self-host every asset. The page loads nothing from another origin.
- **Do** write copy as short plain sentences in sentence case.
- **Do** park all motion under `prefers-reduced-motion`.

### Don't:
- **Don't** let red against green carry meaning anywhere.
- **Don't** use green for a verdict (earned, covered, passed). Green is theme and action only.
- **Don't** use red outside the dragon mark, including for errors.
- **Don't** add a second selected style for a pressed control.
- **Don't** put results in a grid of identical stat cards, and don't box ledger rows.
- **Don't** bring back the line map: no route rails, no interchange capsules.
- **Don't** add drop shadows.
- **Don't** use an em dash in interface text.
- **Don't** add comments to any code file. Explain design decisions here, not in the source.
- **Don't** use NCSSM, UNC, or NC State logos, colors, wordmarks, or mascots. Name them in plain text.
- **Don't** store anything or call another origin to achieve a visual effect.
