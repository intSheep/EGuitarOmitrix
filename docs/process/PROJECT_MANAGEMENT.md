# Project management

Agreed with the owner on 2026-10-18: GitHub Issues + Milestones + pull requests, with PRD requirement IDs linked to acceptance criteria.

## Sources of truth

| Concern | Source of truth |
| --- | --- |
| Product scope | `docs/product/PRD.md` |
| Dated feasibility findings | `docs/research/` and `docs/product/source-assessment.md` |
| Work status and dependencies | GitHub Issues and Milestones |
| Design exploration | Stitch, with references in `docs/design/` |
| Engineering decisions | Future ADRs in `docs/decisions/` |
| Code and accepted document revisions | Git history and reviewed PRs |
| Learner records | Local app data and user backups, never issue comments |

Use this small workflow rather than a separate task system unless the owner requests one. Do not claim it is a universally required or "latest" industry standard.

## Issues

Each issue states:

- The user-visible problem or research question.
- Linked requirement IDs, scope, and explicit exclusions.
- Acceptance criteria and appropriate validation evidence.
- Dependencies and milestone.
- Current state: Backlog, Ready, In progress, In review, or Done.

Use one `status:*` label, one `type:*` label, and an appropriate `priority:*` label. Areas can be multiple. Priorities: P0 for the core tracker, P1 for optional improvements, Research for investigations without implementation authorization.

Issue creation or milestone placement is planning, not authorization to implement a research-only item. Mark a blocker with a concrete dependency; do not imply that untested feasibility is verified.

## Branches and pull requests

- Default branch: `main`.
- Use `docs/<topic>`, `feat/<issue>-<topic>`, `fix/<issue>-<topic>`, or `research/<issue>-<topic>`.
- Keep PRs reviewable; describe resulting behavior or findings, the evidence, and remaining limits.
- Link `Refs #N` while review/acceptance remains open; use `Closes #N` only when the PR satisfies the full issue.
- Use draft PRs when scope/design or evidence still needs review.
- Do not merge a requirements draft as a substitute for owner scope review.
- Record implementation choices in ADRs when they affect storage, content ownership, deployment, or score interoperability.

## Definition of ready

Requirement IDs, acceptance criteria, source inputs, and dependencies are clear. A design task has a Stitch brief. A feature that began as research has an explicit decision to implement. Unknowns that could change the design are bounded or recorded as a spike.

## Definition of done

The issue's actual deliverable exists; acceptance is supported by appropriate evidence; relevant docs are updated; no secrets or course/personal payloads are committed; review is complete. A research issue can be done with a sourced conclusion and stated unknowns. That does not make the investigated feature done.

Documentation checks cover links, requirement traceability, source-backed claims, and whitespace. Application changes also require meaningful unit checks and browser verification appropriate to the scope. Record actual evidence and limits in `docs/engineering/validation.md`; a local build is not a deployment.

## Review and scope changes

Review backlog when a milestone completes or the owner changes priorities; no scheduled automation is created. Add or revise requirements when scope changes and update the PR description to describe the final result. Preserve the distinction between the current authorized deliverable and possible future features.

## Repository setup boundary

FR-021 adds actual PR/main CI and Windows/Android packaging; see [release procedure](../engineering/releases.md). Review the current revision's validation and both platform build gates before merging. Ordinary CI artifacts are not published releases. Manual releases remain draft prereleases until owner/device review. Branch protection and production signing are not automatically implied by these workflows.

The repository is private. Templates and labels are workflow aids, not enforced branch protection or CI gates. Configure enforcement later if requested and supported; do not represent this baseline as protected or production-ready.
