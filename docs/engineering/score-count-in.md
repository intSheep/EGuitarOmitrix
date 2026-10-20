# Optional score count-in

Date: 2026-10-20. Requirement: FR-019. Issue: #45.

The score toolbar offers **一小节预备拍**, off by default. Enabling it adds
one complete audible bar before each explicit play or resume. The play button
becomes **取消预备** and a live status shows the current beat. A 3/4 bar has
three quarter-note clicks; a 6/8 bar has six eighth-note clicks. Tempo follows
the current playback position and speed; synchronized backing audio uses the
player's modified tempo. Existing rests or lead-in audio remain in the score.
Loop boundaries continue without adding another count-in.

The preference is local UI state under `eguitar.score-count-in.v1`, separate
from practice records and backups. Storage denial leaves the in-memory choice
usable and reports that it could not be saved. No score bytes or prescriptions
are rewritten, and no BPM/proficiency evidence is produced by this feature.
The existing foreground practice timer keeps its own semantics.

alphaTab 1.8.4's bundled synthesized player has a count-in API, but its backing
player starts the media immediately and its backing synthesizer does not produce
metronome sound. The viewer therefore uses one application count-in for both
types. Web Audio schedules accented first-beat and ordinary remaining clicks;
the audio clock gates playback after the last full beat interval. A delayed
main-thread completion or interrupted audio context cancels instead of starting
late. This is browser playback coordination, not a hardware latency guarantee.

Cancellation stops all scheduled clicks, closes the count-in audio context and
invalidates the pending play request. It applies to pause, stop, setting or tempo
changes, seeking, score/file replacement, closing, tuner activation, navigation
and backgrounding. A late audio-resume promise cannot start playback. The score
and backing remain paused until the next explicit play action.

Verification: `tests/score-count-in.test.mjs` covers meter, speed, tempo changes,
backing-sync tempo, audio-clock completion, cancellation and interruptions.
`scripts/verify-score-count-in.mjs` uses isolated Chromium storage with synthetic
MusicXML and an audio-embedded GP fixture. It checks actual player/media state,
scheduled clicks and playback delay, cancellation, preference persistence and
responsive layouts. Physical sound output and Safari/Firefox remain separate
acceptance checks.
