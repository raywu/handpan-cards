# Saved variants — explicit conflict recovery command

2026-10-25. Narrow clarification within owner-approved plan9a96ed6d and schema
contract9c56dce6. Exact approved CLAUDE/spec packet is unchanged. This adds no new
product policy; it makes the already-approved fresh separate-save path executable.

## Required command

`commitSaved({type:'save-as-separate',collectionId,candidate},{signal})`

- Internal explicit conflict action only. Normal import remains deduplicating;
  portable URLs never grant local command or replacement authority.
- Candidate is the same validated app-owned {record,deck} as the schema contract.
  Reuse validation, genuine inventory-collision defenses and one engine build.
- Always allocate a FRESH instance/ordinal, even if another readable instance has
  identical portable meaning. Use lifetime usedInstanceIds protection/eight-attempt
  allocation and the existing exclusive lock/re-read/current collection-epoch guard.
- The source instance may have changed or been deleted; a source revision check
  would defeat this recovery choice. It does not bypass the collection epoch.
- Strip replaces/slot authority, preserve all siblings/raw/opaque data, set selected
  preference only with the same acknowledged atomic commit. No pre-ack publication.
- Public result/persistence/failure shape is unchanged. Pending submit and stale
  UI ownership guards apply; a successful write followed by diagnostic read error
  must not allocate again. Explicit retry after failed write stays distinct.

Fresh independent variants_schema_eng_review cleared this command, including
candidate/collision validation, epoch/ACK protection and duplicate-submit handling.
S may implement it with shared allocation logic, not a second storage protocol.

## Minimal UI completion contract for U/T

Conflict keeps the dirty draft and saved winner until an explicit owner action.
Required visible region #scale-conflict with message #scale-conflict-msg, and a
keyboard-operable #scale-conflict-separate action. Existing Back may cancel using
its established discard convention and return to the acknowledged winner/canonical
route with correct focus. A separate Review workflow/button is optional, not a
reason to broaden scope or silently replace a draft. Notifications alone never
load winner content over a dirty editor.

#saved-status is a dedicated persistent visible session/recovery status, not any
nonempty aria-live/screen-reader-only notice. Independent fixture copy must convey
THIS TAB only and reload/closure loss in every supported locale; English scale
input remains unchanged. U must satisfy independent design/source review and
actual native cases. This document does not claim those states are implemented.

Tests must prove conflict Save actually attempted and completed (for example,
real queued Web Lock then release plus explicit conflict outcome), not accept an
already-enabled button as completion. RESET native tests must exercise the second
trusted confirmation against the ORIGINAL arm proof, not substitute a fresh backend
scope. Actual scroll, suffix clipping, keyboard actions and locale copy require
repaired native oracles before execution. Full CI/DEV gates remain unchanged.
