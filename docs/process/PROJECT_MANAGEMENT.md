# Project management

Owner refinement on 2026-10-20: use focused pull requests for reviewable changes. GitHub Issues and Milestones track work that needs independent planning or follow-up; an issue is not a prerequisite for every change. This supersedes the original one-issue-per-change convention. Link applicable PRD requirement IDs to acceptance criteria.

## Sources of truth

| Concern | Source of truth |
| --- | --- |
| Product scope | `docs/product/PRD.md` |
| Dated feasibility findings | `docs/research/` and `docs/product/source-assessment.md` |
| Work status and dependencies | Pull requests; GitHub Issues and Milestones for independently tracked work |
| Design exploration | Stitch, with references in `docs/design/` |
| Engineering decisions | Future ADRs in `docs/decisions/` |
| Code and accepted document revisions | Git history and reviewed PRs |
| Learner records | Local app data and user backups, never issue comments |

Use this small workflow rather than a separate task system unless the owner requests one. Do not claim it is a universally required or "latest" industry standard.

## Issues

Choose the lightest sufficient record:

| Situation | Action |
| --- | --- |
| A bounded, authorized fix, polish, refactor, test or documentation update can be completed and verified in the current task | Implement it directly and describe the problem, result and actual validation in the PR. No new issue or milestone is required. |
| The change or a related small problem belongs to an existing issue or PR | Continue that work and update its scope and evidence when needed. Do not create a separate issue for each discovery or implementation step. |
| Work needs independent prioritization, a product/design decision, coordination across PRs, or deferred follow-up | Reuse a suitable issue or create one focused on that independently tracked outcome. |

The owner's request can supply the scope for a direct fix. Do not ask the owner to file an issue before starting, invent an issue number for a branch, or create a retrospective issue merely to document a completed small fix. Judge the need for an issue by independent tracking needs, not a line-count or time threshold. An unrelated observation can be noted briefly in the PR or final response; it does not automatically require a new issue or authorize expanding the task.

When an issue is warranted, it states:

- The user-visible problem or research question.
- Linked requirement IDs, scope, and explicit exclusions.
- Acceptance criteria and appropriate validation evidence.
- Dependencies and milestone.
- Current state: Backlog, Ready, In progress, In review, or Done.

Use one `status:*` label, one `type:*` label, and an appropriate `priority:*` label. Areas can be multiple. Priorities: P0 for the core tracker, P1 for optional improvements, Research for investigations without implementation authorization.

Issue creation or milestone placement is planning, not authorization to implement a research-only item. Mark a blocker with a concrete dependency; do not imply that untested feasibility is verified.

## Branches and pull requests

- Default branch: `main`.
- Use `codex/<topic>` by default. Existing `docs/<topic>`, `feat/<issue>-<topic>`, `fix/<issue>-<topic>` and `research/<issue>-<topic>` branches can continue. An issue number is optional; never create an issue just to name a branch.
- Keep PRs reviewable; describe resulting behavior or findings, the evidence, and remaining limits.
- For direct fixes, the PR's problem/result and validation are sufficient; link applicable requirements and omit irrelevant issue/milestone fields. Do not split related small corrections into separate PRs solely to satisfy a one-change rule.
- When an issue exists, link `Refs #N` while review/acceptance remains open; use `Closes #N` only when the PR satisfies the full issue.
- Use draft PRs when scope/design or evidence still needs review.
- Do not merge a requirements draft as a substitute for owner scope review.
- Record implementation choices in ADRs when they affect storage, content ownership, deployment, or score interoperability.

## Definition of ready

The authorized problem, intended result and appropriate verification are clear. For a direct fix, this can be established by the owner's request and current code; an issue, new requirement or milestone is not required. Larger work identifies applicable requirement IDs, acceptance criteria, source inputs and dependencies. A design task has a Stitch brief. A feature that began as research has an explicit decision to implement. Unknowns that could change the design are bounded or recorded as a spike.

## Definition of done

The requested deliverable exists; acceptance is supported by appropriate evidence; relevant docs are updated; no secrets or course/personal payloads are committed; review is complete. An issue is updated only when one is involved. A research issue can be done with a sourced conclusion and stated unknowns. That does not make the investigated feature done.

Documentation checks cover links, requirement traceability, source-backed claims, and whitespace. Application changes also require meaningful unit checks and browser verification appropriate to the scope. Record actual evidence and limits in `docs/engineering/validation.md`; a local build is not a deployment.

## Review and scope changes

Review backlog when a milestone completes or the owner changes priorities; no scheduled automation is created. Add or revise requirements when scope changes and update the PR description to describe the final result. Preserve the distinction between the current authorized deliverable and possible future features.

## Repository setup boundary

The repository is private. Templates and labels are workflow aids, not enforced branch protection or CI gates. Configure enforcement later if requested and supported; do not represent this baseline as protected or production-ready.
