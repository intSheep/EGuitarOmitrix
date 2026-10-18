# Stitch design brief

Date: 2026-10-18. Status: revised reference-led direction implemented for the initial video-navigation slice; visual preference remains subject to owner review.

## Current project and output

- [EGuitarOmitrix — Practice Workspace](https://stitch.withgoogle.com/projects/6723020998384701419), private project.
- Desktop screen: `projects/6723020998384701419/screens/266b12d02e4449d88c123f37aee52f56`.
- Design references and functional analysis: [references and rationale](references-and-rationale.md).

The current Stitch screen was generated successfully and visually inspected. It establishes a mature list-detail direction. Its generated source is not treated as authoritative course data or as a working application.

## Owner's direction

Borrow selected aspects of Duolingo's style and feedback, not its game structure, mascot, slogan, or layout. The product must support returning to an exercise repeatedly, switching associated media, recovering instructor requirements, and eventually logging real practice.

The earlier private project `5204896374042541007` produced mascot/course-path concepts. The owner rejected that direction; those screens are superseded and their assets are not included in the app.

## Reference-led requirements

- Use Material's list-detail pattern to keep exercise selection and source context together.
- Use a neutral visual hierarchy informed by Radix's semantic color/typography guidance.
- Keep motion short and purposeful, following Apple HIG principles and reduced-motion preferences.
- Use music-product references such as Fender Practice Mode and Ableton Learning Music to prioritize the activity and lesson-associated materials.
- Keep exact requirements and source relationships driven by the real local catalog. A generated design must not invent teacher instructions, personal progress, or media features.

## Information architecture

| Screen | Main job | First-slice behavior | Later work |
| --- | --- | --- | --- |
| Practice workspace | Select an exercise repeatedly and open its source | W1–W7 stage selection; desktop list/detail; phone dialog; direct video links; actual associated media | A real editable practice queue and source-backed instructor tasks |
| Course catalog | Find a source anywhere in the course | Search page/title, filter stage/media kind, optional older versions, exact outbound links | Refresh/import adapters |
| Feature plan | Communicate delivery order | Current source navigation, next practice recording, deferred score work | Not a simulated user-progress dashboard |

## Visual specification

Near-white canvas, white panels, dark slate text, one deep teal accent. Fine borders and 6–10 px radii. A small abstract six-string mark identifies the tool. Headings and spacing should favor useful content density; no promotional hero is needed.

Hover feedback is about 120 ms; selected content may transition for 160 ms; press feedback moves at most 1 px. Reduced-motion mode removes transitions and animations. Text and focus cues communicate state independently of movement.

Both human and Agent documentation are English. Learner UI is Simplified Chinese, while original titles, BV/CID identifiers, and technical notation stay recognizable.

## Implementation corrections to generated output

- Retained the overall list-detail hierarchy, quiet palette, compact stage selection, and prominent source action.
- Used actual catalog titles, durations, page numbers, CIDs, and related-media associations; generated durations are not trusted.
- Removed generated utility icons and audio/player-ready states because no tuner, metronome, score player, or audio integration exists in this slice.
- Preserved an explicit pending state for instructor assignments; no source-backed task catalog has yet been approved.
- Implemented a responsive phone dialog and keyboard/focus behavior directly; the superseded game-map mobile concept is not the phone implementation reference.

## Review criteria

1. Selection and the original video action are immediately visible.
2. Stage/list context remains stable while changing exercises.
3. Related backing/demo material is attached to the right exercise and revision.
4. Viewing a source does not claim practice completion or mastery.
5. Unknown assignments, source duration, and actual practice duration cannot be confused.
6. Phone layouts, keyboard focus, Escape, and reduced motion remain usable.
7. Decorative elements are absent unless they help selection, understanding, or action.

Stitch suggested a full-catalog view, a feature-plan view, and a dark variant. The first two are implemented with actual metadata; a dark theme remains optional and is not required for the current slice.
