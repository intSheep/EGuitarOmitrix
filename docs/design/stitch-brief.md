# Stitch design brief

Date: 2026-10-18. Status: revised reference-led direction implemented for the initial video-navigation slice; visual preference remains subject to owner review.

## Current project and output

- [EGuitarOmitrix — Practice Workspace](https://stitch.withgoogle.com/projects/6723020998384701419), private project.
- Current desktop screen: `projects/6723020998384701419/screens/28e363c036c0459088b87a3e4336f2fe`. Previous workspace screen `266b12d02e4449d88c123f37aee52f56` is superseded.
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

The latest owner reference is Brilliant: white canvas, black heavy headings, royal blue actions with a dark 5 px bottom edge, outlined 20–24 px panels, and a small original geometric fretboard SVG. The six-string brand mark uses the same blue. Preserve exercise browsing and exact video links; no locked path or invented progress.

Hover feedback is about 120 ms; selected content may transition for 160 ms; primary press feedback moves 4 px. Reduced-motion mode removes transitions and animations. Text and focus cues communicate state independently of movement.

Both human and Agent documentation are English. Learner UI is Simplified Chinese, while original titles, BV/CID identifiers, and technical notation stay recognizable.

## Implementation corrections to generated output

- Retained the list-detail hierarchy, white/blue palette, outlined panels, stage selection, and tactile source action.
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
7. A small geometric musical illustration is allowed; decoration must remain secondary to selection and source access.

Stitch suggested a full-catalog view, a feature-plan view, and a dark variant. The first two are implemented with actual metadata; a dark theme remains optional and is not required for the current slice.

## Brilliant revision — 2026-10-18

The owner explicitly requested redesign based on the attached Brilliant screenshot. A Stitch edit succeeded against the prior desktop screen and was visually inspected. The generated illustration screen is `4c01fb6eeaac47f4961b06b342ac69ca`; the application uses an original lightweight SVG instead. The local application adopts the white/blue palette, outlined rounded panels, circular exercise indices, geometric musical illustration, and tactile primary action while preserving functional source navigation. Static screenshots do not establish the reference product's actual motion behavior.

The latest generated screen introduced unsupported requirement text, account controls, and document links. These were rejected. Actual catalog titles and durations remain authoritative; the generated claim that metadata was fully preserved was not relied on. Stitch also suggested mobile, dark-mode, and additional-stage variants; these were not separately generated. Responsive mobile behavior was verified in the application.
