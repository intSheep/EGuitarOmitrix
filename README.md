# EGuitarOmitrix

A private electric-guitar practice companion. The first slice provides a task-focused exercise workspace and exact links to the course's Bilibili lessons, backing tracks, and demonstrations.

**Current:** PRD v0.3; 140 source entries, assignment summaries for all 66 current and 6 legacy lessons, manual actual-duration/outcome/BPM/next-focus records, per-exercise history, editing, reversible deletion, backup merge, and resume after refresh. Records stay in this browser's IndexedDB. Most tasks are AI-subtitle candidates; eight were recovered from visually inspected video closing cards. Uncertain values are labeled.

Open an exercise, inspect the teacher task and its source time, practice, then save actual minutes and your outcome. Next time, the latest practiced exercise and next-focus note appear on the workspace. Use **练习记录** to edit or export a backup. No timer or automatic grading is included. Score conversion/playback and Guitar Pro integration remain deferred.

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
