# EGuitarOmitrix

A private electric-guitar practice companion. The first slice provides a task-focused exercise workspace and exact links to the course's Bilibili lessons, backing tracks, and demonstrations.

**Current:** PRD v0.2; working source navigator with 140 catalog entries, 66 current teaching exercises, seven stages, search/type/revision filters, responsive details, and outbound video links. Only the last opened source is stored locally. Practice logging, instructor-task review, notation conversion/playback, and Guitar Pro integration remain later work.

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
