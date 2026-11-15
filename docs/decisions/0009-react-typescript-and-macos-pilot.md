# ADR 0009 — React/TypeScript frontend and macOS pilot

Date: 2026-11-12. Status: owner-authorized implementation. FR-010/013–017/019–024.

## Decision and precedence

Replace the buildless application renderer with React, strict TypeScript, Vite and
HashRouter. Share the frontend between browsers, Electron Windows/macOS and
Capacitor Android. Adopt owned shadcn-style button primitives (Radix Slot/CVA),
Tailwind utilities and the existing Brilliant design tokens. Do not introduce a
server, account, automatic planner or a separate SwiftUI application.

Implementation follows main revision `8dad555` (PR #53), incorporated during this
migration. ADR 0008's manual run/pause intent supersedes the earlier migration
plan's automatic background/tuner pauses. ADR 0007's bounded installed-client
workspace and Android update adapter remain authoritative. Closing/quitting a
Mac application is a persistence boundary; ordinary blur/background releases
media without changing manual timer intent.

## Boundaries and compatibility

- `frontend/domain` contains pure typed accounting, course rules, review models
  and runtime schemas. Unknown instructor values remain unknown.
- `frontend/storage` keeps database `eguitar-practice-v1`, IndexedDB version 3,
  object-store names/keys, backup schemas 1–3 and transactional import/conflict
  checks unchanged. Passthrough schemas preserve additional historical fields.
- `frontend/controllers` owns the single session timer, Web Lock, queued draft
  writes and ordered result edits. React subscribes to immutable snapshots;
  rendering never creates a clock or opens a microphone.
- React owns routes, workspace, finish, review, catalog, materials, goals and
  backup dialogs. Established audio/notation adapters remain isolated; alphaTab
  stays pinned to 1.8.4. UI remounts dispose old capture/player resources.
- The finish form keeps optional BPM/proficiency empty. After a successful
  transaction, return to the selected lesson with a brief saved message and
  record link. The history screen remains the place to inspect/edit results.
- Vite's public directory is generated from the explicit resource allowlist,
  never from the entire application or ignored local folders. The default score
  index is empty; only a validated pinned course pack can add course bytes.
  Generated bundle files receive the existing inventory hashes/build metadata.
- Hash links, origins, IDs and desktop data directory remain stable. Stable
  storage-module output entries support the isolated browser test harness.

## Mac pilot

Reuse Electron with standard application/edit/view/window menus and keyboard
roles. Close first persists a paused draft, then hides the Mac window; Dock
activation shows the existing window. Quit also requires a persistence barrier.
A failed save offers return, retry, or explicit discard. Concurrent close/quit
requests share one barrier. No generic renderer filesystem capability is added.

The existing preload additionally reports platform and update support, and exposes
a narrow course-link action checked against the existing outbound URL allowlist. Unsigned
Mac pilots do not invoke electron-updater; the release/download link remains.
Windows explicit update consent and Android native update validation are retained.
macOS microphone permission is checked separately from app consent. Denial offers
an explicit system-settings action; capture never restarts automatically.

ARM64 is the primary pilot target; Intel builds are retained without an assertion
of Intel device acceptance. CI verifies both packaged resource directories and
runs the packaged smoke on ARM64 runners. Signing, notarization, App Store and
iOS delivery remain deferred. See validation.md for actual evidence and limits.
