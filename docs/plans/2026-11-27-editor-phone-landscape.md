# Phone landscape editor

Mode execute after independent engineering and design review. Stop after exact-head validation, authorized RC integration and served verification. Owner phone feedback is requested during planning.

## Scope and evidence

Use the verified editor RC at 072e75bb as the baseline. The phone screenshot shows the pan and controls competing vertically with a drawer handle, tabs and full-width name field above the tray. The existing split rule in index.html selects landscape at minimum 560px width and maximum 500px height. It moves the drawer sideways but leaves the portrait collapse lifecycle running. A landscape browser test explicitly expects collapse after touch placement. The expanded status can occupy the pan column.

Keep the existing editor DOM, legal placement and seat resolution, undo history, validation, and save/share path. Reuse the split predicate for layout and drawer behavior. Portrait and larger editor layouts keep their current sizing and actions.

## Proposed layout and decisions

- Fixed pan on the left, persistent controls on the right, existing Undo/Save/menu rail pinned. Remove the handle and skip portrait close/reopen focus and banner reminders in split mode. Keep the full pan and underside envelopes clear of the rail, including during drag, using the measured column bounds and rail.
- Keep Scale and Layout reachable. Put the note tray first in the right column with 44px touches and let only the controls scroll at constrained heights. Preserve the existing ordinary vertical scroll gesture and horizontal note lift. Keep keyboard focus reachable and native input behavior.
- Owner asked for the name to be left aligned and truncated by the menu. Owner offered the top row as an alternative. Trial layout moves the existing field to the first row in the available space after the Back/title area and before the mode controls. The field is left aligned, truncates at rest, and keeps its complete value while editing. More stays in the pinned actions. Keep generated name, accessible name, cancel, Escape and save state.
- Owner chose feedback at the bottom of the handpan. Anchor the existing banner to the bottom of the pan column, directly above the rail. Measure space for the full pan and underside envelope above active feedback, leave tray hit targets clear, and bound long localized messages with a keyboard/touch scroll path. Preserve live announcements and modal behavior. Keep the camera fit stable during an active drag even when the banner copy changes.

Owner accepted independent controls scrolling and selected bottom-of-pan feedback. Use the first-row field to prioritize canvas and tray space. Move the scale notation field to the top of the controls column so the left pan can start immediately below the header.

## Lanes and acceptance

1. Layout and interaction, index.html and existing localization source only if new copy is necessary. Build on the current split media rule, use a single matching state predicate, account for keyboard and visual viewport, and preserve the active draft/selection across rotation. Resize during an active drag must leave a usable, uncommitted draft if the gesture is interrupted. Focus must never land on the hidden portrait handle. Keep touch drag and taps valid with the right column present.
2. Browser coverage, tests/editor_e2e.test.js and existing suite-health inventory if adding a hosted case. Extend current landscape cases instead of making another harness. At 568×320, 667×375 and 844×340 test full pan/rail bounds, reachability of right-column controls, visible tray, absence of drawer handle in focus order, successful touch drag with persistent panel, and tap placement. Cover Standard and Neotone, name edit/cancel, keyboard/focus, rotation in the same draft during naming and active drag, portrait drawer restoration, repeated placements, rejected drops without history changes, and one localized wrapping error. Add a required hosted landscape journey where feasible and retain all existing hosted cases. Update obsolete assertions only where the reviewed design explicitly replaces them.
3. Integration, integrator owns branch and browser lease. Run targeted named Chrome cases with actual test counts and inspect landscape render at short and normal heights. Run portrait, tablet/desktop, draft invalid Back, typed Guided, bottom pins, Neotone save/reopen and existing editor browser coverage. Full exact-head validate and final independent code review before RC. Verify served index identity and hosted cases. Record physical Safari QA separately from Chromium touch emulation. If validation fails, keep the prior RC candidate served while correcting the failure.

## Design review

Conditional pass from an independent reviewer. Adopted: protect one hittable tray row and pinned actions during long feedback; give any bounded feedback a reachable way to read all copy and preserve live announcements. If naming moves to More, use an explicit localized action available in both Add and Edit, focus the existing field directly, and restore focus to More on completion or Escape. Test both a vertical scroll gesture beginning over the tray and a horizontal touch drag across the column seam. Final disposition depends on the owner’s choices and the measured shortest layout.

## Engineering review

Conditional pass. Addressed in the plan:
- Reuse the existing editorPhoneLandscape predicate for drawer, save, and camera decisions and keep the CSS media rule aligned. Normalize split mode before any geometry or inert-state synchronization. A refused collapse is a no-op, including placement/drop feedback, rather than an artificial expand operation.
- Guard every direct handle focus, including drag settlement and status action restoration. In split mode preserve the previous visible focus where valid, otherwise use the initiating control or More. Ensure Escape still closes dialogs, menu, guided selection and name editing in their established precedence.
- Use actual left stage and rail bounds for resting and active pan and pointer ghost placement. Hidden drawer chrome contributes no camera obstacle. Check actual hit testing at the seam and on both sides after camera changes.
- Keep the feedback region separate from tray hit targets and fit the pan and its hit targets above the active feedback region. Use a bounded, reachable overflow path and test a long translated error while Save and at least one tray row are usable.

## Re-review and implementation evidence

Independent engineering and design approved the persistent panel, controls-only scrolling and bottom-of-pan status. The status has a stable geometry budget during drag and an accessible overflow path. The trial uses the existing scale-name input and preserves draft text during rotation by moving a focused input only after blur.

Focused selectors are `^LS |^P0.phone.landscape|^P0.landscape.phone|^AF.save.on.screen|^SO: (en |landscape)` (41 cases at initial implementation), then `^EDITOR-RC-LANDSCAPE:` (one 568×320 hosted-required journey with native touch placement, name editing, pinned Save and the same draft rotated into the portrait drawer). The broader suite covers every status inventory locale, portrait and tablet. The exact counts and any failure disposition belong in the final evidence.

## Resume point

Finish line: full exact-head Linux validate, followed by served RC identity and all 16 named hosted editor journeys, then owner phone review. Worktree /private/tmp/hpc-editor-phone-landscape on codex/editor-phone-landscape. Previously served editor RC 072e75bb is the verified fallback. Product and test commits through c360db16 passed eight named Chromium regression cases covering the short-landscape journey, breakpoint rotation, localized header, keyboard banner scrolling, portrait form focus and placeholder layout. A full local editor run is in progress. The initial CI run at d75668c1 failed on stale mutation contexts and the old landscape assumptions in browser tests. The latest reviewed fixes address those findings. Next action: finish mutation refresh, submit exact-head validate on the integration branch, and watch the gated RC publication and hosted verification.
