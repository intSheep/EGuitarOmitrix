# EGuitarOmitrix

A private electric-guitar practice companion. The first slice provides a task-focused exercise workspace and exact links to the course's Bilibili lessons, backing tracks, and demonstrations.

**Current:** 140 source entries and task summaries for 72 lessons; automatic focus timing, a metronome, lesson review, local backup/merge, a standard six-string tuner and local score playback. Windows and Android app packaging is authorized by FR-021. Records stay local. Source uncertainties remain in the inventory.

Select an exercise, click **开始练习**, pause as needed, then finish to save. Refresh restores a paused draft. Videos and hidden pages pause timing. Use **练习回顾** for history and backups. Outcome ratings are optional. Load your own MusicXML/GP scores; native Guitar Pro launch remains deferred.

## Run locally

Use Node.js 24 (`.nvmrc`; minimum 22.12) and install the locked dependencies first.

```sh
npm ci
npm run dev
```

Open the printed local address, normally `http://localhost:5173`. The server serves only `app/`; original Downloads material is neither served nor modified.

```sh
npm test
npm run build
```

The build creates a sanitized static application in ignored `dist/`, with version/source metadata and asset hashes. It excludes machine-local course media/scores and personal records. The development server can still serve your ignored local score collection; the distributed app offers local score-file import. No hosting or public deployment is configured.

## Installable apps and CI

Windows is the primary native target. CI validates unit/browser/desktop behavior before producing an unsigned Windows x64 installer and a debug-signed Android test APK. Download packages, manifests and checksums from the successful PR/main Actions run. Ordinary CI does not publish a release. The manual release workflow validates an existing version tag and creates a draft prerelease only.

```sh
npm run desktop:setup
npm run desktop
# On Windows:
npm run package:windows
# With JDK 21 and Android SDK 36:
npm run package:android
```

Windows keeps records in `%APPDATA%/EGuitarOmitrix`, separate from your browser. Transfer existing records through **练习回顾 → 备份与管理**. Android test signing keys may differ across CI runs: export a backup before replacing an older test APK. Stable production signing and iPhone packaging are deferred. See [build/release procedure](docs/engineering/releases.md), [architecture](docs/decisions/0006-native-app-packaging.md) and [actual verification and limits](docs/engineering/app-packaging-validation.md).

## Product and design

- [Product requirements](docs/product/PRD.md)
- [Design references and functional rationale](docs/design/references-and-rationale.md)
- [Stitch brief and output](docs/design/stitch-brief.md)
- [Assignment inventory](docs/product/assignment-inventory.md)
- [Practice storage decision](docs/decisions/0002-manual-practice-records.md)
- [Source assessment](docs/product/source-assessment.md)
- [Playback and GP8 research](docs/research/practice-playback.md)
- [Roadmap](docs/product/roadmap.md)
- [Validation and limits](docs/engineering/validation.md)
- [Documentation map](docs/README.md)

Repository: [intSheep/EGuitarOmitrix](https://github.com/intSheep/EGuitarOmitrix) · [Issues](https://github.com/intSheep/EGuitarOmitrix/issues) · [Milestones](https://github.com/intSheep/EGuitarOmitrix/milestones).

## Working agreements

Both human-facing and Agent-facing documentation are English. Original Chinese course titles and necessary evidence remain recognizable; learner UI is Simplified Chinese.

Use GitHub Issues, Milestones, and pull requests with requirement/acceptance traceability. Source metadata may be committed; full transcripts, videos, scores, credentials, and personal practice records stay outside Git. A source launch is not a practice result.

Agents should start with [AGENTS.md](AGENTS.md).

- [Focus session storage decision](docs/decisions/0003-focus-practice.md)
- [Focus and summary Stitch design](docs/design/focus-practice.md)

## Local score pilot

Run `npm install` before starting; `npm start` prepares the pinned alphaTab runtime locally. In focus mode choose **乐谱** to view/play a prepared score or open a local MusicXML/GP file. The two machine-local pilots cover P025 (from P026) and P071 (from P073); course assets are intentionally ignored by Git. New clones can load their own local files. See [video score preparation](docs/research/video-score-preparation.md) for tools, provenance, assumptions and coverage. GP downloads are available; native GP8 launch is not integrated.

For local embedded-audio GP preparation, see [the audio/synchronization pipeline](docs/research/audio-score-pipeline.md). Generated GP candidates are not automatically accepted lesson scores.

[Backing-score batch two](docs/research/score-batch-two.md) records the accepted P072 reference and the next three local listening candidates, including notation and timing limitations.
