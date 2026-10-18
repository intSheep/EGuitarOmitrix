# First-slice validation

Date: 2026-10-18. Scope: FR-017 source navigator and revised adult-oriented list-detail UI. This is not acceptance of the full planned tracker.

## Automated checks

- `npm test`: six passing Node tests covering inventory, unique identity, exact outbound page/CID links for every entry, legacy/type/search filters, shared related-media associations, and navigation-only persistence with unavailable storage.
- `npm run build`: successful static output in `dist/`.
- Real local Chromium `156.0.8078.4` with Playwright: desktop 1440 px and phone 390 px.

Browser scenarios passed:

1. W1 shows nine real current teaching exercises; no mascot/slogan, fabricated backing, or earned personal metrics.
2. Switching to P007 shows its six shared backing-track variants and exact source action.
3. Clicking the source opens a new tab with the expected BV, page, and CID. Local state stores only the source-entry cursor.
4. Stage switching shows W7's ten current lessons. The catalog has 124 entries with old revisions hidden and 140 when included.
5. Search `P070` finds the intended lesson. Details open, and Escape dismisses them.
6. The 390 px workspace has no horizontal overflow. Phone detail links work, and Escape restores focus to the selected row.
7. P017 remains accessible despite missing independent subtitles. A literal nonmatching markup-like query yields an empty result rather than injected content.
8. Reduced-motion mode is recognized. Disabling localStorage does not break browsing or outbound links and produces a clear cursor-persistence notice.
9. No page errors or console errors were observed in these scenarios.

The browser checks used an isolated browser context and synthetic navigation history; no actual learner records or original Downloads files were changed. Screenshots were visually reviewed for the desktop workspace and phone view.

## Environment caveat

The restricted command sandbox did not expose the same live filesystem/socket behavior as the local host: an initial Node test command reported only a file-level result, and browser/socket startup failed there. The commands above were rerun outside that sandbox and produced six actual test results, a serving local page, and the completed browser scenarios. Do not cite the earlier sandbox-only output as runtime evidence.

## Limits

- Browser outbound requests to Bilibili were intercepted in the isolated QA context to verify the exact navigation target without depending on external login or playback. This does not establish successful playback on Bilibili.
- The source snapshot was observed on 2026-10-18; page ordering can change. Revalidate an updated manifest rather than assuming a stored page remains current forever.
- No task extraction/review, practice timer/history, offline app cache, full backup, score conversion, score playback, GP8 launch, or public deployment is implemented.
- Visual comfort and workflow suitability still need owner feedback. Automated checks do not prove that the design is the owner's preferred final direction.


## Brilliant visual revision — 2026-10-18

- Owner-provided Brilliant screenshot inspected directly; latest Stitch desktop `28e363c036c0459088b87a3e4336f2fe` generated and inspected.
- Local Chromium 156.0.8078.4: 1440 px desktop, 820 px tablet and 390 px phone checked; no horizontal overflow; tablet retains both panes.
- Selection, exact Bilibili page/CID popup targets, six related P007 media entries, catalog search and legacy filters, missing subtitles, phone dialog and Escape focus restoration passed.
- Reduced-motion and unavailable-storage fallback passed; no browser console or page errors. Six existing Node tests and static build passed.
- Outbound requests were intercepted for destination assertions; actual Bilibili playback was not tested. No fabricated practice completion or teacher prescription was added.


## Assignment / manual-record / resume slice — 2026-10-18

- Inventory: 72 distinct teaching CIDs, 66 current and 6 legacy; 64 AI-subtitle candidates plus 8 visually inspected closing video cards. Source file SHA-256 and evidence ranges retained. Unknown numbers stay unknown. No full subtitles, video frames, audio or scores committed.
- 12 Node tests passed, including inventory/provenance, invalid records, unknown BPM, resume ordering, deletion exclusion, backup schemas and conflicting-version rejection.
- Isolated Chromium 156.0.8078.4 passed: empty state, draft reload, actual save and reload, double-click duplicate prevention, edit, soft-delete/restore, export, identical-import deduplication, future-version rejection, fresh-profile restore, two-tab stale-edit rejection, cross-stage resume, phone save and 820 px overflow check.
- Simulated unavailable IndexedDB and write/quota failure: no false saved state, failed form inputs retained. Markup-like notes render literally. No page errors. Reduced-motion behavior and video-card source links verified.
- Browser QA uses fresh contexts and synthetic records only; the owner's active browser database was never touched. The committed `scripts/verify-practice.mjs` can reproduce this against the local server with Playwright available. Optional environment variables: `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `EGUITAR_QA_URL`. It writes synthetic backups/screenshots under `/tmp`.
- Static build and whitespace checks passed. Source video playback itself was not tested. No automatic timer, multi-exercise session grouping, offline shell, tempo scoring, notation conversion or GP8 launch is delivered.

## 2026-10-18 — Focus sessions and effort review (#12)

- `npm test`: 16 tests passed, including interruption/pause accounting, local midnight allocation, timer-log validation and existing catalog/content invariants.
- `npm run build` and `git diff --check`: passed.
- `scripts/verify-practice.mjs`: passed in isolated Chromium 156 contexts, with no access to the user's browser profile. Verified one start control, no manual duration input/disclosures, pause and refresh recovery, exclusive ownership for both resume and finish across tabs, WebAudio control state, one material video-launch action, atomic finish without duplicate records, optional outcome updates, backup export/import, reversible deletion, blocked-storage behavior, synthetic transaction failure and retry, v1 database migration preserving notes, hidden-page pause, and reduced motion.
- Browser layouts checked at 1440, 820 and 390 pixels; no horizontal overflow. Desktop focus, completion and phone focus screenshots inspected. No sample logs were written to the live profile or repository.
- Sound scheduling and controls were exercised in headless Chromium; subjective audio quality and timing on the user's physical output device are not verified. Sleep is simulated in pure-clock tests, not a physical suspend/resume test. No CI workflow was triggered. Full offline loading, cloud sync and notation conversion remain outside this slice.

## 2026-10-18 — Storage recovery and flat catalog (#14)

`verify-storage-recovery.mjs` passed with isolated browser storage: a real v1 database connection blocks v2 opening; repeated retry clicks preserve the pending request; closing the old tab restores the app without reloading (a window identity marker survives); a synthetic temporary open failure recovers with retry. Catalog rows and 390 px layout were verified and desktop/mobile screenshots inspected. All 16 unit tests, build and existing practice browser regression passed. User records were not accessed or modified.

## 2026-10-18 — Grouped course library (#18)

Stitch output and implemented desktop/mobile screenshots inspected. `verify-catalog.mjs` passed for chapter grouping, stage/type/search/legacy filters, zero-result reset, overview stage zero, exact exercise and material actions, and 820/390 px overflow checks. `verify-storage-recovery.mjs` passed against the new catalog. All 16 unit tests and static build passed. Browser contexts were isolated and contained no user records.

## 2026-10-18 — Video score preparation and embedded playback (#20)

- Installed and ran pinned video-frames skill `f0d30f9dc8274aa664ba68b528cd3b6d13dd3509`; inspected the script first. FFmpeg/Pillow candidate extraction produced one candidate group for the static P026 region and four for scrolling P073 (candidate groups are heuristic, not page counts).
- P026: 4 measures; P073: 10 measures. Rebuilt XML validates against W3C MusicXML 4.0 XSD using a local-only resolver. Compared original/rebuilt note/rhythm signatures; GP export/reimport preserves checked bar, duration, pitch, string/fret and tie fields.
- `npm test`: 18 tests passed. `npm run build` and whitespace checks passed.
- `verify-scores.mjs`: both actual local pilots render, playback state toggles, BPM and loop controls work, source-frame views open, downloaded GP reimports with expected measure counts, and 390 px overlay avoids overflow. Screenshots inspected. Tests use isolated browser storage.
- Existing `verify-practice.mjs` passed after integrating score controls; learner data was not accessed. Live preview restarted to load ES-module/font/audio resource types.
- Not verified: native Windows Guitar Pro 8 import, subjective physical audio output, full-score technique equivalence across all importers. Remaining 70 teaching entries are not transcribed. Standard tuning is assumed in the two pilots and documented in local manifests. No course score/media files were committed.

## 2026-10-18 — Embedded-audio GP chain (#22)

20 unit/integration tests pass, including a synthetic audio packaging test with lead-in offsets, exact embedded-byte recovery and sync recovery within one millisecond, invalid/unsupported anchors and refusing overwrite. Existing source videos and user storage were not modified. `verify-audio-score.mjs` passed in isolated Chromium: embedded WAV decoded and time advanced, half-speed changed the media rate, pause/close stopped playback, and download/reimport retained audio and anchors. Build and diff checks passed. This does not establish subjective audio quality or musical alignment.

The actual P073 export is a demonstration-audio **candidate**, not a verified P072 backing. P072 first-bar alignment remains pending. GP8 was not accessed: Windows computer-use initialization failed on the WSL workspace URI before any app observation. See [pipeline and acceptance gates](../research/audio-score-pipeline.md). #22 remains open for independent backing synchronization and GP8 acceptance.

## 2026-10-18 — Further pure-backing candidates (#24)

P018, P020 and P021 passed MusicXML 4.0 schema validation, GP note/rhythm/audio/sync round trips, and isolated Chromium audio playback/rate/pause/close/download checks. Actual rendered staff notation was inspected. 22 tests passed, including staff-only rest/dotted-duration round trips and rejection of invented technical fields. Owner listening is pending for these three files; the P072 6.54-second version is separately owner-accepted. See [batch evidence and remaining queue](../research/score-batch-two.md). Source audio and transcriptions remain local/ignored.

## 2026-10-18 — Remaining backing-score pass (#26)

All 19 canonical embedded-backing GP files pass browser decoding/playback/rate/pause/close/download checks, including corrected P104/P139 dead-note exports. 25 tests pass, including synthetic chord ties, tuplets, repeats, technique endpoints, grace notes, bends, dead notes and staccato. Production build passes. Local MusicXML source/published copies pass schema validation. P018/P020/P021 are now owner-accepted; the earlier pending statement is superseded. Fifteen new backing alignments remain candidates. GP8 native inspection was not available. See [delivery and coverage limits](../research/remaining-score-delivery.md). All media and prepared notation remain ignored.

## 2026-10-18 — C-major position quick reference (#28)

- 26 local unit tests passed, including pitch/degree/root consistency for all five standard-tuning reference patterns.
- `npm run build` passed.
- `scripts/verify-position-reference.mjs` passed in isolated 1440, 768 and 390 px Chromium contexts: all five selections, note-name toggle, no horizontal overflow, Escape dismissal, focus restoration from the focus page and nested score dialog, and continued practice timing.
- Inspected the 390 px screenshot. The white panel and blue active position follow the retained Stitch direction. Course scores and private learner records were not committed or used as test records.
- This validates the reference feature only; remaining course-score transcription and GP8 checks remain tracked under #26.

## Remaining examples and multi-score viewer (2026-10-18)

Requirements FR-018/019, issue #26. Local delivery contains 96 GP scores, two XML-only scores, 16 reference-image sets and six standalone backing files. The local bundle is 208,618,571 bytes before any later source correction; it is not committed.

- 29 Node tests pass, including explicit short-measure validation, refusal to write a GP that loses the final short measure, triplet rests, edition-aware multi-example indexing, trial exclusion and natural image ordering.
- All 96 canonical GP files parse and survive GP export/reimport with the musical-field signature unchanged. All 97 canonical MusicXML files pass the MusicXML 4.0 schema. This does not establish source transcription perfection or native GP8 rendering fidelity.
- Existing accepted P018/P020/P021/P072 GP hashes match their recorded manifests. Index references resolve; ZIP integrity check passes.
- Isolated Chromium at 1440 and 390 px passes multi-piece selection (P070), XML-only short-bar playback/download restrictions (P049), image-only references (P101), and embedded backing selection (P072). GP download is byte-identical to the prepared P072 file. A delayed index fetch does not overwrite a manually loaded score. No personal history was used or changed.
- `npm run build` passes. Mobile screenshots were inspected; redundant rendered score titles are hidden because the lesson and selected piece are already named in controls.

Native GP8 opening, subjective listening and complete frame-by-frame video review remain unperformed. Synchronization candidates retain their prior status. Image-only diagrams do not assert duration or practice dosage. Unspecified source tempo is recorded as a playback default in local provenance.

## Quiet practice guidance (2026-10-18, issue #31)

- Stitch screen `81c7c0c7db7949b7b393aaed69cfaded` was generated and inspected before completing the interface; retained/rejected decisions are recorded in the design rationale.
- 32 unit tests pass. New coverage checks metronome time accounting across BPM changes/pause/sleep, unknown stable BPM, same-version resume, fixed/no-metronome constraints, nullable goals, old/new backup validation and conflicting goal rejection.
- `scripts/verify-guidance.mjs` passes in isolated Chromium contexts at 1440, 768 and 390 px: goal setup, no practice-time dialogs, observed metronome usage, no preselected proficiency/BPM, persisted confirmation recovery, save and same-lesson resume. P003 retains its teacher-fixed 40 BPM even after a synthetic self-report of 35 BPM and personal target of 80 BPM. A synthetic quota failure retains inputs/draft and retries without a duplicate result. Conflicting goal import rolls back log additions; stale goal updates are rejected.
- `scripts/verify-practice.mjs` passes after adapting its finish action to the confirmation screen: timing pause/reload, cross-tab lock, one video launch, atomic finish failure/retry, result revision, backup/import, deletion/restoration, responsive views, reduced motion, blocked storage, v1 database migration and hidden-page pause.
- `npm run build` passes. Finish/resume screenshots were visually inspected at phone width; no horizontal page overflow was observed. Tests use fresh synthetic browser profiles, never personal history.

The reload check waits for the draft write to commit before reloading, as a business-state synchronization boundary. This does not promise survival of a browser/process kill during an unfinished IndexedDB write. No microphone grading, score-player tempo telemetry, external GP telemetry, automatic promotion or scheduled notification is implemented or claimed.

## Instructor-linked daily progress (2026-10-18, issue #33)

- 35 unit tests pass. Added coverage for multiple same-day sessions, draft/save deduplication, deletions, other lessons/assignment versions, local-midnight splitting, excess time, missed-day non-carryover, absent evidence and explicitly unknown dose/BPM. Real metadata regressions cover P003 fixed 40 BPM, P017 percentage/per-piece instructions, P070 unknown final BPM, P117 unknown daily duration and P137 unknown absolute BPM.
- `scripts/verify-daily-progress.mjs` passes in isolated Chromium at 1440 and 390 px: synthetic two-minute practice against a five-minute requirement shows three remaining, yesterday's forty minutes do not change the target, live time increments and pause holds, saving does not double count, and unknown dose has no progress denominator. No page errors/overflow observed. Source and phone screenshots were inspected.
- Existing `scripts/verify-guidance.mjs` passes at 1440/768/390, including fixed-tempo restrictions, finish confirmation, recoverable drafts, failed-save retry, goal-import rollback and same-lesson resume. Production build passes.
- The initial browser assertion used a fixed 2.2-second wait and raced the one-second display tick. It now waits for the expected observed progress value, not an arbitrary sleep.

This change consumes existing evidence-linked assignment metadata; it is not a fresh audio audit of the whole course. Daily duration remains nullable where previously unresolved. Daily completion changes no saved proficiency state. No data migration or personal record changes were needed.
