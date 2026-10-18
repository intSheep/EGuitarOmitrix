# ADR 0003 — Observed focus sessions

Date: 2026-10-18. Status: accepted for the owner-authorized focus slice, issue #12.

## Decision

Replace manual duration entry with a foreground stopwatch. One exercise is selected per session. A session carries a stable ID, assignment version, wall-clock intervals and accumulated milliseconds. `performance.now()` checks wall-clock continuity. A gap over five seconds or divergence over one second pauses without counting the gap. The timer updates and persists once per second; an abrupt process termination can lose the last uncommitted second. Pauses, hidden pages, route exits and video launches stop sound and timing. A restored draft starts paused. This measures attended elapsed time, not verified playing or detected skill.

The existing IndexedDB database name remains `eguitar-practice-v1`; database version 2 adds a `session` store without rewriting the `logs` store. A Web Lock owns the single active draft across tabs. Ownership is retained while paused in that tab, until finish or tab closure, preventing another tab from taking over an unfinished session silently. Finishing adds the uniquely identified log and deletes the draft in one transaction. Failed saves retain the in-memory draft and offer the same finish control for retry. Browser storage can still be removed externally; export remains necessary.

Timer records retain `minutes` for existing backup compatibility and add `source: timer`, `seconds` and ordered `intervals`. Their outcome may be null; metronome tempo is never claimed as achieved BPM. Existing manual records retain their duration, outcome, BPM, notes and next focus. Backups remain schema 1 with additive validated timer fields. Older clients may reject unrated timer records and must be upgraded before restoring them. Import performs a preview and additive atomic merge, rejecting conflicts instead of overwriting.

Charts use the browser's local calendar and split actual intervals at local midnight. The visible chart is explicitly the last seven days, not a Monday-based calendar week. The heatmap covers the last 84 days; older logs remain in totals and history. Changing device timezone changes date allocation, not absolute duration.

The WebAudio metronome schedules four-beat clicks in a short lookahead queue. It starts only after a user gesture, stops with timing, and uses fixed BPM where prescribed. No-metronome exercises omit the tool. Adjustable values are bounded to 20–300 BPM. It is a practice aid, not notation playback, recording, a tuner or audio evaluation.

## Deferred

No automatic exercise promotion, planner, source approval editor, offline service worker, cloud synchronization, score conversion or native app launch. Existing source uncertainties remain in the content inventory and timestamped evidence; the regular practice UI presents the usable prescription without extraction-process badges.

## Blocked upgrade recovery — issue #14

`onblocked` is a pending upgrade state, not a terminal connection failure. Keep its original open request alive and notify the UI. The catalog renders while storage waits. When the old connections close, the same request succeeds and loads records and the paused draft before enabling practice. Repeated retry clicks share one pending attempt; genuine connection failures can create a new attempt. No storage deletion, reload, or automatic session resumption occurs. A persistent notice explains the required action and exposes retry.
