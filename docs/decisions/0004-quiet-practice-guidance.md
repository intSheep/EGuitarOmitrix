# ADR 0004: Quiet practice guidance and backward-compatible results

Date: 2026-10-18. Status: accepted by owner scope authorization; issue #31.

The timer stops before presenting a dedicated finish page. Confirmation values remain in the recoverable draft, protected by the existing cross-tab practice lock. Saving adds one result and deletes its draft in one IndexedDB transaction. Failed writes leave the draft intact. Saving counts a completed session, not mastery. Proficiency is explicit, reversible and nullable; legacy outcomes retain their meanings. A new `mastered` value is self-report, never an automatic transition.

`bpm` on new results is an optional integer 1–400 with `bpmBasis: self-reported-stable`. Historical untyped BPM remains untyped until the learner explicitly edits/confirms it. `tempoUsage` contains unique BPM/positive-seconds pairs observed only while the practice timer and built-in metronome run together. Pause, sleep gaps, score playback and external Guitar Pro playback do not add metronome evidence. The total cannot exceed actual elapsed practice time. This is usage evidence, not verified performance. No comparable-tempo trend is claimed.

Learner goals are saved in the existing IndexedDB `session` store under `goals`, separate from source assignments and `active` draft. Fields are nullable weekly session intention and per-entry minutes/target BPM. A session snapshots its per-entry goal. Updates compare the prior value to avoid overwriting another tab's changes. Resume matches both entry and assignment version; teacher fixed tempo and no-metronome rules take precedence over a previous stable BPM. No automatic escalation or target-based mastery is used.

Backup schema 2 includes goals and logs. Schema 1 remains readable. Import checks every log/goal first, then merges logs and goals in one transaction. Conflicting IDs or different existing goals reject the whole import; neither side is silently overwritten. Future schema versions are rejected. The database schema version remains 2 because no object-store migration is required. Raw course media is excluded as before.

Weekly goals use Monday-to-Sunday local calendar session counts, not a streak. A session belongs to its start date; practice durations keep their existing interval-based midnight allocation. Empty weeks do not create debt or reset proficiency. Timer drafts remain separate from exported completed history.

## Daily instructor requirements extension

Issue #33 adds a derived daily view without changing persisted history, goals or the backup schema. A prescription must have source-evidence metadata; an explicitly missing `dailyMinutes` stays null even if a dubious quote contains a number. Tempo wording remains source-backed, and only unambiguous whole-exercise fixed/start patterns can initialize the metronome. Percentage/per-piece instructions do not produce an inferred scalar BPM. Today's dose uses nondeleted same-entry/same-assignment-version logs plus an active draft only if its ID is absent from saved history. Local midnight interval splitting uses the existing accounting model. Personal session goals never substitute for a missing teacher daily target. Unfinished time is not carried forward; reaching a duration never changes proficiency.
