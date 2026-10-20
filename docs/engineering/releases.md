# Application builds and releases

Owner authorization: 2026-10-20, issue [#40](https://github.com/intSheep/EGuitarOmitrix/issues/40), FR-021. Architecture: [ADR 0006](../decisions/0006-native-app-packaging.md). All commands run from the repository root.

## Build contract

- Use Node 24 (`.nvmrc`) and `npm ci`; commit `package-lock.json` with dependency changes. Exact direct versions are pinned. Electron's binary is prepared explicitly with `npm run desktop:setup`.
- Root and `desktop/package.json` versions must match. Android derives version name/code from the root version when packaged; each component must be 0–99. Version `0.3.0` maps to Android versionCode `301`.
- Every platform consumes `npm run build`, never a copy of the developer's application directory. The public build emits `build-info.json` with version, source commit and asset hashes. It deliberately replaces the local score index with an empty index.
- Keep course media, scores, learner records and signing files outside Git and release inputs. The build and privacy-confinement tests are part of validation. `npm start` still serves machine-local material for development; it is not the release payload.
- Keep app IDs, Windows data directory and web origins stable. Browser and native profiles are separate; transfer records through **练习回顾 → 备份与管理 → 导出备份 / 导入备份**. Scores/media are relinked separately.

## Local commands

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:web
npm run desktop:setup
npm run desktop
```

Run `npm run test:desktop` for a real Electron smoke test using a fresh synthetic profile. Linux headless runners use `xvfb-run --auto-servernum npm run test:desktop` and `EGUITAR_TEST_NO_SANDBOX=1` solely for nested test environments. Production application settings keep sandboxing enabled. Test audio is synthetic; tests never load the owner's records or open a real outbound browser.

On Windows:

```sh
npm run package:windows
```

Outputs: `release/windows/EGuitarOmitrix-<version>-windows-x64-setup.exe`, installer blockmap, `windows-manifest.json`, `windows-SHA256SUMS.txt`. The NSIS installer supports a per-user install and retains the application's local data. This initial installer has no code-signing identity; Windows may present its unsigned-application warning. A successful build is not installer/upgrade acceptance.

On a machine with JDK 21, Android SDK Platform 36 and Build Tools 36:

```sh
npm run package:android
```

Set `JAVA_HOME` and `ANDROID_HOME` to the installed tools when necessary. Outputs: `release/android/EGuitarOmitrix-<version>-android-test.apk`, `android-manifest.json`, `android-SHA256SUMS.txt`. This is a debug-signed sideloading test package, not a Play Store release. Separate CI runs can have different debug keys, so replacing an earlier APK may require removal; export a backup before doing so. A stable, privately backed-up signing key must be configured before production updates. This change does not create or upload production signing credentials.

Remove prior `release/` output when changing versions. The packaging manifest rejects unexpected installer versions. To verify an artifact on Windows, compare `Get-FileHash <installer> -Algorithm SHA256` with its checksum file. On Linux, run `sha256sum --check <platform>-SHA256SUMS.txt` from the artifact directory.

## CI gates and artifacts

`ci.yml` runs on PRs, pushes to `main`, and explicit dispatch. It calls `app-build.yml` with read-only repository permissions and no inherited secrets. Actions are pinned to commit SHAs. Concurrent superseded PR checks are cancelled.

| Gate | Actual work | Output |
| --- | --- | --- |
| Validate application | Clean locked install, all Node tests (Python/FFmpeg synthetic score fixtures), sanitized build, Playwright at 1440/768/390 px, actual Electron smoke under Xvfb | Sanitized web artifact; failure-only browser traces |
| Windows installer | Windows runner, clean install, NSIS x64 packaging, packaged-resource hash verification, actual packaged-executable smoke | Unsigned installer, manifest, checksums |
| Android test APK | JDK 21, Android SDK 36, pinned Gradle distribution with SHA-256, Capacitor sync, Gradle debug build, APK resource verification | Test APK, manifest, checksums |

The platform jobs depend on successful validation. Ordinary artifacts last 14 days; failed browser traces last seven days. Download artifacts from the successful Actions run. These are CI artifacts, not a published GitHub release. The Windows runner smoke exercises a real Windows executable; it does not install the NSIS package. Android compilation does not establish on-device microphone or picker acceptance.

Before merging, require all three gates to pass for the current PR revision. Do not merge based on a successful earlier commit. Repository branch-protection rules are not configured by this change; this convention is a review rule, not a claim of enforced GitHub protection.

## Deliberate draft release

1. Review and merge the focused PR after its current gates pass. Export a user backup before device upgrade testing.
2. Bump root and desktop versions together, update the lockfile, and merge through the same process.
3. Create an existing `vMAJOR.MINOR.PATCH` tag identifying that version on `main`.
4. Dispatch **Draft application release** with the tag. Validation requires an exact package/tag match, a clean checkout and ancestry on `origin/main`. Wrong tags or arbitrary branch commits fail.
5. The workflow rebuilds and tests the tag, then creates a **draft prerelease** containing Windows/Android packages, manifests and checksums. It does not auto-publish, upload to a store or install anything.
6. Inspect the draft and test installation, restart, backup/restore, local score loading/playback, microphone start/deny/close/background, sleep recovery and an upgrade retaining synthetic records on target devices. Publishing and production signing remain explicit owner actions.

Build timestamps and signatures can vary between runner/package-tool executions; the contract is traceable locked inputs and verified output checksums, not bit-for-bit identical installers.

## iPhone follow-up

Capacitor can reuse the interface for iOS, but native builds require macOS/Xcode and Apple signing/distribution setup. No iOS directory, IPA, Apple account access or App Store submission is configured. Keep that work separate from the current Windows/Android pilot. See [Capacitor's official environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).
