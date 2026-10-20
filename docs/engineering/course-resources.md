# Standardized private course resources

Date: 2026-10-20. Owner authorization: FR-023; Windows first, Android included. Initial audience: testers with read access to the private GitHub repository. This refines ADR 0006's initial lightweight content boundary. The existing approved interface is retained; no new screen layout or Stitch output is introduced.

## Payload and ownership

The immutable `2026.10.20.1` pack contains 114 indexed score/reference sets: 96 GP files, 97 MusicXML files, 149 source images and the existing index (343 files). The GP/XML alternatives are retained for downloads and compatibility. Indexed resources total 183,238,515 bytes, including the index. The archive is 177,577,073 bytes (approximately 169.4 MiB). Some GP files already contain backing audio; packaging retains their existing bytes and does not certify synchronization, musical correctness or review status. Preserve XML-only P049/P067 and reference-only image sets without inventing playable notation.

The source directory also contains duplicate archives, extracted audio and preparation files. Only the index and its referenced viewer paths are eligible. Original videos, transcripts, unreferenced audio, duplicate ZIPs, logs, cookies, credentials, learner backups and personal records are excluded. Packaging reads the source without changing it. Course assets never enter Git or LFS.

`config/course-resources.lock.json` records the private Release tag/asset, resource version, outer SHA-256, manifest SHA-256 and bounded inventory totals. The archive includes a manifest of individual asset sizes/hashes. Its index preserves the source metadata; no teacher target, tempo or learner outcome is invented. A new course revision gets a new version/tag/asset and reviewed lock change. Never overwrite the bytes behind an existing version.

## Create and validate a pack locally

Python 3.11+ standard library and Node 24 are required; no additional package is installed. Keep output under ignored `private/` or an external private directory.

```sh
python3 scripts/course-resources.py create \
  --source /absolute/private/local-scores \
  --version 2026.10.20.1 \
  --archive private/course-resources-2026.10.20.1.zip \
  --lock config/course-resources.lock.json
python3 scripts/course-resources.py verify \
  --archive private/course-resources-2026.10.20.1.zip \
  --lock config/course-resources.lock.json
EGUITAR_COURSE_PACK=private/course-resources-2026.10.20.1.zip npm run build
node scripts/verify-distribution.mjs dist
```

On Windows use `python` and set `$env:EGUITAR_COURSE_PACK` in PowerShell before `npm run package:windows`; Android uses the same environment variable before `npm run package:android`. `EGUITAR_PYTHON` can select a Python executable. An absent pack variable produces the lightweight app. A supplied missing, changed or invalid pack fails the build instead of silently omitting resources.

Validation rejects unexpected fields/file paths, unreferenced entries, symlinks, duplicate ZIP entries, traversal, missing files, checksum changes and oversized expansion. Extraction validates the complete payload before writing into a fresh staging directory. The build never uses the owner's `app/local-scores` implicitly. Learner records remain in the existing separate local profile; packaging changes no storage schema, origin or backup semantics.

## GitHub delivery

1. Confirm the repository is private. Upload the verified pack as a versioned **prerelease asset** at the lock's `releaseTag`; do not mark it latest. Attach only the allowlisted archive and a checksum. A published private prerelease is readable by repository readers; a draft is reserved for maintainers and is unsuitable for tester downloads.
2. **CI** with `include-course: true` is an explicit dispatch for validating a course bundle. It retrieves the pinned asset using the job's read-only repository token, validates it, builds both platforms and verifies resources inside the unpacked Windows app and actual APK.
3. The validation job opens real bundled GP, XML-only notation and source images at representative sizes in addition to synthetic timer/backup/export tests. The Windows job also opens a bundled score in the actual packaged executable. Native microphone/audio/picker/installation/upgrade acceptance still needs target devices.
4. **Draft application release** defaults to including the course pack. It accepts a matching version tag on main, rebuilds with the pinned pack, and creates a draft prerelease with installers, platform manifests and checksums. Review and publish the private prerelease before giving testers its URL. No store publishing or production signing is introduced.
5. Ordinary PR/main CI stays lightweight. CI artifacts last one day; full course builds omit the redundant web artifact. Releases provide durable downloads. Do not cache the course ZIP or keep a full copy as an Actions artifact.

The job token is scoped only to the download step and never enters the payload. Forks cannot use the private course downloader. Do not expose a private asset through a public mirror or change repository visibility as a distribution shortcut.

## Storage implications

Git history contains only code and the small lock file. GitHub currently documents a limit of less than 2 GiB per Release asset and no total Release-size or bandwidth limit. This approximately 170 MiB resource archive fits comfortably; installers additionally contain the platform runtime. Private Actions minutes and artifact retention use the account's plan allowance, so frequent retained installer builds can still incur usage. This workflow reduces retained duplication; it does not assert an account-specific bill or guaranteed free usage.

Sources checked 2026-10-20: [GitHub Releases access and quotas](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Verification record

Local Linux/Node 24: 59 Node tests pass, including synthetic archive tampering/traversal/symlink/extra-source-file cases. The real pinned pack verifies all 343 asset hashes; the full build verifies 386 distributed assets. Six browser scenarios pass, including bundled GP at 1440/768/390 px, XML-only notation, source-image selection, actual timed session backup/restore and native export delegation. A real isolated Electron shell opens a bundled score, plays synthetic notation, checks microphone lifecycle, native background pause/automatic timer return and persistence. The native permission answer and background signal are automated substitutes. Windows/APK CI evidence is recorded in the associated PR after execution; local Linux success alone is not Windows/Android acceptance.
