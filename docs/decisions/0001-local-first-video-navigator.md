# ADR 0001: local-first video navigator

Date: 2026-10-18. Status: adopted for the user-authorized first slice, issue #9.

## Context

The owner requested an immediate path from exercises to their exact Bilibili pages, with carefully chosen visual/feedback inspiration from learning apps. The owner subsequently rejected the childlike mascot, slogans, and copied game-map structure. Score conversion is deferred. There is no existing application framework or backend.

## Decision

Use buildless HTML, CSS, and browser ES modules for the first slice, with Node's standard library for local serving, packaging, and tests. No runtime dependency, build-time registry access, account, or backend is required. Source lives in `app/`; `npm run build` copies it to ignored `dist/`.

Commit only the public course metadata needed for browsing: title, page, CID, duration, stage, media kind, subtitle availability, and old-version marker. Preserve all 140 source entries. Neither transcripts nor videos are included. Exact outbound links include the BV ID, page, and CID.

Use localStorage only for a versioned navigation cursor: the last opened source entry. It is explicitly not a practice record, completion state, or mastery measurement. If unavailable, video navigation still works. Future durable practice history will require its own storage ADR and must not reinterpret the cursor as practice.

The interface offers a task-focused list-detail workspace and searchable catalog. Desktop keeps the selected source beside the list; phone layouts use a detail dialog. The owner explicitly rejected the earlier winding path and mascot concepts. No elapsed-time counter, XP, skill mastery, streak, or fake personal history appears. Substantive practice logging and rewards remain the next planned slice. Source descriptions and stage names are app presentation, not additional teacher prescriptions.

## Consequences

This keeps the first implementation directly inspectable and portable. The static course snapshot can become stale if Bilibili changes its page ordering; CID is preserved for identification, but successful playback on Bilibili is not guaranteed by link construction. Revalidate the manifest when importing a refreshed course. Future stateful features should preserve URLs and metadata identity while introducing a proper data migration.
