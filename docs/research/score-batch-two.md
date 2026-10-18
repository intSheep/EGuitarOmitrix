# Backing-score batch two

Date: 2026-10-18. FR-019; issue #24. This is a three-file listening batch covering two further compositions, not full-course conversion.

## Owner-accepted reference

The owner confirmed P072 at a 6.54-second first-note entry after checking in the Guitar Pro context. Keep that specific version as the reference, not the rejected one-bar or 5.0-second trials. The accepted local GP is `app/local-scores/p072/score.gp`; the former `p073-audio-draft/score.gp` download alias now serves this accepted pure-backing version. The local index records `acceptedAudioGp` and `audioReview` as preparation metadata; the existing viewer's default MusicXML selection is unchanged. The artifact's manifest records owner listening acceptance separately from unavailable automated GP8 UI/save/reopen testing. Earlier trials remain local for traceability.

The reference method is: identify the correct independent backing, inspect count-in and spectral entry, check later beats, then obtain listening acceptance. Its 6.54-second offset is not a template for other songs.

## New candidates

| Source | Composition | Audio BPM | Original measures | Added rest bars | First musical note in original audio | Status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| P018 | W1-EX9 No.4 小星星 | 100 | 12 | 2 | 6.06 s | Prepared; owner listening pending |
| P020 | W1-EX9 No.5 森林之海 | 65 | 16 | 1 | 6.58 s | Prepared; owner listening pending |
| P021 | W1-EX9 No.5 森林之海 | 80 | 16 | 1 | 5.37 s | Prepared; owner listening pending |

Source videos contain complete single-page numbered notation. Start/middle/near-end frames were compared; no additional page was observed at those samples. Notes, octave marks and durations were transcribed from these pages. P020 retains an 80 BPM printed score image although the filename and measured audio grid are 65 BPM. The GP uses 65 BPM for that audio version; the discrepancy remains in its manifest.

The source jianpu does not prescribe string/fret positions. These exports therefore use standard staff notation and explicit MIDI pitches rather than inventing the teacher's tablature/fingering. Tonic C4 is supported by corresponding demonstration spectral samples (P019 includes approximately 261.8 Hz C4; P022 includes approximately 329.7 Hz E4 and 261.1 Hz C4). Demonstrations were used for register evidence only, never embedded as backing. High-octave tonic marks in the Forest score are preserved. The serializer now supports staff-only notes, rests and dotted durations; its original explicit TAB mode remains available.

The added rest measures align the visible score with count-in audio. They are preparation arrangements, not copied exercises. Original source audio/pre-roll/tail is retained without normalization or time stretching. GP assets and MusicXML are in ignored `app/local-scores/p018/`, `p020/`, `p021/`; each includes a manifest, source frame, opening spectrogram and alignment report. Detailed transcription/review evidence stays under ignored `private/score-work/batch-pNNN/`.

## Spectral evidence and limits

`scripts/analyze-backing.py` takes a local audio/video source, an explicit candidate anchor, BPM and bar count. It uses NumPy/SciPy STFT spectral flux and reports nearby quarter-beat transients in early/middle/late thirds. It also records low-band energy near the entry. Install NumPy/SciPy in the local virtual environment; these are preparation dependencies, not browser runtime packages.

```sh
.venv/bin/python scripts/analyze-backing.py input.mp4 NEW-report.json --bpm 100 --anchor 6.06 --bars 12
```

This command does not choose the downbeat or certify musical alignment. The example parameters are specific to P018. In the current audio analysis, segment median transient residuals are roughly 1–3 ms, with 47/48, 61/64 and 61/64 matched candidate beat positions respectively. A median is not a worst-case bound or proof of musical correctness. Sustained passages may not produce onsets, and a neighboring beat can still be the wrong musical location. No automatic acceptance or mastery state is inferred.

## Validation and queue

- All three MusicXML files pass the local W3C 4.0 schema.
- All three GP exports reimport with matching note/rhythm data, embedded audio bytes and synchronization anchors.
- Isolated Chromium plays decoded audio with advancing time; percentage speed, pause/close, download and GP reimport pass. Staff rendering was visually inspected.
- The 22-test suite covers the previous TAB flow and new staff/rest/dotted-note cases, with invalid MIDI/fingering/rest combinations rejected.
- These three outputs await owner listening. No new native GP8 automation succeeded or is claimed.

This batch does not transcribe 青花瓷, 虫儿飞 or 蓝莲花: their source pages were inspected to build the queue, but their notes/techniques have not been fully entered or validated. Other remaining local sources and the 43 missing-source teaching entries retain their previous pending state. Continue incrementally, especially for slides, ties, tuplets and source tempo variants; do not approximate unsupported notation.
