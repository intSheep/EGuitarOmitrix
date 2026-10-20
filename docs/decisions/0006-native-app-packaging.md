# ADR 0006 — Windows application and Android packaging pilot

Date: 2026-10-20. Status: owner-authorized implementation, issue #40. Requirements: FR-023, FR-015–017, FR-019, FR-020; NFR-001, NFR-007, NFR-008.

## Decision

Ship the same local web workspace in an Electron Windows x64 application and a Capacitor Android test shell. Windows is primary. Keep the existing task-focused layout and approved Brilliant appearance. These wrappers do not introduce a planner, cloud service, native Guitar Pro launcher or new practice evidence.

The owner accepted Windows first and Android in scope, and asked about iPhone feasibility. iOS remains deferred: a native build needs macOS/Xcode, signing setup and device verification. A responsive website is retained; no iPhone installation route is claimed in this change.

## Content and storage

The former recursive `app/` copy could distribute ignored local course scores. All release paths now consume one sanitized `dist/`: top-level application modules, named public images and catalog JSON, the required pinned alphaTab runtime, fonts, soundfont and license. A generated empty score index replaces the machine-local index. The initial lightweight build excludes course scores. The owner's subsequent standardized-course authorization permits an explicitly pinned private course pack as described in [course resources](../engineering/course-resources.md). Original videos, full transcripts, arbitrary data files, backups and credentials remain excluded. Users can select their own local MusicXML/GP files. Development still serves local-only prepared course assets.

Windows uses a stable internal `eguitar://app` secure origin and `%APPDATA%/EGuitarOmitrix`. This protocol is registered only inside Electron, not with Windows. No URI handler or file association is installed. The renderer has no Node integration, preload bridge or generic filesystem capability. Context isolation, sandbox configuration, CSP, resource confinement, outbound Bilibili URL allowlisting and audio-only permission handling are explicit.

Android uses the stable application ID `io.github.intsheep.eguitaromitrix` and local `https://localhost` WebView origin. Android's microphone runtime prompt is reached through the existing explicit start action. Native background signals call the existing timer/playback/capture cleanup. Android cloud backup is disabled. A narrow `ExportFile` plugin opens Android's document picker for the three existing backup/score export filenames; it has no filesystem path input or storage permission. File selection/import uses the system picker.

Profiles remain separate from browsers and other devices. Existing versioned JSON export/merge imports transfer confirmed records and goals; no automatic profile migration or synchronization occurs. Preserve app identifiers and origins during updates. Never uninstall an Android test APK without first exporting its records: CI debug signing keys are not stable across clean runners. Stable Android signing is required before distributing an upgradable production application.

## Delivery

PRs and main builds run unit, sanitized-build, responsive browser and isolated Electron checks, followed by Windows NSIS and Android debug-APK packaging. Artifacts have a source/version manifest and SHA-256 checksums. They do not publish a release. A manual, validated version tag creates a draft prerelease only; see the [release procedure](../engineering/releases.md).

The initial Windows installer is unsigned and the Android APK is a debug-signed test build. No signing identity, store credentials or personal content is committed. Automatic updates, store submission, production Android signing, Windows ARM64 and iOS packaging remain separate work.

CI exposed an alphaTab 1.8.4 audio-worklet startup/stop race when playback was immediately closed. The pilot explicitly selects the SDK's documented `WebAudioScriptProcessor` output mode so background/close can stop playback synchronously. This avoids patching generated vendor code; it may have more scheduling overhead than worklets. Revisit the compatibility choice when the pinned SDK is upgraded. See [official output-mode documentation](https://alphatab.net/docs/reference/settings/player/outputmode).

## Visual provenance

No new screen layout was designed. Retained the implemented Stitch-backed workspace, finish/resume, review and tuner decisions listed in [references and rationale](../design/references-and-rationale.md), including project `6723020998384701419`. Rejected changes to those layouts for platform branding. Native launcher/installer icons derive from the existing original `app/assets/mark.svg`; default Capacitor branding is removed. No new generated screen is claimed as a tested app.

## Consequences and limits

Electron supplies Chromium for Windows, increasing the installer size and creating a runtime update responsibility. Android depends on a current system WebView. Bundled UI and practice storage work without a local Node server or a network connection; outbound course videos still require the original provider. Lightweight builds omit the course library; explicitly selected course builds include the pinned private resource pack. Audio accuracy, device routing, physical suspend/resume, Android permission/picker behavior and installer upgrade behavior require target-device acceptance; automated synthetic checks are narrower evidence.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/), [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol), [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup), [Capacitor configuration](https://capacitorjs.com/docs/config).
