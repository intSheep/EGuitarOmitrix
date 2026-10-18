# Design references and functional rationale

Date: 2026-10-18. Status: revised direction based on the owner's explicit correction.

## Product fit comes before visual borrowing

This is an adult's practice companion. The owner wants selected aspects of Duolingo's visual feedback and motion, not a reproduction of its game structure. The earlier mascot, slogan, winding course path, collectible imagery, and oversized colored nodes were rejected. They are not part of the implementation.

The supplied [Duologues article](https://blog.duolingo.com/duologues-design-conversations/) discusses design craft and interaction quality; it is not a pixel specification for this product. It does not establish that a guitar practice tool should use a game map.

## Reference set

These are primary-source references, reviewed on the date above. Descriptions below separate documented patterns from this project's interpretation. No private product account or paid application interface was inspected.

| Reference | What the source establishes | Applied here | Not adopted |
| --- | --- | --- | --- |
| [Material canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) | List-detail and supporting-pane patterns across window sizes | A stable exercise list beside the current source, requirements state, and associated media; compact windows use a focused detail dialog | A generic social feed or a card for every status metric |
| [Radix color-scale roles](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) and [typography](https://www.radix-ui.com/themes/docs/theme/typography) | Different roles for surfaces, interaction states, borders, solid controls, and text; consistent type scales | Neutral hierarchy with one accent, distinct selected/hover/focus states, small tabular source metadata | Installing the React component library or assuming our custom palette inherits its measured contrast guarantees |
| [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion?changes=l_9_3) | Purposeful, brief feedback; avoid distracting motion and respect accessibility preferences | Short hover/selection feedback, restrained button press, reduced-motion support | Constant bounce, animation delays, decorative scene transitions |
| [Fender Practice Mode](https://play-instructor.fender.com/hc/en-us/articles/360047207032-Practice-Mode) | Practice material accompanies a lesson and supports passage/tempo work | Keep the lesson and its supporting resources together; reserve a coherent location for later practice controls | Claiming that notation, backing-track mixing, or BPM control already works here |
| [Ableton Learning Music](https://learningmusic.ableton.com/) | Public chapters and music-focused interactions let learners work directly with musical concepts | Prioritize the work and navigable source content over a promotional hero; keep stage browsing explicit | Copying its layout or importing its musical content |

The Fender and Ableton references are examples of domain-focused experiences, not endorsements or evidence that their complete feature sets suit this MVP. The resulting layout and palette are our product decisions.

## Task-to-interface assessment

| User behavior | Consequence for the interface |
| --- | --- |
| Return to the same exercise many times | Give exercises stable list positions and direct source links. Do not imply that one successful action permanently clears a level. |
| Practice only a few times per week | Treat W1–W7 as source stages. Do not turn time away into locked content, broken streaks, or compulsory catch-up. |
| Select several tasks from one or more lessons | In the next phase, use an editable practice list rather than a mandatory single-path progression. |
| Forget what the teacher assigned | Place source-backed instructions near the selected exercise; keep missing or unreviewed content explicit. |
| Switch between explanation, backing, demonstration, and follow-along | Keep media relationships attached to the exercise. Preserve original page/CID identifiers. |
| Work on duration, clean BPM, rhythm, or physical consistency | Future outcome history belongs to exercise attempts, not video viewing or a single progress ring. |
| Want encouraging feedback | Give accurate state feedback after an actual action. Rewards can be reconsidered after reliable logging; they are not the primary navigation model. |

A linear course path can be useful when each lesson is a short, self-contained completion event with a strong prerequisite sequence. That model has not been established for this course's repeated physical practice. The list-detail choice is an inference from the owner's stated work, and remains open to usability feedback.

## Information architecture

1. **Practice workspace:** choose a course stage, select a real exercise, inspect the current lesson and related resources, open the exact Bilibili page.
2. **Course catalog:** search all source entries, filter stage/type, optionally show older versions.
3. **Feature plan:** explain the next phases without presenting unimplemented logging or score playback as live controls.

Later, a real practice queue and session results can become the default workspace. The initial version must not manufacture a queue, personal statistics, teacher dose, or completion state before those records exist.

## Project visual specification

These are project choices informed by the references, not requirements copied from them:

- White panels on a near-white gray canvas; slate text; one deep teal accent for selection and primary actions.
- Main title around 24–27 px; body 13–14 px; source IDs and video durations use tabular numerals.
- Fine separators, 6–10 px radii, consistent pane padding. Compact but readable rows retain useful context.
- A small abstract six-string mark is sufficient identity. No mascot, stock photo, decorative guitar diagram, slogan, large promotional hero, or staged reward image.
- State changes use about 120–160 ms of restrained feedback. Press feedback translates at most 1 px. No continuous animation; reduced-motion preferences remove transitions and animation.
- Source page, video length, media type, and unreviewed task state use different labels. Unknown practice requirements stay unknown.
- At desktop size, list and details remain visible together. At phone size, the list stays primary and the selected details open in an accessible dialog.

## Evaluation criteria

- Can the learner find an exercise and its video link without scrolling through decorative material?
- Can the learner change exercises without losing stage/list context?
- Are backing tracks and current/old source versions distinguishable?
- Is the difference between video duration and prescribed practice duration clear?
- Does a source launch avoid implying that real practice was completed?
- Are compact layouts, keyboard focus, Escape dismissal, and reduced-motion settings usable?
- Does each prominent element help selection, understanding, or action? Remove it if its only purpose is to look gamified.

Automated checks can cover rendering, links, focus, and responsive overflow. Comfort, density, and visual preference still require the owner's review; they are not claimed as established by screenshots alone.
