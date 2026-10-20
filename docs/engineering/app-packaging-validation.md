# Application packaging verification — issue #40

Date: 2026-10-20. Requirements: FR-021, FR-015–017, FR-019, FR-020. Test records and notation are synthetic and disposable. The original working tree's unfinished tuner/ambience work is excluded from this change.

## Local evidence

- Node 24.0.2 on Linux: 47 unit tests passed, including distribution/confinement checks, release-tag rejection for mismatched/dirty/branch-only source, and the existing actual score/audio conversion tests.
- Sanitized build completes with an empty private-score index. Browser acceptance passes five scenarios: responsive workspace and local synthetic MusicXML loading at 1440/768/390 px, actual timer save/export/merge restore into a fresh profile, and the Android export adapter's native dispatch. No personal profile or course score was used.
- `npm audit` found no high or critical advisories at implementation time. Eleven moderate advisories are in developer-tool dependency chains (Capacitor's unused iOS toolchain and electron-builder tools); production dependency audit and exact-run checks are recorded with the delivery evidence. This is not a security audit.

Electron 44.9.1 passed the actual Linux shell smoke in an isolated Xvfb display with a disposable profile: secure bundled origin, renderer isolation settings, microphone start/stop with a synthetic device, camera denial, a simulated native background event pausing the timer, local synthetic MusicXML playback, backup download, allowlisted outbound navigation and IndexedDB persistence after app restart. The native permission dialog's answer is stubbed for automation. The test-only Linux `--no-sandbox` argument permits the nested headless environment; production BrowserWindow sandbox configuration is asserted, not an independent sandbox security audit. Physical minimize/suspend and actual hardware audio are not established by that test.

`npm audit --omit=dev` reported zero known production dependency advisories on this date. Native/CI evidence is appended after execution below. A configured workflow is not a successful Actions run; a compiled APK is not device acceptance.

## Acceptance limits

No Windows certificate, stable Android release signing key, store publication, automatic updates, iOS build, real guitar accuracy measurement or cross-device synchronization is delivered. Android's native picker/permission behavior, physical audio devices, suspend/resume, installation and upgrades need target-device acceptance. The shipped course catalog/task summaries retain their existing uncertainty; excluded course media can be loaded locally by the learner.
