# Local video-to-score preparation and browser playback

Date: 2026-10-18 (Asia/Shanghai). Owner authorization supersedes the earlier research-only boundary for this pilot. Issue #20.

## Findings and tool choice

- [HyperFrames](https://github.com/heygen-com/hyperframes) is an HTML-to-video production framework. It is not the tool for extracting notation from existing course videos; it was researched but not installed.
- Installed [video-frames](https://github.com/mugnimaestra/video-frames-skill/tree/main/skills/video-frames) through the skill-installer helper, with a pinned repository commit. Its Python/FFmpeg scripts were inspected before execution. It performs frame extraction, not music recognition. The skill is available in subsequent turns. FFmpeg was already installed.
- The skill's `--max-frames` rate is clamped to a minimum FPS, so it produced 21 frames for the 412-second P026 even when 12 were requested. Our `extract-score-candidates.py` implements a strict sample count, source timestamps, optional score-region cropping, checksums and conservative candidate grouping. Uniform sampling can miss short pages. A candidate group is not an approved page or a guarantee of complete coverage.
- [Audiveris tablature documentation](https://audiveris.github.io/audiveris/_pages/guides/specific/tablature/) describes excluding tablature regions, not recognizing their notes. It was not installed as a six-line-tab OCR solution.
- [MusicXML](https://www.w3.org/2021/06/musicxml40/tutorial/tablature/) supports explicit string/fret and tuning data. It is the editable exchange master here, rather than treating screenshots as playable notation.
- [alphaTab](https://alphatab.net/docs/introduction/) imports MusicXML and GP and provides rendering and synthesized playback. Installed `@coderline/alphatab` 1.8.4, MPL-2.0, pinned in the lockfile. It can [export GP](https://alphatab.net/docs/guides/exporter/). Runtime, fonts, soundfont and their license files are copied locally by the asset-preparation script; no CDN or course upload is used.
- [GP8 supports MusicXML import](https://www.guitar-pro.com/docs/gp8/import-export/import). Native GP8 opening was not tested. Browser downloads are offered; no `guitarpro://` protocol, OS file association change or launch helper was invented.

## Initial pilot and historical coverage

At the initial pilot, the package had 60 local videos, not the complete teaching catalog. `score-inventory.py` maps all 72 teaching entries: 29 have a local lesson/supporting video and 43 lack one. Availability is not proof that the video contains a readable complete score. The machine-local inventory is `private/score-work/inventory.json`.

| Source | Lesson destination | Transcription | Evidence |
| --- | --- | --- | --- |
| P026 follow-along | P025, W2-EX1 | 4 measures, 4/4, first-string open notes, alternating quarter/eighth-note bars and picking direction | One static score region; playback highlighting varies. Original score 120 BPM; practice starts at the lesson's 60 BPM. |
| P073 performance | P071, W4-EX9 | 10 measures, 4/4, D major, 100 BPM, explicit strings/frets, rhythmic ties and finger/pick annotations | Scrolling score with overlapping visible measures; deduplicated by measure sequence, not concatenated as new bars. Cross-checked the prior user-image MusicXML from the linked conversation against video frames. Practice starts at 40 BPM. |

Standard E–A–D–G–B–E tuning is an explicit assumption for both pilots; the source frames do not independently establish tuning. Numbered-note text/layout is not reconstructed as a second part. The checked output is six-line tablature. Source images and notes remain available for visual comparison. No claim is made that every ornamental rendering or Guitar Pro round trip is lossless.

Files are under ignored `app/local-scores/p026/` and `p073/`, with MusicXML, GP and original score-region PNGs. `app/local-scores/index.json` links lessons to assets and retains source file SHA-256, actual sample timestamps, image hashes and crop rectangles. Reviewed intermediate note JSON is under ignored `private/score-work/`. No course images, full scores or personal records are committed.

## Reusable process

1. Inventory local source availability. Missing videos remain missing, never reconstructed from subtitles.
2. Extract bounded candidate frames; crop the score area and inspect source transitions. Keep raw sources unchanged. Increase sampling around transitions where necessary.
3. For static pages, identify the complete visible measure set. For scrolling pages, compare measure numbers and overlapping notes; omit duplicate measures. Do not infer off-screen bars.
4. Enter a reviewed transcription JSON: explicit tempo, tuning, source, meter and per-note string, fret, duration, ties and techniques. The writer supports reviewed staff/tab notes, chords, rests, tuplets, supported techniques and 2/4, 3/4 or 4/4 measures. Short measures require explicit indices; it refuses unsupported durations rather than approximating them.
5. Run `python3 scripts/write-musicxml.py notes.json new-score.musicxml`. It validates bar totals, string/fret bounds and ties. Validate MusicXML against the W3C 4.0 XSD for release candidates.
6. Run `node scripts/convert-score.mjs new-score.musicxml new-score.gp`. It reimports the export and checks meter, tuning, pitches, strings/frets, durations and tie destinations. This is library validation, not a GP8 desktop test.
7. Link only inspected assets in the local index; compare the rendered score with source images, then check playback. Native GP8 import and listening remain final musical acceptance steps.

Extraction example:

```sh
.venv/bin/python scripts/extract-score-candidates.py input.mp4 private/candidates --samples 24 --crop 0,740,1920,1080
node scripts/convert-score.mjs input.musicxml output.gp
```

The crop is source-specific, not a universal video layout. Install Pillow/lxml in the local virtual environment for image processing and XSD validation. FFmpeg/ffprobe are required on PATH. Course data is local-only.

## App integration

In immersive practice, the **乐谱** action opens a large viewer with playback, restart, BPM, looping, source frames and downloads. It can also load a local compatible score into the current viewer; that ad-hoc file is not persisted or automatically associated with the lesson. Prepared local index assets survive reloads. Closing the viewer destroys playback; hiding the document or pausing practice pauses audio. Opening the viewer stops the independent metronome to avoid two pulse sources. The timer and practice outcomes remain independent from score playback.

Constant-tempo scores map requested BPM to `requested / original` playback speed. Variable-tempo imports disable the fixed BPM control and retain their tempo map. Neither setting is logged as achieved playing speed. No microphone, grading, transcription service or automatic promotion is included.

## Validation and remaining work

Both pilots pass W3C MusicXML 4.0 schema validation, note/rhythm comparison after regeneration, and GP export/reimport checks. Isolated Chromium rendered both, toggled playback, changed BPM, looped, showed source frames, downloaded GP and reimported it, and checked mobile overflow. Headless state testing is not a subjective audio-quality check or a native GP8 acceptance test.

The initial two-pilot boundary has been superseded by the preparation pass below. Preserve the distinction between source availability, identified-example coverage and exhaustive video review.


## Remaining-course preparation pass (issue #26)

All 140 source videos are now available locally. Uniform survey frames and targeted additional frames were used to inspect the identified notation, including multi-page sight-reading, rhythmic examples, chord inversions, strumming, bends, vibrato and hammer/pull exercises. This is not an assertion that every video frame was reviewed.

The local collection now contains 120 artifact sets: 96 GP scores (19 with pure backing audio and 77 notation-only), two MusicXML-only scores, 16 source-image reference sets and six independent backing MP3 sets. This adds 56 GP scores to the previous 40. The 114 score/reference sets are indexed by lesson, edition and related exercise. Multi-example lessons use the viewer's **本课乐谱** selector. Prepared GP bytes are preferred over reimporting XML, preserving embedded audio and reviewed techniques. Downloads return the original GP bytes.

P049 and P067 end with deliberately short measures. MusicXML preserves them, but the installed GP exporter loses non-initial anacrusis flags. The semantic comparison now detects this; these two files remain XML-only, with GP download disabled. No rests were invented to pad the source. P085 is random fifth/sixth-string note recall and has no fixed rhythmic sequence. Chord/fretboard diagrams without rhythmic instructions remain images. Shared pieces such as P051 No.3/No.5 use their existing P052/P054 score assets rather than duplicate transcriptions.

Source page/timestamp evidence and transcription decisions remain in local manifests. Some numbered-notation examples have no source tempo: their 60 BPM value is explicitly a player default, not a teacher prescription. Standard guitar tuning remains a preparation assumption unless independently established. Staff-only scores do not invent string/fret choices.

Rebuild local metadata and the downloadable bundle with:

```sh
python3 scripts/index-local-scores.py
python3 scripts/bundle-local-scores.py
```

The bundle includes per-file SHA-256 values, source images, manifests, `COLLECTION.md`, `collection.json` and per-page `coverage.json`. Trial directories are excluded. All payloads remain ignored. The four previously accepted GP files (P018, P020, P021, P072) retain their recorded hashes. Native GP8 rendering and listening have not been performed for this new batch; no additional listening acceptance is implied.
