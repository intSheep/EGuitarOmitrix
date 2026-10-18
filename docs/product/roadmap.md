# Roadmap

Date: 2026-10-18. Dates and effort estimates are intentionally uncommitted. This is a dependency-ordered plan; GitHub holds live work status.

| Milestone | Outcome | Requirement coverage | Exit gate |
| --- | --- | --- | --- |
| M0 — Requirements and feasibility | PRD, source inventory, playback research, private repo, management conventions | All requirements defined; R-001–R-003 researched | Owner reviews scope and chooses whether to begin the tracker |
| M1 — Reviewed content and design | Small verified W1 catalog and Stitch flows; remaining coverage gaps explicit | FR-001–FR-006; UX requirements | Representative tasks checked against source, design accepted, storage/import ADR written |
| M2 — Practice tracking MVP | Flexible plan, logging, progress, local backup/restore | FR-001–FR-016; NFR-001–NFR-008 | End-to-end acceptance scenarios and owner pilot pass |
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

Implementation issues stay in Backlog until their scope is approved. A core MVP decision does not authorize the research-only playback branch.

## Dependency notes

- Real course content depends on review, not merely successful subtitle download.
- M1 may manually fill missing W1 teaching content; full automated ASR is not a prerequisite.
- Frontend implementation follows a Stitch review and a storage/import decision.
- The owner currently does not know of separate score files and only identifies notation in the videos. Score production effort is therefore unresolved.
- A native launcher is not required to evaluate a downloaded GP8-compatible score.
- No automatic reminder, scheduled crawl, public deployment, or runtime implementation is part of M0.
