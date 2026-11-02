# ADR 0008 — Quiet practice navigation and manual timing

Date: 2026-11-02. Status: owner-authorized correction. FR-010/020/021/022/024.

## Owner correction and precedence

The owner supplied an actual desktop screenshot and rejected repeated navigation,
nested tool controls and automatic pauses on page/window changes. This supersedes
foreground-only timing in ADR 0003/0005, automatic-return rules and the floating
clock in FR-022. It also supersedes the timer-pause-on-tuner rule in FR-020. Capture
and playback cleanup remain mandatory and independent from session timing.

## One place for each action

- Practice has one corner menu, one contextual **返回计时** while a tool is open,
  one compact passive clock and one fixed pair of session pause/finish controls.
- Tools appear once in a slim horizontal strip. Remove the side panel, draggable
  return clock, embedded close/return controls and cross-tool score shortcuts.
- Score playback is explicitly labeled **播放乐谱 / 暂停播放**, distinct from
  **暂停练习 / 继续练习**. Keep tempo/loop controls near playback. Put restart,
  local file import, export, source images and count-in under **更多**.
- The app menu contains workspace/catalog/history and the existing installed-app
  update action. Leaving focus retains the same draft. Other views offer one
  return to the current session; workspace uses its existing single primary action.
- Finishing shows elapsed time and optional stable BPM/proficiency, with one
  **保存结果** action and one **返回练习**. Remove repeated daily-dose and playback
  evidence panels from that confirmation view; persisted evidence is unchanged.

## Manual run/pause intent

Once explicitly started, a session continues across tools, app navigation, window
blur/minimize and visibility changes. Opening a tuner stops score/metronome sound
and prior capture resources, but does not pause the practice clock. Backgrounding
releases media/capture and saves the draft without altering run intent. Returning
never starts sound or capture automatically. An explicitly paused session stays
paused across those same events until the learner explicitly continues it.

Matching wall/monotonic elapsed time is counted even if callback delivery is delayed.
A discontinuous clock rebases without adding the uncertain gap or changing manual
run intent. Desktop disables background timer throttling. Time measures the
learner-controlled session, not verified guitar playing. Reload/crash recovery
still restores a paused draft rather than guessing unobserved time. Storage failure,
the existing 24-hour cap, explicit finish and consented update installation remain
integrity boundaries. No schema, app ID, origin or record migration is introduced.

Opening an external lesson during a running session does not create an overlapping
automatic viewing draft. The learner can explicitly pause before opening it to use
separate confirmed viewing time. Confirming a viewing record never implicitly
continues a manually paused practice session. Existing watch records and backup
compatibility remain intact.

## Screen audit

| Surface | Result |
| --- | --- |
| Workspace/list/detail | One start/continue/return action; removed duplicate history shortcut beside global navigation |
| Clock and all five tools | One navigation/menu location and one pause/finish location; no nested return controls |
| Score | Playback controls distinct from session controls; infrequent operations disclosed together |
| Tuner/position/metronome/resources | Tool-specific controls only; shared contextual return |
| Catalog/history | Browsing and record management retained; one return to an existing session |
| Finish/result | Optional self-report and explicit save/return; no automatic mastery or BPM |
| Native background/update | Media cleanup separated from timing; update still requires successful save barrier |

## Design provenance and validation limits

Stitch project `6723020998384701419`, session `11086742992295059566`, screen
`a63dc5be9f7947ec8b8073b2bca509de` was generated and visually inspected. Retained the
flat tool strip, corner menu, single contextual return, passive clock, grouped
score options and anchored session actions. Rejected fabricated ASIO/48 kHz status,
synthetic fingerings/teaching advice, unsupported bar-loop ranges and nested
teaching panels. Actual implementation uses the existing blue and source-backed
lesson content. Generated notation is not course evidence or runtime acceptance.

Verify desktop/mobile geometry, all navigation paths, explicit pause persistence,
background continuity, media release, finish/back, backup and update-save barriers
with isolated synthetic profiles. Physical device sleep/background process eviction
and hardware audio remain separate acceptance limits.
