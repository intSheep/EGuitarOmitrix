# Saved practice summary

Date: 2026-10-20. Issue: #44. Requirements: FR-010, FR-012, FR-013; ADR 0004.

The owner requested a redesign of the saved-session summary after identifying a
curved checkmark and misaligned edit/return controls in an attached screenshot.
The screenshot was inspected directly. The change preserves the approved
[Brilliant visual direction](references-and-rationale.md) and the existing
practice-review workspace.

## Stitch reference and decisions

Stitch project `6723020998384701419`, generation session
`4710488643388392599`, produced **EGuitarOmitrix - 练习完成结算凭证
(Saved Practice Completion Receipt)**. Its generated screenshot was downloaded
and visually inspected. Screenshot file:
`projects/6723020998384701419/files/d4602d6367d0431ca69a8fbb8653b5ca`.
The screen-list API returned no screen identifier, so the generation and file
identifiers are recorded instead of inventing one.

Retained: the compact outlined receipt, a small straight-line checkmark tile,
duration and self-report in two columns, three equal proficiency choices, and
an aligned action footer. Phones stack the summary and actions. The actual
buttons are 50px high, with equal widths and equal 5px lower edges; both retain
the app's existing press feedback and reduced-motion rules.

Rejected: generated physiological proficiency criteria, duplicated duration
text, qualification paragraphs, course pills, date/database badges, fabricated
history, new navigation, CSV actions, and changes to the established global
palette or fonts. The existing optional teacher-explanation action remains a
text link in the footer when the learner selects `learning`.

## Behavior and verification boundary

The checkmark is an inline SVG path rather than a font glyph. Proficiency stays
explicit, nullable and reversible. Stable BPM remains a separate self-report;
historical untyped BPM is labeled as recorded speed. Notes, next focus and
metronome-use evidence remain visible when present. There is no storage change,
automatic mastery, new training criterion or fabricated production record.

Actual application screenshots at 1440px and 390px were visually inspected.
Isolated browser checks also covered 768px and 320px, matching control dimensions,
optional text, saving, editing, reload and same-lesson return. These checks use
synthetic records and establish layout and interaction behavior in Chromium;
owner aesthetic acceptance remains open.
