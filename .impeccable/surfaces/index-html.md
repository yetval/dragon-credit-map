---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface: the Dragon Credit Map app (index.html)

Scope: the whole single-page app. Visitor mode: Operate. Audience: an NCSSM junior or senior, usually on a phone. Job: hand over a transcript (or mark courses by hand), confirm campus, year, university, and major, then work in a portal that shows the credit total, the credit ledger, the major checklist, and what to take next. Constraints: fully in-browser, no storage, no third-party requests, blue vs amber status with label and shape, no em dashes in copy, light and dark, a privacy policy reachable from every screen.

History: on 2026-11-09 the user first chose The Line Map from the decision page, then, after seeing it built, asked for a dashboard-style portal instead of the line treatment, with a short setup first. The portal structure was confirmed through a structured question with layout previews. The line map is the anti-reference: no route rails, no interchange capsules.

## Direction contract

THESIS: A student portal. Three short setup screens, transcript first, then a dashboard with a sidebar of sections. It refuses the wizard that ends in one long results scroll, and it refuses the grid of identical stat cards.

OWN-WORLD: White ground with warm paper as the second surface, warm near-black ink, one green as the theme and action color, a small warm red only on the dragon mark, blue and amber reserved for status. Ruled ledgers under a 2px ink rule instead of boxed cards; one dashed paper panel for the transcript drop. Type: Overpass, heavy and tight at display size, tabular figures for hours and counts. Status marks are shapes: filled blue circle, half blue circle, amber ring, ink square.

STORY: The student drops in a transcript and sees what was read. Two confirmations later they are in a portal where the total, the requirements, and the next courses are each one tap away and stay editable.

FIRST VIEWPORT: Setup: header with the dragon mark, name, and Unofficial pill; a three-segment progress bar; a very large prompt that runs to two lines on a phone because each prompt is a full sentence; the transcript drop panel; Continue at the thumb edge with the privacy line and policy link under it. Portal: section tabs across the top on a phone and down the left on a wide screen, with the running total under them; the Overview opens on the total, the earned and planned bar, then requirements and next picks side by side.

FORM: Portal dashboard, pinned by the user over the earlier rolled and picked directions; seed key c7d71675. Signature interaction: the transcript read, where a dropped file turns into a ticked list of courses and grades the student confirms. Motion grammar: one calm fade and rise on arrival at a screen or section, meter and progress fills, everything parked under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
