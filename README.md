# EGuitarOmitrix

A private electric-guitar practice companion. The first slice provides a task-focused exercise workspace and exact links to the course's Bilibili lessons, backing tracks, and demonstrations.

**Current:** PRD v0.4; 140 source entries and task summaries for 72 lessons. One start action opens an immersive automatic timer with a metronome and consolidated course materials. Finishing saves actual time and opens an effort review with daily bars, activity calendar and exercise history. Records stay in browser IndexedDB, with backup merge and reversible deletion. Source uncertainties remain in the inventory.

Select an exercise, click **开始练习**, pause as needed, then finish to save. Refresh restores a paused draft. Videos and hidden pages pause timing. Use **练习回顾** for history and backups. Outcome ratings are optional. Score conversion/playback and Guitar Pro integration remain deferred.

## Run locally

Node.js 22 or newer is required. No package installation is needed for the app, build, or unit tests.

```sh
npm run dev
```

Open the printed local address, normally `http://localhost:5173`. The server serves only `app/`; original Downloads material is neither served nor modified.

```sh
npm test
npm run build
```

The build copies the static application into ignored `dist/`. The development server is for local use; no hosting or deployment is configured.

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
