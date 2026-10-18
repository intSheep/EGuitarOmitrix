# Local microphone tuner

Date: 2026-10-18. Requirement: FR-020. Issue: #37.

The tuner is an optional standard-tuning aid reachable from the workspace, focus tools and score dialog. Opening it pauses practice, metronome and score playback. Closing it leaves practice paused for explicit resumption. It does not write recordings, settings or results to storage, and no audio is sent to a server.

## Signal and interpretation

`tuner-model.js` implements a bounded YIN-style cumulative mean normalized difference with parabolic interpolation, based on [de Cheveigne and Kawahara, 2002](https://pubmed.ncbi.nlm.nih.gov/12002874/). The input is 4096 PCM samples at the AudioContext's actual sample rate. The search includes frequencies above the supported 65–380 Hz range to avoid accepting an out-of-range tone at a later subharmonic minimum. Weak signals (AC RMS below 0.004) and insufficient periodicity are rejected. A three-frame confirmation and five-frame median stabilize readings; large jumps reset the window. These thresholds are implementation choices, not instructor criteria or calibrated confidence probabilities.

The standard targets are E2/A2/D3/G3/B3/E4 at A4=440 Hz. The interface always chooses the nearest standard open-string target in logarithmic pitch. It has no manual target or mode controls. The label says “near string” because frequency alone does not identify the physical string/fret. Flat readings instruct tightening; sharp readings instruct loosening. No clockwise/counterclockwise direction is assumed. Cents are `1200 * log2(detected / target)`. The center indication uses ±5 cents; this is a display tolerance, not a hardware accuracy guarantee. The horizontal indicator saturates at ±50 cents while the numeric readout preserves larger deviations. Octave errors are never corrected silently. Chords, distortion, weak fundamentals and noise can still produce ambiguous estimates; the UI asks for one open string at a time.

## Capture lifecycle

Explicit activation calls [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) in a secure context (localhost or HTTPS). The browser is asked to disable echo cancellation, noise suppression and automatic gain control, but devices may not honor every constraint. A source connects to an AnalyserNode only, never to speaker output. Device labels are rendered as text. The input meter is a relative signal indicator, not calibrated dB.

The initial action becomes a cancel button during permission acquisition and a stop button while listening. A generation token invalidates stale asynchronous starts. Stop, close, Escape, route change, background/pagehide, track end and AudioContext interruption release tracks, close the context, cancel sampling and clear readings. A late permission grant immediately releases its stream. Input changes stop the previous stream before requesting the selected device. Returning to the page never resumes capture automatically.

## Validation boundary

Unit tests use synthetic PCM; browser checks use Chromium's synthetic WAV capture through the real MediaStream/WebAudio path. Device enumeration/switching and permission failures are injected fixtures. Responsive and cleanup checks are repeatable with `scripts/verify-tuner.mjs` and the same Playwright environment variables used by existing acceptance scripts. Real electric-guitar, Windows microphone/USB device drivers, physical unplugging and other browser behavior still require hardware acceptance. No automatic correctness grading is provided.
