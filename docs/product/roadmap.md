# Roadmap

Date: 2026-10-18. Dates and effort estimates are intentionally uncommitted. This is a dependency-ordered plan; GitHub holds live work status.

| Milestone | Outcome | Requirement coverage | Exit gate |
| --- | --- | --- | --- |
| M0 — Requirements and feasibility | PRD, source inventory, playback research, private repo, management conventions | PRD v0.2 and first-slice authorization | Initial video navigation authorized; broader tracker remains planned |
| M1 — Reviewed content and design | Reference-led adult practice workspace and reviewed source catalog | FR-001–FR-006; UX requirements | List-detail direction implemented; instructor-task review remains pending |
| M2 — Practice tracking MVP | First source-navigation slice, then flexible plan, logging, progress, local backup/restore | FR-001–FR-017; NFR-001–NFR-008 | FR-017 implemented; full tracker acceptance remains pending |
| M3 — Playback decision | Actual score-format inventory and a go/no-go decision on web and/or GP8 | R-001–R-003 follow-up | Separate authorization required before any player, conversion, or native-launch implementation |

M3 can be reconsidered before or after M2. It is not a hidden dependency of the core tracker.

## Initial backlog

1. [#1 — Review PRD v0.1 and choose MVP scope](https://github.com/intSheep/EGuitarOmitrix/issues/1) — M0 — Requirements and feasibility.
2. [#2 — Review a W1 assignment pilot against course evidence](https://github.com/intSheep/EGuitarOmitrix/issues/2) — M1 — Reviewed content and design.
3. [#3 — Design core practice and review flows in Stitch](https://github.com/intSheep/EGuitarOmitrix/issues/3) — M1 — Reviewed content and design.
4. [#4 — Implement course import and evidence review](https://github.com/intSheep/EGuitarOmitrix/issues/4) — M2 — Practice tracking MVP.
5. [#5 — Implement flexible planning and reliable practice logging](https://github.com/intSheep/EGuitarOmitrix/issues/5) — M2 — Practice tracking MVP.
6. [#6 — Implement progress, local persistence, and backup restore](https://github.com/intSheep/EGuitarOmitrix/issues/6) — M2 — Practice tracking MVP.
7. [#7 — Inventory score sources and decide browser versus GP8 playback](https://github.com/intSheep/EGuitarOmitrix/issues/7) — M3 — Playback decision.

Issue [#9](https://github.com/intSheep/EGuitarOmitrix/issues/9) tracks the authorized source-navigation implementation and revised task-focused design. Broader implementation issues stay in Backlog until their inputs and scope are ready. Notation conversion and native-launch work remain deferred.

## Dependency notes

- Real course content depends on review, not merely successful subtitle download.
- M1 may manually fill missing W1 teaching content; full automated ASR is not a prerequisite.
- The current implementation follows the revised Stitch/list-detail direction and ADR 0001. Instructor-task publication and durable practice storage are separate follow-up decisions.
- The owner currently does not know of separate score files and only identifies notation in the videos. Score production effort is therefore unresolved.
- A native launcher is not required to evaluate a downloaded GP8-compatible score.
- No automatic reminder, scheduled crawl, public deployment, or score conversion is part of the initial source-navigation slice.

## Latest delivery update — 2026-10-18

Issue #10 adds the assignment/manual-record/resume loop on top of PR #8. All 72 lessons have source-backed summaries; 64 remain AI-subtitle candidates and 8 use visually reviewed video cards. Manual logs, history, edit/delete/restore, backup merge and resume are implemented. This is partial progress against the larger import/planning/progress issues, which remain open. Timer, automatic planning, offline shell and score conversion are not included.

## Focus revision — issue #12

The owner subsequently authorized timed focus sessions and effort review. ADR 0003 replaces new manual duration entry while preserving old records. The simple metronome and consolidated materials are part of this slice. Automatic planning, offline shell and score conversion remain deferred.
