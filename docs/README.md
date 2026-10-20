# Documentation map

All project prose is English. Audience determines the location, not a different language.

| Audience | Document | Purpose |
| --- | --- | --- |
| Human: owner, learner, reviewer | [PRD](product/PRD.md) | Problem, product behavior, scope, acceptance |
| Human: owner, reviewer | [Source assessment](product/source-assessment.md) | What course material exists and what remains uncertain |
| Human: owner, reviewer | [Playback research](research/practice-playback.md) | Web practice versus Windows Guitar Pro 8; research only |
| Human: owner, designer | [Design references and rationale](design/references-and-rationale.md) | Primary-source references and fit to repeated practice |
| Human: owner, designer | [Stitch brief](design/stitch-brief.md) | Design scenarios and screen requirements |
| Human: owner, contributor | [Roadmap](product/roadmap.md) | Milestones, dependencies, release gates |
| Shared: human and Agent | [Project management](process/PROJECT_MANAGEMENT.md) | Source of truth, issues, PRs, completion |
| Agent: implementer, reviewer | [Agent guide](engineering/AGENT_GUIDE.md) | Data boundaries, invariants, acceptance scenarios |
| Shared: human and Agent | [Application releases](engineering/releases.md) | CI gates, Windows/Android builds, draft releases and signing boundaries |
| Shared: human and Agent | [Native packaging decision](decisions/0006-native-app-packaging.md) | Local origins, profiles, asset exclusion and wrapper scope |
| Shared: human and Agent | [Packaging verification](engineering/app-packaging-validation.md) | Actual validation evidence and unverified device behavior |

The PRD owns requirements. Research documents own dated external findings. GitHub owns work status. Stitch owns design exploration; repository briefs record its references and review status. Examples are not approved course data.

Implementation decision: [ADR 0001](decisions/0001-local-first-video-navigator.md). Verification: [first-slice validation](engineering/validation.md).

## Assignment and logging additions

- Human review: [Assignment inventory](product/assignment-inventory.md).
- Engineering: [Manual record persistence](decisions/0002-manual-practice-records.md).
- Runtime data: `app/data/assignments.json`; authored notes: `content/assignment-notes.json` and `content/visual-assignment-notes.json`.
