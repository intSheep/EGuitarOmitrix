# Design references and functional rationale

Date: 2026-10-18. Status: Brilliant-inspired revision requested by the owner.

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

The owner supplied a screenshot of Brilliant's Arithmetic Thinking course page from [Mobbin](https://mobbin.com/screens/45ede6ec-1ebd-498f-9a48-2636087f1be4). The attached image was inspected directly; the Mobbin URL could not be read. This is evidence of the static visual style only, not of its animation behavior.

- White canvas, near-black heavy headings (30 px phone, 36 px desktop), royal-blue primary accent `#3f5cf0`.
- Rounded 20–24 px outlined panels and generous spacing; black active navigation underline.
- Primary actions have a dark-blue 5 px bottom edge, a 4 px press displacement, and a subtle local blue glow. These motion values are our implementation choices.
- Circular exercise numbers support scanning. Blue marks selection only; unselected exercises remain available, with no locked progression.
- One original SVG geometric fretboard illustration provides a musical visual cue. No copied Brilliant assets, mascot, motivational slogan, rewards, or fabricated progress.
- Stable list-detail navigation supports repeated practice. Mobile uses the existing accessible detail dialog.
- Reduced-motion preferences remove animation and transitions. Unknown assignments remain explicit.

## Evaluation criteria

- Can the learner find an exercise and its video link without scrolling through decorative material?
- Can the learner change exercises without losing stage/list context?
- Are backing tracks and current/old source versions distinguishable?
- Is the difference between video duration and prescribed practice duration clear?
- Does a source launch avoid implying that real practice was completed?
- Are compact layouts, keyboard focus, Escape dismissal, and reduced-motion settings usable?
- Does each prominent element help selection, understanding, or action? Keep decorative imagery small and subordinate to the actual exercise and source action.

Automated checks can cover rendering, links, focus, and responsive overflow. Comfort, density, and visual preference still require the owner's review; they are not claimed as established by screenshots alone.

## C-major position reference (2026-10-18)

The owner clarified that the quick-reference button means the five C-major scale positions, not the starting fret of a chord. Stitch project `6723020998384701419`, screen `3a92fe2b586a4308821380f551098cbf`, informed the white modal, blue selection controls and horizontal six-string diagram. Generated course labels, rewards, pinning and unrelated tuner controls were discarded.

The reference is an independently constructed standard-tuning C-major note map, not an additional instructor assignment or inferred practice sequence. Position ranges align with the visible course diagrams (P047, P031, P082, P067 and P015). Some course diagrams show only the exercised strings; the reference supplies the complete conventional scale pattern. Notes are computed from string tuning and fret, with no inferred finger numbers, tempo or repetitions. Root notes use both shape and color. A visible switch changes scale degrees to note names. Opening the modal does not change the practice timer, score playback or metronome. Native dialog behavior supplies Escape dismissal and focus restoration.

### Multi-example score selection

The completed course collection uses the existing score viewer, retaining the restrained controls and white canvas of the approved design and the position-reference Stitch exploration above. A single native **本课乐谱** selector appears only for lessons with multiple prepared items; source-only chord diagrams use the same viewer. No new dashboard, explanatory disclosure arrows, reward UI or fabricated exercise sequence was introduced. Redundant score titles inside the renderer are hidden to avoid clipping long names on phones; titles remain in the selection control and exported files.

## Quiet finish and resume (issue #31)

Stitch project `6723020998384701419`, screen `81c7c0c7db7949b7b393aaed69cfaded` generated the finish/resume/goal exploration. Retained: prominent observed duration, separate stable-BPM input, three equal proficiency options, white/blue tactile controls, and a compact next-visit summary. Rejected: mandatory proficiency, synthetic production data, extra reflection fields, explanatory footer cards, nested summary containers, duplicate navigation, and long qualification copy. The implementation is a dedicated finish page, not an interruption during practice. Goals open only through the learner's explicit settings action. Examples in Stitch are synthetic, not real history.

No proficiency is preselected, and metronome usage never fills the stable-BPM input. The workspace keeps one start/resume button. Targets and teacher prescriptions retain separate headings. Graphical progress represents planned time or weekly session counts, never skill mastery.
