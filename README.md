# 帅帅练琴屋

A free, open-source electric-guitar practice companion: choose a lesson, see what to practice, open the original teaching video, and keep your practice history on your own device.

**[Open the practice room](https://intsheep.github.io/EGuitarOmitrix/) · [Download apps](https://github.com/intSheep/EGuitarOmitrix/releases/latest) · [Report a problem](https://github.com/intSheep/EGuitarOmitrix/issues)**

## Thanks to the teacher

Thank you to **「帅帅是把电吉他」老师** for the **「零基础入门电吉他 · 7周自学计划」** course that makes this project possible. The lesson structure, teaching material and prepared course references originate from that course. Please visit and support the original lessons:

**[Watch the original course on Bilibili — BV1FT411Z7iu](https://www.bilibili.com/video/BV1FT411Z7iu/)**

This is an independently developed practice companion, not an official product or endorsement by the teacher. Prepared notation and timing may contain interpretation errors; the original teaching is the reference. We do not claim authorship of the teacher's material. See [source attribution and licensing](COURSE_ATTRIBUTION.md).

## Start practicing

1. Open the website or install the Windows app. Mac users can use the website immediately; native macOS packages remain experimental until signed and tested.
2. Select a lesson and choose **开始练习**. Use the metronome, scores and tuner when needed.
3. Finish to save your practice. Stable BPM and proficiency are optional self-reports.
4. Use **练习回顾 → 备份与管理** to export a backup before changing browser, device or app version.

The workspace includes course navigation, lesson requirements, foreground practice timing, separate confirmed video-viewing time, a metronome, local microphone tuning, prepared scores and practice review. Playing a video or finishing a timer does not establish mastery.

## Choose an edition

| Edition | Delivery and updates | Current boundary |
| --- | --- | --- |
| Web | GitHub Pages; reload after finishing practice to use a new deployment | Internet is required to load the site and uncached resources. Full offline/PWA support is not claimed. |
| Windows x64 | NSIS installer from Releases; **帮助 → 检查更新** downloads and installs only with confirmation | Unsigned pilot; Windows may show a security warning. Versions before 0.4.0 need one manual installer upgrade. |
| Android | APK from Releases; download a newer APK and confirm installation | Release builds use a stable signing key. Earlier debug builds may require backup, uninstall and import. No silent updater or store release. |
| macOS | Web first; optional native ARM64/Intel build workflow | Native signing, notarization and physical Mac acceptance remain required for supported distribution. |

Records stay in the current browser or app profile. There is **no account, cloud sync, recording upload or automatic cross-device transfer**. Browser storage can be cleared by the browser/user; export backups regularly. Windows keeps its existing `%APPDATA%/EGuitarOmitrix` directory. The technical app IDs and repository URL stay unchanged when the display name changes.

The website loads score files and images on demand, rather than downloading the entire course archive at startup. Original videos open on Bilibili. App course builds include the checksum-pinned prepared resource pack for local score use; these assets are versioned separately from the source code.

## Development

Use Node.js 24 (`.nvmrc`) and the committed dependency locks:

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:web
```

`npm run dev` prints the local address, normally `http://localhost:5173`. The default build is lightweight. To include the public course pack:

```sh
node scripts/download-course-resources.mjs
EGUITAR_COURSE_PACK=private/course-resources-2026.10.20.1.zip npm run build
node scripts/verify-distribution.mjs dist
```

The `private/` name is a legacy ignored staging directory; the published course pack is public. Credentials, signing keys, personal practice records and unreferenced machine-local files never enter a build.

Desktop commands and platform prerequisites are in [the release guide](docs/engineering/releases.md). CI validates code and distribution before producing platform artifacts. Tagged releases create a draft first; publishing a stable release exposes its Windows update manifest. Never replace an existing release asset with different bytes.

## Contributing and licensing

Project-authored code is available under the [MIT License](LICENSE). The MIT license does **not** relicense course material or third-party dependencies; see [attribution](COURSE_ATTRIBUTION.md). Report a reproducible issue with app version, device, expected behavior and actual behavior. Do not attach personal backups or credentials.

Documentation is English; the learner interface and original course identifiers are Chinese. Preserve the white/blue task-focused design, course revisions, unknown prescription values and local history. Small improvements use focused PRs; a new issue is not required for every fix.

- [Product requirements](docs/product/PRD.md)
- [Design references](docs/design/references-and-rationale.md)
- [Public delivery and validation](docs/engineering/public-distribution.md)
- [Build and release procedure](docs/engineering/releases.md)
- [Course resource pipeline](docs/engineering/course-resources.md)
- [Documentation map](docs/README.md)
- [Agent instructions](AGENTS.md)
