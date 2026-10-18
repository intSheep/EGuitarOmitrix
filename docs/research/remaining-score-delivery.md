# Remaining backing-score delivery

Date: 2026-10-18. Requirements: FR-018 / FR-019. Tracking: #26.

All 140 episode videos are now available locally. The 80 newly retrieved public videos have duration and SHA-256 records in the ignored preparation workspace. Sampling all videos is an inventory aid, not proof that every notation frame has been reviewed.

## Delivered local files

The collection contains 19 GP files with independent backing audio, 21 notation-only GP files, and six standalone climbing backing MP3 files. `app/local-scores/COLLECTION.md`, `collection.json`, and `course-scores.zip` provide the local download inventory, file hashes and provenance. No course payload is committed. Import GP files using the existing score viewer or open them in GP8; these files are not all automatically assigned to lesson pages.

All 25 episodes classified as backing are accounted for:

| Delivery | Source pages |
| --- | --- |
| Owner-accepted embedded backing | P018, P020, P021, P072 |
| Candidate embedded backing | P037, P038, P052, P054, P058, P087, P098, P104, P114, P121, P126, P129, P132, P135, P139 |
| Reusable independent backing | P009–P014 |

P007 and P008 preserve their complete 60- and 54-bar climbing routes. Those routes can exceed the approximately three-minute generic backing duration at slower tempos. The backing is therefore separate: no invented loop extension, shortened exercise, or false song-length synchronization is supplied.

P037/P038 and P052 include written opening rests in addition to the audio preparation segment. P098 has a two-beat source pickup padded with two rests in the exported first musical bar; its first note is at 7.18 seconds and the first full source bar at 8.68 seconds. P052's eight cycles are an arrangement inference from the accompaniment length and remain a review candidate. Preserve those distinctions when changing synchronization.

## Conversion behavior

The reviewed writer supports explicit chords, tied chord notes, exact triplets/sextuplets, repeats, accents, picking, grace notes, slides, hammer-ons/pull-offs, palm mute, let ring, dead notes, bends, vibrato and staccato. Staff-only input preserves pitch without inventing tablature fingering. Unsupported fields and malformed durations are rejected.

The local loader repairs alphaTab MusicXML import omissions for writer-generated hammer/pull endpoints, dead noteheads, scoop/falloff slides, and preserves legato slide and mute semantics. These patches apply during local conversion; importing the raw XML in another tool may interpret techniques differently. GP is the preferred prepared artifact. Semantic round trips compare the model before and after GP export; they do not prove the transcription matches the teacher.

## Validation and remaining scope

All 19 embedded-audio files passed isolated Chromium decoding, advancing playback, half-speed, pause/close, and download/reimport checks. Packaging checks exact embedded audio bytes and synchronization within one millisecond. The 25 synthetic/unit/integration tests pass. MusicXML schema validation covers generated source and published files. Native GP8 automation remains unavailable because Windows computer-use initialization rejects this WSL workspace URI. No new native inspection or owner listening is claimed.

This completes the independent-backing preparation pass, not transcription of every teaching example. Several teaching episodes contain additional sight-reading pieces, short technique demonstrations, or chord diagrams that are not in this collection. The local coverage inventory explicitly lists those as untranscribed rather than marking whole lessons complete. No missing source-access blocker remains. #26 remains open for that broader notation coverage and native/listening verification.
