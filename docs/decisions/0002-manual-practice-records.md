# ADR 0002 — Manual practice records in IndexedDB

Date: 2026-10-18. Status: implemented for the owner-authorized assignment/log/resume loop.

## Decision

Use the existing buildless app and a browser-local IndexedDB database `eguitar-practice-v1`, with a `logs` store keyed by UUID. Each record represents one manually reported practice attempt on one stable course CID/revision. Fields: actual minutes, self-reported outcome, optional actual BPM, practice date/time, note, next focus, assignment version, creation/update times and optional deletion time. Teacher dose never pre-fills actual duration.

This slice deliberately uses manual reporting. It has no timer, inferred elapsed time, automatic plan, auto-promotion, score conversion or player. Multiple exercises practiced on one occasion are separate records; the UI calls them records, not deduplicated multi-exercise sessions. There is no comparable-tempo chart or claim of measured playing accuracy.

## Durability and concurrency

- Only a completed read/write transaction produces a saved message.
- Updates compare the existing update timestamp in the same transaction and reject stale edits from another window.
- Deletes are reversible tombstones; history exposes restore controls.
- Repeated clicks during an in-flight save are ignored. Record IDs remain stable during editing and import.
- Per-tab form drafts use sessionStorage, survive reload, and are cleared only after successful save. Closing the tab may discard the draft; it is not a saved practice record.
- A storage initialization failure remains visible and disables recording without blocking source navigation. No silent memory-only success fallback.
- No cloud sync. Same browser and origin are required. Clearing browser storage removes records. The local server must run to reload the app; an offline application shell is not delivered.

## Resume

Sort live records by actual practice timestamp, then creation timestamp. The latest attempt determines the default stage and exercise when a URL has no explicit selection. The next-focus note is shown verbatim as learner-authored context. A backdated entry does not replace a newer practice. Deleting a latest entry falls back to the next live entry. An explicit URL selection takes precedence. No streak or calendar deadline changes progress.

## Backup

Export versioned JSON including tombstones. Import validates schema, values, identifiers and known course identities before a preview. Confirmation atomically merges new IDs and skips identical records. Any same-ID/different-content conflict rejects the entire import, preserving both the existing database and the source file. This avoids destructive replacement; version reconciliation is deferred. Unknown future schemas, malformed data and oversized files are rejected without writes.

Practice timestamps are stored as ISO instants and displayed in the browser's local timezone. Manual datetime input uses that timezone. No weekly/day aggregates or midnight splitting are claimed by this slice.
