# ADR 0007 — Installed-client workspace and Android updates

Date: 2026-11-02. Status: owner-authorized implementation. FR-023/024, FR-010/015/020/022.

## Decision

The owner rejects a long webpage inside an application window. This supersedes
ADR 0006's decision to retain identical browser and installed-client layouts.
Keep the shared exercise, notation, audio and persistence implementations, and
adapt installed applications around a bounded viewport and platform navigation.
This is an installed-client interaction adaptation, not a rewrite using native
widgets for every content surface. Preserve technical IDs, origins and databases.

Desktop: keep primary navigation visible, scroll the exercise list and lesson
content independently, and anchor lesson actions below content. Catalog filters
stay above a scrolling directory. History retains a scrollable document region
and sticky management action. Focus tools and pause/finish remain outside the
scrolling practice content. Compact clients use persistent bottom navigation,
separate list/detail views and an explicit return to the list. Android's system
Back closes tools/dialogs, returns to the list/workspace, then backgrounds the
task. It never silently discards an unconfirmed practice result.

## Platform update authority

The desktop preload exposes only `checkUpdates()`; the main process checks the
requesting window, main frame and local origin. Download/install decisions remain
native dialogs. Taskbar progress is bounded and cleared on completion/failure.
No silent installation, startup request, generic IPC or filesystem bridge is added.

Android's native `AppUpdate` plugin reads the latest stable public GitHub Release
and its existing `android-manifest.json`. Download requires consent. Streams have
timeouts, size limits, HTTPS/host restrictions and bounded redirects. Require the
expected byte count, SHA-256, stable package ID, exact increasing version code and
matching installed signing certificates before offering installation. The
platform installer makes the final installation decision. Reject debug/release
key mismatches without uninstalling the application. Interrupted partial downloads
are discarded; checks can be retried. Android 7/8 use legacy package version/signature
APIs; Android 9+ use signing-info APIs. No SDK minimum change is made.

Immediately before installation, call the existing draft-persistence barrier.
Pending results, viewing records, editing or save failures block installation.
The unknown-source installation setting is opened only after explicit consent;
returning from it does not silently install. The learner can retry the update.
The plugin requests package-install permission for direct APK distribution, not
Play Store in-app updates. Metadata and APK bytes stay native, outside the WebView.

## Design evidence

Stitch project `6723020998384701419`, session `6673846253610034287`, generated
“帅帅练琴屋 - 桌面端原生工作台 (固定视口与双栏独立滚动)”. Retained: bounded viewport,
independent panes, persistent navigation and anchored primary actions. Use the
existing top navigation on desktop to preserve familiar labels, rather than adding
a second rail. Retained compact-client list/detail mapping and the approved white,
black and royal-blue style. Rejected fabricated version `v2.4.1`, unverified
automatic “up to date” state, generated fingering/angle advice and unsupported
practice values. Generation is design evidence only; no generated content replaces
source-backed prescriptions. The screen-list tool returned an empty response, so
no screenshot inspection or generated screen ID is claimed.

## Acceptance limits

Browser tests with synthetic desktop/Android bridges cover geometry and interaction;
they do not prove native APK installation, Windows installer replacement, physical
microphone behavior or data retention across a real device upgrade. Check native
compilation and actual runtime separately, and record results in validation.md.
