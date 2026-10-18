# Course source assessment

Checked: 2026-10-18, Asia/Shanghai. Scope: read-only local inventory, subtitle structure, and selected subtitle passages. No fresh crawl, full musical review, video decoding, or score conversion was performed in this task.

## Source provenance

- Reference conversation: `codex://threads/01a14880-20c5-77e2-9066-7849de597641`.
- Course: [BV1FT411Z7iu](https://www.bilibili.com/video/BV1FT411Z7iu/).
- Local subtitle package: `C:\Users\Administrator\Downloads\bilibili-BV1FT411Z7iu-subtitles`.
- Local video package: `C:\Users\Administrator\Downloads\bilibili-BV1FT411Z7iu-videos`.
- In WSL, these were inspected under `/mnt/c/Users/Administrator/Downloads/`.

These paths document this audit and must not become application defaults or committed content locations. The original files were read without modification. Do not copy the raw packages into the repository.

## Verified inventory

| Check | Result |
| --- | --- |
| `download-report.json` | 140 entries: 81 downloaded, 59 no subtitle |
| Cue count from actual subtitle JSON | 8,989, matching the report |
| Companion subtitle formats | All reported SRT and TXT files present |
| Cue structure | Nondecreasing start times and end time not before start; no issues found |
| Video report | 60 downloaded entries |
| Actual video files | All 60 present, each with the reported byte size; 1,317,138,690 bytes total |
| Prior validation | The earlier conversation/report states H.264/AAC, duration, and beginning/end decode checks passed; those checks and video hashes were not rerun here |

Counts use the top-level source files, not duplicate packaged copies in the delivery directory. Structural validation is not semantic validation of AI subtitles.

## Organization and coverage

| Course label | Entry count, including media variants and older versions |
| --- | --- |
| W1 | 22 |
| W2 | 17 |
| W3 | 20 |
| W4 | 17 |
| W5 | 21 |
| W6 | 20 |
| W7 | 21 |
| Preparation and outlook | 2 |
| Total | 140 |

Sixteen entries are marked `(旧)` in the title. This is a provisional revision marker, not a complete mapping of which task supersedes which.

Title-based classification of the 59 missing-subtitle entries gives 24 backing tracks, 16 demonstrations, 10 follow-along entries, and 9 teaching/other entries. P121 is a backing-track title with AI subtitles, so the presence of a transcript alone cannot determine whether an entry contains an assignment.

Eight missing-subtitle entries appear to be teaching exercises:

| Page | Source title |
| --- | --- |
| P017 | W1-EX9 C调简谱视奏(含简谱介绍) |
| P047 | W3-EX5 第一把位音阶及闷音练习 |
| P068 | W4-EX6 相对于do的音程模唱 |
| P069 | W4-EX7 八分音符含休止和延音的节奏视奏 |
| P086 | W5-EX10 周杰伦-爱的飞行日记 |
| P097 | W6-EX6 Beyond-光辉岁月solo |
| P113 | W7-EX5 夜鹿-花上亡灵solo |
| P119 | W7-EX9 三个音的转位大&小三和弦 |

The ninth teaching/other item is P040, W2-OUTRO. These are review queues, not proof that each contains spoken homework. The locally saved videos provide a fallback for later authorized transcription or manual inspection.

## Evidence examples for the PRD

| Source and time | Supported candidate meaning | Important limitation |
| --- | --- | --- |
| [P002](https://www.bilibili.com/video/BV1FT411Z7iu/?p=2), 1.62–8.06 s | Nine exercises in W1; the initial schedule includes practicing the set daily | Stage guidance must be considered with the later time-limited alternative |
| P002, 22.72–29.26 s | If two hours daily are unavailable, choose some technique and some song exercises | This does not establish a specific five- or fifteen-minute schedule |
| [P003](https://www.bilibili.com/video/BV1FT411Z7iu/?p=3), 861.06–861.82 s | Five minutes daily | Does not specify how many sessions per day |
| P003, 861.82–889.44 s | Relaxation, posture, and wrist-action checks | Several words are imperfect AI recognition; verify visual technique before treating it as coaching |
| P003, 889.44–894.42 s | Metronome 40; do not speed up | A generic speed-increase rule would contradict the assignment |
| [P070](https://www.bilibili.com/video/BV1FT411Z7iu/?p=70), 828.51–837.35 s | Thirty minutes daily; keep time and read the score | One cue appears to misrecognize a body-part word; preserve raw evidence and flag the correction |
| P070, 837.35–841.39 s | Start at 40 and increase toward the required speed | The numeric final target is not specified in this passage |

These are paraphrased **AI-transcript-derived candidate requirements**. They have not been compared with the lesson audio/visuals and are not a finished assignment catalog. Subtitle timing can support navigation without proving musical interpretation.

## Retrieval feasibility

The earlier conversation recorded successful subtitle retrieval using an existing browser login. Unauthenticated requests did not expose the same AI subtitle tracks. The present task's fresh web-page fetch returned HTTP 412, so this audit does not establish a reliable fresh scraper.

Product implications:

1. Build the first path around the verified local export.
2. Accept user-supplied timed subtitles and manual tasks when automatic retrieval is unavailable.
3. If a refresh adapter is later authorized, record per-entry success, no-track, authentication-needed, blocked, and transient-failure outcomes separately.
4. Retain stable `bvid + cid` identity. Page numbers and titles are navigation metadata and may change.
5. Cache successful work, cap retries, and resume selectively. Do not promise that a browser login makes unattended batch fetching reliable.

## Can subtitles alone solve the product?

They are sufficient to draft many assignment instructions, durations, and practice constraints. They do not reliably capture every note, rhythm, string/fret position, fingering, score marking, or silent demonstration. Missing independent subtitles are not equivalent to missing instructional content.

For the tracking MVP, missing visual details can be linked and manually clarified. For playable notation, a separate verified score asset is required. No `.gp`, MusicXML, or other structured-score inventory has been established from the two inspected packages. The owner clarified that separate score files are not currently known and only notation in the videos has been identified. Obtaining an original structured score or transcribing and verifying a small excerpt is therefore a future prerequisite for playback trials.

## Assignment follow-up — 2026-10-18

All 72 teaching entries now have paraphrased assignments in the [inventory](assignment-inventory.md). For the eight missing-subtitle lessons, local video endings were sampled and their final assignment cards were visually inspected. They are labeled video-card-reviewed, not audio-verified. Source video hashes, ranges and card timestamps are retained; no video frames or complete transcripts are committed. P047 has a contextual difference between the spoken-caption allowance to look at the hand when needed and the terse card instruction; that difference is preserved in the note.

Other entries remain text-reviewed AI-subtitle candidates. In particular P117's daily time and P029/P065/P093 final tempo are still uncertain; no value is guessed. This work organizes homework and does not transcribe musical notation.
