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

## Actual pilot and coverage

The existing package has 60 local videos, not the complete teaching catalog. `score-inventory.py` maps all 72 teaching entries: 29 have a local lesson/supporting video and 43 lack one. Availability is not proof that the video contains a readable complete score. The machine-local inventory is `private/score-work/inventory.json`.

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
4. Enter a reviewed transcription JSON: explicit tempo, tuning, source, meter and per-note string, fret, duration, ties and techniques. The current writer intentionally accepts only complete monophonic 4/4 measures and supported durations; it refuses unsupported subdivisions rather than approximating them.
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

The remaining 70 teaching entries have not been transcribed. Acquire the 43 missing source videos or original scores, inspect the available remaining sources, and expand coverage incrementally. Do not present two pilots or candidate extraction as full-course conversion.
