# Public distribution — 帅帅练琴屋

Owner authorization: 2026-10-26. FR-023 extends to public source, prepared course
resources, teacher attribution, an HTTPS website and controlled app releases.
The display name changes; repository URL, app IDs, web origin, Windows data
directory and backup schemas stay stable. See [attribution](../../COURSE_ATTRIBUTION.md).

## Delivery contract

- GitHub Pages deploys the tested, sanitized, course-bundled `dist/` on main.
  URL: https://intsheep.github.io/EGuitarOmitrix/ . Deployment uses a dedicated
  Pages environment and OIDC, not a personal access token. No backend or account.
- Web loads selected resources on demand. No service worker, eager full-course
  download, offline guarantee or cross-device sync is introduced. Finish practice
  before reloading to use a new website version. Browser data needs user backups.
- Windows builds retain the technical executable name and app ID. The Chinese
  product name does not change `%APPDATA%/EGuitarOmitrix`. The main-process Help
  menu checks public GitHub Releases through pinned `electron-updater`.
- Check, download and install are explicit. Silent/on-exit installation,
  prereleases and downgrades are disabled. Download errors leave the running
  version intact. Install requires renderer pause/persistence success. No GitHub
  token or generic updater IPC is exposed to the renderer. Windows is currently
  unsigned: integrity hashes do not replace publisher signing.
- Only stable releases supply the Windows update feed (`latest.yml`, installer,
  blockmap). Publish all assets together from the tested draft. Pre-0.4.0 versions
  need one manual upgrade. A failed installed version is repaired by a forward
  release; do not automatically downgrade across storage migrations. Export a
  backup before upgrade. Actual installed-version-to-version acceptance must be
  recorded separately from controller/shell tests.
- Android PR builds remain debug-only. The tag release workflow requires a stable
  private signing key, creates a signed release APK and removes its temporary
  keystore. Never rotate the key as a routine release step. Existing debug APKs
  may require export/uninstall/import once. Updates use Android's installer,
  not a silent background updater. No store submission is claimed.
- macOS has a separate manual experimental workflow for ARM64 and Intel DMG/ZIP.
  It does not publish to the supported feed. Developer ID signing, notarization
  and physical Mac acceptance are still required; use the website meanwhile.

## Release procedure

1. Review a focused PR and pass current application/Windows/Android checks.
2. Merge it; Pages deploys main after its own tests.
3. Ensure root/desktop versions match. Tag that main commit `vMAJOR.MINOR.PATCH`.
4. Dispatch `release.yml` for that tag with the course pack enabled. It validates
   tag/ancestry/clean checkout, tests and builds, then creates a draft release.
5. Inspect manifests and checksums. Test target installers/updates with synthetic
   records; state any remaining physical-device limits in the release notes.
6. Publish the draft. Do not overwrite assets or move an existing version tag.
   Fix release problems with a new version. Course packs stay immutable too.

Configure `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` as repository
Actions secrets. Keep a separate private recovery copy of the keystore/password;
never place them in Git, Release attachments, logs, or public artifacts. The
signing alias is `eguitar-release`. Public forks do not need these secrets for
browser/debug builds and do not receive them in PR CI.

## Validation

Local Node 24: 63 unit/integration checks passed before the additional browser
update scenario. The public resource archive verifies 343 files; the sanitized
course build verifies 386 assets. Six browser distribution scenarios passed on
installed Chromium at 1440/768/390 px, including score rendering and record
export/restore. Initial sandbox subprocess failures and the missing default
Chromium revision were environment failures; reruns used subprocess permission
and the installed browser. Final prefix/update-shell/CI/deployment evidence is
recorded in the release PR. These checks do not prove physical guitar accuracy,
Android device installation, Mac hardware behavior or a real Windows upgrade.

References: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages),
[electron-builder v26 updates](https://www.electron.build/v26/docs/features/auto-update/),
[Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing),
[Android signing](https://developer.android.com/studio/publish/app-signing).

Additional local acceptance: repository-prefix hosting and lazy loading passed;
the update-preparation browser test retains the paused draft through focus and
reload. Real Electron 44.9.1 smoke passed with an isolated synthetic profile via
WSLg (test-only sandbox override), including bundled score playback, microphone
cleanup, export and restart persistence. The official runtime SHA-256 was checked.
The new desktop dependency audit reports zero vulnerabilities. These results
still do not constitute Windows installer upgrade or physical Android acceptance.
