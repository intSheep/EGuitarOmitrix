# README image provenance

Captured/reviewed on 2026-10-26 for the Chinese product README.

- `practice-workspace.png`, `score-practice.png`, `tuner.png`: real screenshots of
  https://intsheep.github.io/EGuitarOmitrix/ (v0.4.0), captured with Playwright in a
  new disposable Chromium profile at 1440 × 1040. Waited for visible images,
  fonts and score-playback controls; used the app's reduced-motion setting.
  No UI text, readings or practice results were injected. Brief timer values
  reflect screenshot interaction, not evidence of learning. No personal records
  were imported, no session was saved, and microphone capture was never enabled.
- `course-cover.png`: original, unedited course-cover screenshot supplied by the
  owner in this conversation, explicitly requested for README inclusion.
  Credit: 「帅帅是把电吉他」老师, 「零基础入门电吉他 · 7周自学计划」,
  https://www.bilibili.com/video/BV1FT411Z7iu/ . The README links the image back to
  that course. Course imagery is outside the software MIT license.

The README GP workflow was checked against the live page: the enabled
“下载 GP 文件” action downloaded `practice.gp`; ZIP integrity and the
`Content/score.gpif` entry were checked. The downloaded score is temporary and
not committed. This does not establish native Guitar Pro import/playback.

The product UI/layout was not redesigned. These are screenshots of the existing
approved Stitch-backed implementation, not generated mockups. Source course
prescriptions remain unchanged; the first-lesson example refers specifically to
P003 at 861 seconds, not a universal practice prescription.
