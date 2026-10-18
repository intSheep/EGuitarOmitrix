# Audio-backed Guitar Pro preparation

Date: 2026-10-18. FR-019 extension; Refs #22. Authorized by the owner after the linked Guitar Pro research conversation. This completes the reusable packaging tools, not native GP8 acceptance or all course transcriptions.

## Data flow

Source image/video → reviewed note JSON → MusicXML → alphaTab score model → decoded PCM audio → evidence-backed score/audio anchors → GP export → library/browser checks → GP8 listening and synchronization acceptance.

Images are evidence, not directly playable scores. Use `write-musicxml.py` and the reviewed transcription workflow in [video-score-preparation.md](video-score-preparation.md). A static page and overlapping scrolling pages must retain source provenance and avoid duplicated measures. Do not infer unheard count-ins or off-screen notes.

alphaTab 1.8.4's installed exporter writes `Content/Assets/backing-track` into the GP ZIP and references it from GPIF. `Score.applyFlatSyncPoints` supplies score positions and audio milliseconds. See the [pinned exporter](https://github.com/CoderLine/alphaTab/blob/v1.8.4/packages/alphatab/src/exporter/Gp7Exporter.ts), [audio sync guide](https://alphatab.net/docs/guides/audio-video-sync/) and [player modes](https://alphatab.net/docs/reference/types/playermode/). Browser backing audio replaces synthesized playback; this is not simultaneous mixing of the two. MusicXML remains the notation exchange master, while the GP carries audio and synchronization.

## Local preparation command

```sh
node scripts/package-audio-score.mjs private/my-audio-config.json private/my-new-export
```

The output directory must not exist. All paths in the config are local, relative to the config directory or absolute. The tool invokes FFmpeg/ffprobe directly without shell interpolation and does not change the original source. It extracts the first audio stream as stereo 44.1 kHz PCM WAV, without loudness changes, tempo stretching or source separation. A trim is explicit; keep pre-roll unless the synchronization review establishes that removing it is appropriate.

Example below is a **synthetic configuration, not course timing**:

```json
{
  "schemaVersion": 1,
  "scoreSource": "synthetic.musicxml",
  "audioSource": "synthetic.wav",
  "audioKind": "backing",
  "syncReview": "candidate",
  "trimStartSeconds": 0,
  "durationSeconds": 5,
  "syncPoints": [
    {"barIndex": 0, "barPosition": 0, "barOccurence": 0, "millisecondOffset": 500, "evidence": "Synthetic first beat at 0.5 seconds"},
    {"barIndex": 0, "barPosition": 1, "barOccurence": 0, "millisecondOffset": 4500, "evidence": "Synthetic four-beat measure ends at 4.5 seconds"}
  ]
}
```

`barIndex` is zero-based. `barPosition` is a fraction of the measure, not a beat count. Audio offsets are relative to the **trimmed output**, so subtract trim-start milliseconds when translating source timestamps. `barOccurence` follows alphaTab's API spelling and is zero for this pilot. At least start/end anchors are required; add intermediate anchors where timing changes. Anchors must increase in both musical and audio time, stay within the audio, and carry evidence. Repeats/jumps are refused by this pilot rather than guessing occurrences. `audioKind` is `backing` or `demonstration`; `syncReview` is `candidate` or `reviewed`, and is never promoted by export success.

Output: `audio.wav`, `score.gp`, and `manifest.json`. The manifest retains source paths/hashes, processing window, audio and GP hashes, anchors/evidence and explicit native/listening status. On processing failure the newly created output is cleaned up; existing outputs are never overwritten. A candidate file must not be published as the lesson's accepted default.

## Verification gates

1. Reimport the exported GP and compare embedded audio byte-for-byte, note rhythm/tuning and sync anchors (within 1 ms for GP's 44.1 kHz frame rounding).
2. Inspect ZIP entries and confirm GPIF references the embedded audio, rather than an external path.
3. Load the GP through the existing immersive viewer's local file action. Verify audio time advances, speed/pause/close work, and another GP export retains audio and anchors. Embedded audio uses a **percentage speed** control; nominal BPM is not necessarily the actual aligned audio tempo. Browser playback tests do not establish audible musical alignment.
4. In GP8, open a separate exported file, confirm the audio track/waveform, check count-in, first note, middle and final measures, then check loop/slow playback. Save accepted changes as a new revision; reopen that GP and recheck. Record GP8 version and listening result. Do not mark these steps passed from alphaTab alone.

## Current artifacts and limits

- P073: ignored `app/local-scores/p073-audio-draft/score.gp` contains the **demonstration audio**, not the independent backing. The original 31.7-second pre-roll/tail is retained. The first anchor near 6.3 seconds is estimated from video cursor movement; the 30.3-second endpoint is extrapolated from 100 BPM / ten 4/4 bars. These are explicitly candidate anchors, not accepted musical synchronization. It is not linked as the default practice score.
- P072: independent backing extracted losslessly to ignored `private/score-work/p072-audio/audio.wav`. The video shows a static score without a moving cursor. First-bar alignment remains unknown; no invented anchors or GP delivery for this backing. The owner has not studied this lesson and could not confirm the count-in.
- Native GP8 inspection is blocked: the prescribed Windows `computer-use` entry point failed before listing apps with `sandboxCwd is not a local file URI: file:///home/zpy/create/EGuitarOmitrix`. No GP8 launch, opening, playback, save or listening result is claimed. Restore the Windows control bridge or perform the above acceptance manually before promoting a candidate.

All course media, exports, config and manifests stay ignored/local. No URI handler, file association or OS setting was changed. No new frontend layout was introduced; this reuses the existing Stitch-designed score viewer. Remaining acceptance in #22: independent P072 alignment and native GP8 listening/reopen verification.
