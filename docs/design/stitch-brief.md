# Stitch design brief

Date: 2026-10-18. Status: PRD-stage exploration, not approved UI or implemented frontend.

Project: [EGuitarOmitrix — Practice at Your Pace](https://stitch.withgoogle.com/projects/5204896374042541007). The create operation returned a private Stitch project.

One Today-screen generation was requested. The request returned a transport error; subsequent project screen listings did not expose a completed screen. Do not claim a mockup was delivered or regenerate blindly while an earlier request may still be running. This document is the design handoff if generation remains unavailable.

## Audience and tone

A busy adult practicing electric guitar in irregular sessions. Calm, direct, and welcoming after a break. Make the next action clear and make accumulated progress durable. Avoid streak pressure, red overdue queues, leaderboards, and generic charts without actionable meaning.

All project documents are English. Proposed learner UI copy is Simplified Chinese because the course and owner conversation are Chinese; this is a product assumption that can change independently of documentation language.

## Visual direction

Warm off-white background, graphite text, restrained forest-green primary action, amber for review-needed states. Generous type and touch targets; a quiet practice-notebook feel. No stock guitar photography is needed. Desktop serves planning/review; mobile serves fast logging beside the instrument.

Use labeled synthetic records in design tools. Do not upload full transcripts, videos, actual learner history, or score files. Source-derived example values may illustrate the distinction between teacher instructions and personal planning without being represented as a verified curriculum.

## Screen map

| Screen | Main job | Required states | PRD links |
| --- | --- | --- | --- |
| Today | Resume and choose a time budget | First use, returning after a gap, no approved task, 5/15/30/custom budget | FR-007–FR-009 |
| Course and lesson | Understand progression and find work | Reviewed/draft/missing subtitle, current/older versions, related media | FR-001–FR-006 |
| Evidence review | Compare a candidate to its source | Unknown quantity, conflicting instruction, visual dependency, approve/edit/reject | FR-003–FR-006 |
| Practice and finish | Focus on a task and record the result | Running/paused/interrupted, partial finish, manual log, save failure | FR-010–FR-012 |
| Progress | Understand what improved and what needs work | No history, sparse week, repeated practice, incomparable versions | FR-013–FR-014 |
| Data/settings | Configure intentions and preserve work | Local-only status, backup, restore preview, missing attachment | FR-015–FR-016 |

No playable-score, conversion, or native-launch interface is required in the current design scope. Those remain research only.

## Today concept prompt

Create a mobile concept for EGuitarOmitrix. Use Simplified Chinese UI and show a subtle demo-data label. Heading: continue at your own pace. Course W1 is a learning stage, not a calendar deadline. Offer 5 / 15 / 30 minutes and a custom choice. With 15 selected, suggest three activities totaling 15 minutes: five minutes of relaxed downstrokes, six minutes of melody review, and four minutes of rhythm work. These allocations are app suggestions, not teacher instructions. Show the first task's original instruction separately: five minutes daily, 40 BPM, no speeding up. Add a source/time reference, the quality focus, and a prominent Start action above the fold. Show fictional weekly activity of two sessions out of a self-selected three, with 35 total minutes. Use Today / Course / Progress navigation. The return-after-a-gap message must preserve progress without guilt.

The first prompt was submitted for project `5204896374042541007`; it is not an implemented or approved screen.

## Review criteria

- Can the owner identify the next exercise and start within 30 seconds?
- Are the teacher's original dose, today's allocation, and actual work visually distinct?
- Are unknown values displayed as unknown, rather than zero or plausible invented targets?
- Can the owner log a partial session without having to mark a skill as mastered?
- Is source evidence reachable without cluttering the practice surface?
- Are review-needed, empty, interrupted, and failed-save states designed?
- Do 390 px and desktop layouts preserve readable controls, keyboard focus, and text status cues?
- Are demonstrated records clearly fictional and research-only features absent from implementation claims?

Record future screen IDs, review date, and accepted deviations here before frontend implementation.
