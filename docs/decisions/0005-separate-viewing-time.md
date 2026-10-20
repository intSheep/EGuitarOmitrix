# ADR 0005 — Direct materials and separate viewing time

Date: 2026-10-20, Asia/Shanghai. Status: owner-authorized, issue #41.
Requirements: FR-005/010/013/015/017/021.

## Decision

Replace the material selector and separate launch action with source rows that
open their exact Bilibili page/CID directly. Put the teaching episode first and
its source-backed assignment timestamp next, followed by associated resources.
Keep current and legacy sources distinct. The owner-approved white, black and
royal-blue list-detail workspace remains the visual baseline.

Opening a resource pauses practice and sound. A separate external-viewing draft
measures wall time from launch until return to the app, including background time.
Returning through focus, visibility or in-app navigation freezes the candidate
duration. A visible stop control covers browsers that do not deliver return events.
The learner confirms the interval, reduces it to actual viewing time in minutes
and seconds, or discards it. Confirming or discarding resumes practice only when it was running
before the video launch and the same live page/session still owns the clock.

External playback, pause and completion are unavailable to this application.
The record is a learner-confirmed viewing interval, not verified playback or
attention. Sleep, shutdown and time away cannot be identified reliably in the
external player; interrupted drafts explicitly ask the learner to remove gaps.
Reload restores a pending review rather than adding time to any confirmed total.
Adjusted duration cannot exceed the observed interval or 24 hours per record.
Backward clock changes never generate negative time. Blocked popups start no
draft. Unsupported or unavailable storage permits source access without recording.

## Persistence and concurrency

IndexedDB keeps its existing name and upgrades to version 3, adding `watches`
without rewriting practice records or goals. The `session` store holds the
unconfirmed `watch` draft. The existing activity Web Lock excludes concurrent
practice/viewing from other tabs. Draft comparisons inside transactions protect
against stale saves. Saving adds one viewing record and removes its draft
atomically; failure retains the draft and editable input. Deletion is reversible.

Backup schema 3 carries `logs`, `goals` and `watches`; schema 1/2 imports remain
supported. Import validates every record and previews additions and duplicates.
Practice, goals and viewing records merge in one transaction; any conflict rolls
back all additions. Unconfirmed drafts and course media are excluded from exports.

Learning totals show practice plus confirmed viewing with each component visible.
Practice counts, daily requirements, practice charts, resume guidance, BPM and
proficiency continue to derive exclusively from practice records. Viewing history
retains the exact source identity, including related resources and old versions.

## Limits

No embedded external player, playback-position telemetry, native app launch helper,
recording, cloud synchronization or automatic planning is included. Browser-local
storage remains subject to deletion by the user or browser. Synthetic browser
acceptance does not establish real Bilibili playback or physical user attention.

## Owner refinement: automatic return continuation

On 2026-10-20 the owner requested eliminating the repeated Continue click after
page switches. Automatically suspended practice now carries an in-memory session
ID. Visible return to the focus route resumes from fresh wall/monotonic clock
baselines and excludes the away gap. Visibility returns preserve the current
inline tool. Duplicate return events cannot start a second resume.

Explicit pause/tuning/finish, a failed persistence operation and a new page load
clear that intent. An unconfirmed external-viewing draft blocks continuation;
save/discard then resumes formerly running practice. A previously paused practice
session, including one recovered after reload, stays paused. Sound and microphone
capture require their existing explicit controls. No storage schema change is
required.
