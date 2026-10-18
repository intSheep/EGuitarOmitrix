# First-slice validation

Date: 2026-10-18. Scope: FR-017 source navigator and revised adult-oriented list-detail UI. This is not acceptance of the full planned tracker.

## Automated checks

- `npm test`: six passing Node tests covering inventory, unique identity, exact outbound page/CID links for every entry, legacy/type/search filters, shared related-media associations, and navigation-only persistence with unavailable storage.
- `npm run build`: successful static output in `dist/`.
- Real local Chromium `156.0.8078.4` with Playwright: desktop 1440 px and phone 390 px.

Browser scenarios passed:

1. W1 shows nine real current teaching exercises; no mascot/slogan, fabricated backing, or earned personal metrics.
2. Switching to P007 shows its six shared backing-track variants and exact source action.
3. Clicking the source opens a new tab with the expected BV, page, and CID. Local state stores only the source-entry cursor.
4. Stage switching shows W7's ten current lessons. The catalog has 124 entries with old revisions hidden and 140 when included.
5. Search `P070` finds the intended lesson. Details open, and Escape dismisses them.
6. The 390 px workspace has no horizontal overflow. Phone detail links work, and Escape restores focus to the selected row.
7. P017 remains accessible despite missing independent subtitles. A literal nonmatching markup-like query yields an empty result rather than injected content.
8. Reduced-motion mode is recognized. Disabling localStorage does not break browsing or outbound links and produces a clear cursor-persistence notice.
9. No page errors or console errors were observed in these scenarios.

The browser checks used an isolated browser context and synthetic navigation history; no actual learner records or original Downloads files were changed. Screenshots were visually reviewed for the desktop workspace and phone view.

## Environment caveat

The restricted command sandbox did not expose the same live filesystem/socket behavior as the local host: an initial Node test command reported only a file-level result, and browser/socket startup failed there. The commands above were rerun outside that sandbox and produced six actual test results, a serving local page, and the completed browser scenarios. Do not cite the earlier sandbox-only output as runtime evidence.

## Limits

- Browser outbound requests to Bilibili were intercepted in the isolated QA context to verify the exact navigation target without depending on external login or playback. This does not establish successful playback on Bilibili.
- The source snapshot was observed on 2026-10-18; page ordering can change. Revalidate an updated manifest rather than assuming a stored page remains current forever.
- No task extraction/review, practice timer/history, offline app cache, full backup, score conversion, score playback, GP8 launch, or public deployment is implemented.
- Visual comfort and workflow suitability still need owner feedback. Automated checks do not prove that the design is the owner's preferred final direction.
