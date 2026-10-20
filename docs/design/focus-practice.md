# Focus practice and effort review

Date: 2026-10-18. Issue: #12. Stitch project: `6723020998384701419`.

Generated screens:
- `a981736e3c654547903bd2dc50ad09fb`: immersive focus mode.
- `b8bafd87b9df46d480da91ca9bc38a75`: practice summary and effort dashboard.

Retained: white canvas, dark strong typography, royal-blue tactile controls, outlined rounded panels, a large elapsed timer within a quiet ambient ring, a dedicated tools area, actual-time bars and an activity calendar. The focus screenshot was downloaded and inspected; implemented desktop/mobile screens were also inspected.

Rejected from generated output: unsolicited shortcut tips, a promotional completion explanation, example metrics, avatars/settings without behavior, plan navigation, automatic next-exercise advancement, inferred mastery, and labeling metronome speed as achieved performance. The implemented outcome is optional and never preselected. No synthetic metrics ship in the application.

The workspace has one start button. Exercise rows select an exercise; they do not launch videos. Course materials now open directly clickable source rows, including a timestamped assignment-source option; see the 2026-10-20 refinement below. The focus page hides global navigation. Pause and finish are the primary in-session controls. Summary and ongoing review share actual persisted history, with backup and reversible deletion in one management dialog. No disclosure triangles, `details` or explanation accordions are used.

Motion: a nine-second pale ambient pulse runs only while timing, disabled under reduced motion. It encodes activity without bounce, rewards, streak loss or mascots. A circular decoration is not a completion percentage or mastery indicator.

## Catalog refinement — issue #14

Stitch screen `831dc4c3a4514668b5acb3d8b8a11335` explores the flat catalog and storage notice. Retained the white canvas, compact filter toolbar, page identifiers, divider-separated full-width rows and one unboxed action. No enclosing card or card grid. Desktop and mobile implementation screenshots were inspected. The attached user image was unavailable; the change follows the explicit request to remove nested containers.

## Course library redesign — issue #18

The owner rejected the flat catalog as still visually weak. Stitch screen `6880fcce19534004ba0e96d26112c34c` was generated and its screenshot inspected. Retained: named stage navigation, grouped chapter headings/counts, compact search, direct content-type filters, identifiable media rows and a single row action. Removed unsolicited tip panels, fabricated progress, settings/avatar actions and pagination. The implementation uses whole-row actions instead of tiny distant targets. Mobile stage navigation becomes a horizontal strip; the content remains a flat list without nested cards. Search, legacy opt-in, material launching and exercise selection remain functional. Stage-zero preparation/outlook entries are grouped as the course overview.

## Embedded score overlay — issue #20

Stitch screen `2a0fbb0207eb4294a0ae876021df9021` was generated for the score overlay. Retained the large white notation canvas, compact blue/neutral playback tools, local file input, source-frame toggle and download actions. No score asset is fabricated as an empty-state placeholder. Actual alphaTab-rendered desktop/mobile screenshots were inspected; the notation layout is supplied by the library, not the design mockup.

## Direct materials and viewing review — issue #41

Date: 2026-10-20. Stitch screen `f5031812a7cc497c8cc67b007abfb995` in
project `6723020998384701419` explored direct resource rows and a compact viewing
confirmation. Retained the white outlined panel, blue row affordance, prominent
teacher lesson, assignment timestamp, separate viewing duration and save/adjust/
discard choices. Adjustment is an inline minutes:seconds field. Rejected generated
course details, invented PDFs, durations/BPM, badges, statistics and playback-state
claims. Only catalog/evidence-backed resources appear in the application.

The selector and second Open action are removed. Each row launches its exact
source immediately. The app's return panel sits above the current workspace so it
remains available after navigation without forcing another modal. Practice remains
paused until explicitly resumed. Preserve the approved Brilliant palette and the
existing list-detail layout. Generated output is design exploration; isolated
browser acceptance is recorded separately.

## Continuous central tools and floating clock — issue #41

The owner's 2026-10-20 refinement supersedes overlay-based practice tools. A tool
button transfers into the central working surface through a 650 ms liquid-like
shape morph. The large clock becomes a draggable blue floating control; its
normal click returns to the large clock. Distinguish dragging from activation,
clamp movement to the viewport, and support keyboard arrow movement. Reduced
motion skips morphing and content entrance. Tool switches keep the session route
and practice clock, including explicit paused state. Pause and finish remain
available. Tuning retains its required pause; external videos keep separate time.

A new Stitch exploration was requested in project `6723020998384701419` for this
refinement. Generation timed out after 180 seconds; follow-up screen listings
returned no usable screen. No new generated design or integration is claimed.
The implementation retains the established Brilliant visual tokens and direct
materials screen `f5031812a7cc497c8cc67b007abfb995`, following the owner's explicit
central-surface, fluid-transition and floating-clock direction. It rejects new
routes, fake score/proficiency data and nested practice overlays. Actual browser
verification and its limits are recorded independently.

## Saved practice summary — 2026-10-20

The owner-requested completion redesign, Stitch reference, retained/rejected
decisions and interaction boundary are recorded in
[Saved practice summary](saved-practice.md). This replaces the oversized centered
completion panel with a compact summary and consistently aligned action buttons.
