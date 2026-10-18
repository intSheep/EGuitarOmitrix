# Implementation guide for Agents

Status: source navigation, requirements and timed focus/review are authorized. ADR 0003 supersedes ADR 0002 for new session capture; legacy records remain readable. Broader planner contracts below remain proposed. Read [the PRD](../product/PRD.md) and [research scope](../research/practice-playback.md) first.

## Boundaries

- Import adapter: user-selected files to normalized source entries and timed evidence. Never mutates the original package.
- Extraction: evidence to candidate fields; may run separately from the app. A model is optional at runtime.
- Review/catalog: human corrections, approval, and versioned exercise definitions.
- Planner: approved exercises plus availability and prior outcomes to a proposed session.
- Practice store: user-confirmed attempts and editable history, independent of source refresh.
- Progress: derived views from confirmed attempts, never from playback or page views.
- Score/player adapters: research only; no dependencies, runtime, or launcher should be added in the present scope.

## Proposed records

| Record | Minimum semantic fields |
| --- | --- |
| Course | Internal ID, provider, source ID, title, revision, imported time |
| SourceEntry | Stable `bvid + cid`, observed page/title, kind, stage, availability, source URL |
| Transcript | Entry ID, revision/checksum, language, format, AI/manual provenance, optional timed cues |
| EvidenceSpan | Source/transcript revision, start/end seconds or untimed text span, raw wording, review state |
| ExerciseVersion | Stable exercise ID and immutable version, stage, category, linked entries, prescription, quality criteria, publication state |
| PrescriptionField | Value/unit/basis, evidence references, origin, confidence/review flag; nullable when absent |
| PracticePreference | Weekly session intention, available minutes, chosen focus, time zone |
| SessionDraft | ID, active intervals, paused/interrupted state, plan snapshot, pending edits |
| Session | ID, start/end timestamps, local time zone, confirmed duration, status, revision |
| Attempt | Session ID, exercise version, actual seconds, optional reps and unit, tempo/context, quality checks, note |
| ExerciseProgress | Exercise ID, self-reported state, state history, last practiced and next focus |
| Backup | Schema version, export time, content versions, records, settings, excluded-media/relink manifest |

Do not confuse extraction confidence with a calibrated probability or playing quality. A known zero and an unknown value are distinct. Document nullable fields and units before writing a schema migration.

## Invariants

1. Source identity does not depend on title or page order. Re-import the same source/checksum idempotently.
2. Exercise identity is independent of an episode: a backing track and a teaching episode may support the same task.
3. Do not conflate older/current exercises sharing `Wn-EXm`. Explicitly review their relationship.
4. Every instructor-derived number has field-level evidence. Learner-authored overrides identify their author and origin.
5. A per-day duration does not establish sessions-per-day, minutes-per-session, or repeats. Store the basis explicitly.
6. An approved task version is not overwritten. Changes produce a new version; logs retain the version practiced.
7. Planned time, active elapsed time, and confirmed actual time are separate. Pause intervals and unresolved sleep gaps are excluded from confirmed totals.
8. A session is counted once if it contains confirmed positive practice duration. A practiced day is a distinct local date, not a session count.
9. For midnight crossings, split duration by actual active intervals and local dates; session count belongs to its local start date. Manual logs without intervals require a chosen date and stay labeled manual.
10. Attempts must not double-count concurrent elapsed time. Require review when manually entered attempt totals exceed session duration.
11. Tempo comparisons require the same exercise version or an explicit compatibility mapping, passage, beat basis, and quality criteria. Attempted and clean BPM are distinct.
12. Timer completion, media launch, or looping cannot establish skill mastery. State transitions are user-controlled and reversible.
13. Source refresh cannot delete records or edits. A destructive restore/import requires a preview and retains a recoverable backup.
14. Future-schema backups are rejected without partial writes. Use transaction-like import with a rollback path.
15. No course text goes to a cloud model by default. Provider keys do not belong in a browser bundle or repository.

## Candidate validation examples

- P003: `duration = 5 minutes`, `basis = per_day`, `frequency_sessions_per_day = null`, `fixed_bpm = 40`, `allow_increase = false`; values require their distinct evidence spans and review.
- P070 closing passage: `duration = 30 minutes`, `basis = per_day`, `start_bpm = 40`, `target_bpm = null`; do not manufacture a target by borrowing another lesson's speed.
- A 15-minute session may allocate 5 + 6 + 4 minutes as an app suggestion. It is not an instructor-authored schedule.
- A missing subtitle for P017 produces a coverage gap and manual-review entry, not an empty approved task.

Examples illustrate semantics only. They must not be seeded as approved tasks or learner records.

## Implementation decisions to make later

The initial product is a single-user, browser-local application. ADR 0001 selects buildless HTML/CSS/ES modules and navigation-only localStorage for FR-017. Choose durable practice storage, offline delivery, import bundle format, and model-provider boundaries before implementing the broader tracker. ADR 0002 selects IndexedDB for manually reported records; timer/session and offline-shell choices remain separate. If a local service or desktop wrapper is later selected, preserve export compatibility and keep local ownership explicit.

Test source adapters and schema migrations with synthetic or authorized isolated fixtures. Never let a test alter the original Downloads packages or daily practice history.

## Verification by milestone

- Content: complete inventory, no duplicate imports, missing tracks surfaced, all numeric fields source-backed, manual corrections retained.
- Planner: sparse weeks, multiple daily sessions, five-minute budgets, skipped sessions, source constraints against speed increase.
- Logging: pause/resume, refresh, sleep, manual entry, editing/deletion/undo, midnight, storage failure, duplicate save prevention.
- Progress: comparable tempo series, unknown values, revised/retired tasks, no playback-time inflation.
- Persistence: offline read/write after initialization; valid export/restore; corrupted and future-version rejection without data loss.
- Design: refer to Stitch screen IDs and annotate departures. Generated HTML or images alone are not browser acceptance evidence.
- Playback research: report documented capabilities and untested assumptions. Do not report a library test, score conversion, or GP8 launch unless separately authorized and actually run.

Documentation-only changes need link, consistency, and diff checks. Do not invent a passing runtime test suite when no application exists.
