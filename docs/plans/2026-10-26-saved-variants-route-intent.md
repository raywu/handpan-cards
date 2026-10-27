# Saved variants hash repair A2 — syntactic pending routes and explicit acknowledgment

PRIVATE REVISED PLAN ONLY. A1 was NOT cleared: both review defects below are material. No additional tests/source/browser writes or runs under this revision. Independent ENG/design re-review and root activation precede implementation. Source3b07/helper3369/probebd6 and accepted original modeled RED remain frozen; performance gate stays separately HELD.

## Evidence, limits and A1 corrections

- Accepted SV-ROUTE-1 modeled RED50dc proved actual prior Hijaz ACK revision2 erases raw Pygmy destination before delayed modeled handler; immediate-delivery control passed. Native CI's firstPygmy timeout cause remains unproven. IDB/WebLocks are the reviewed sandbox MODEL, not native persistence/scheduling.
- A1 guarded every mismatch from a remembered canonical hash. ENG found ignored #something/#add/#edit-x remain noncanonical after hash handler intentionally returns, so that guard could suppress later legitimate remote canonical URL updates forever.
- DESIGN found a second liveness hole: a pending recognized hash may become exactly routeFor(currentdeck) when a real remote update publishes. Existing hash handler then returns early without refreshing marker. A later remote update is suppressed forever because marker still describes the old URL.
- A2 narrows the guard to recognized route SYNTAX prefixes and explicitly acknowledges the existing current-route-equality branch. It does not globally route or canonicalize ignored fragments, and it does not need a navigation-generation manager.

## Compared designs

A. Gate route writes only on render/record changes: insufficient; legitimate remote selected-record changes still erase a pending recognized destination.
B. Guard every hash mismatch: rejected due ignored-fragment liveness and the equality early-return hole.
C. Acknowledge ignored fragments inside handler: avoid. This conflates ignored noncanonical values with a canonical route marker and expands a handler whose existing contract is no action/history write.
D. RECOMMENDED: snapshot-only syntactic prefix guard plus existing equality-branch acknowledgment. Only recognized #deck= or #s= destinations are protected while their handler is pending; other fragments retain established publication behavior.

## Minimal proposed source patch and exact ownership

1. index.html near routeRefused/booted15089: one `lastAcknowledgedRouteHash` initialized null. It records a canonical current-deck hash acknowledged by normal syncRoute or by the existing handler's exact-current-route no-op; it is not a record of every observed location hash.
2. In existing syncRoute15091, after its canonical replaceState/no-write decision, record resulting location.hash. Keep sheetOpen/aboutOpen early returns unchanged. Keep pendingRecoveryShare's unresolved-share early return unchanged and unacknowledged by this marker.
3. In savedSnapshotListener13521, preserve reconciliation/chips/render/status/focus. Change only its syncRoute call in !dirty&&!sheetOpen: synchronize if actualhash does NOT begin with either exact existing DECK_ROUTE (#deck=) or SHARE_PREFIX (#s=), OR if actualhash equals lastAcknowledgedRouteHash.
4. This is a syntactic prefix test, not a parser-validity test: unknown deck slugs, malformed/refused share payloads and legacy recognized share versions remain protected until their existing handler decides outcome. No new validity classifier/helper required; exact expression may be inline for minimal scope.
5. In existing hashchange15185, retain observeLinkRoute and sheet/About returns. Replace current-route-equality return with `{ lastAcknowledgedRouteHash=location.hash; return; }`. Equality is still measured against actual routeFor(deck()); this records recognition without writing URL/history, changing selection or persistence.
6. All other deliberate syncRoute callers remain unconditional: direct chip selectDeck10751, boot finish15212, About links/close pendingPop, local SAVE/pop completion and openShare finish. No guard inside global syncRoute, no blocking ordinary immediate chip URL/LINK updates.
7. No direct acknowledgment of ignored #something/#add/#edit-x. Their hash handler remains no action/history change; later eligible snapshot publication may canonicalize exactly as original behavior because the guard does not protect those prefixes.
8. Exact source scope: one variable, one existing syncRoute acknowledgment, one snapshot conditional, one existing handler no-op acknowledgment. No parser/storage model/helper/generation manager or new hook. Root author S must independently inspect the final diff for other route writers before integration.

## Core behavioral proof obligations

- Pending recognized destination + prior preference ACK/no-op reread/real remote selected-record edit/delete/slot replacement: snapshot may update collection/UI but preserves raw destination until the existing handler. Handler then resolves against latest collection.
- No-pending recognized canonical URL + legitimate remote selected-record edit/delete/replacement: canonical URL and fresh LINK advance to actual acknowledged result. This must remain live across multiple successive publications.
- Pending recognized destination which becomes exactly current route after a real remote update: handler no-op performs zero history/URL writes, acknowledges that route, and a SECOND actual remote update later canonicalizes URL/LINK. This is mandatory, not an optional edge case.
- Ignored fragments remain ignored by handler with no immediate history action. A subsequent real peer selected-record edit/delete still updates current canonical route and fresh LINK. Do not change the ignored-handler contract to get this pass.

## Swarm lanes and pre-source boundary tests

Coordinator/root freezes immutable refs, ledger checkpoint and serialized browser lease. T owns only existing tests/app.test.js SV-ROUTE-1 and its already authorized floor940; no new registration or floor increment. S owns the four narrow index.html changes only after expanded tests/RED accepted. P independently generates a committed exact-group route-writer fault and checks intended failing assertion. R provides independent ENG/design review, separate from authorship.

T freezes ALL cases before S source work; use real app commands via the existing shared-origin IDB/WebLocks MODEL, peer commits, actual revisions/records, and independent literal expected routes/LINK bytes from known fixtures. Intended old/new URLs are recorded separately; force-dispatch only current value AFTER actual pending destination assertion, never heal by reassigning saved expected URL.

1. Retain original immediate Hijaz19→Pygmy53 control, prior acquired named-barrier prefer ACK erased-destination RED, and unchanged reread case. Existing source is expected to fail first at the accepted ACK assertion; all later cases must execute in full GREEN.
2. Add recognized pending/no-pending paired actual peer edit, selected delete and builtin-slot replacement. Verify actual committed state/revision/visible result; preserve raw incoming route versus canonical rewrite+fresh LINK as appropriate.
3. BEFORE SOURCE: for each ignored `#something`, `#add`, `#edit-x` while no overlay is open, force its actual hash handler, assert identical raw fragment and NO history.calls delta. Then publish a real peer selected-record edit/delete, assert canonical URL and freshly copied LINK reflect current acknowledged result. No invented 'ignored marker acknowledgment' assertion.
4. BEFORE SOURCE: selected saved recordA has canonical routeA. Set raw hash to independently pinned routeB before dispatch; peer commits selected recordB so visible canonical route is now exactly rawB. Assert record/revisionB accepted and rawB preserved; force-dispatch CURRENTB, assert zero history.calls delta. Peer then commits recordC; assert record/revisionC and canonical routeC+fresh LINK. This catches A1's stale-marker equality hole.
5. Existing direct chip immediate route/LINK-before-ACK test remains unchanged and required. No global mismatch guard may block its synchronous writes.
6. Lifecycle boundaries: actual boot route, About fragment open/close/link, dirty/clean sheet and local SAVE/pop, protected recovery pending share, malformed/refused #s and unknown #deck fallback, legacy v5 canonical-v6 rewrite. Reuse existing tests; add compact missing marker-lifecycle cases to same focused registration only if needed.
7. Keep at least one actual remote selected-record update without any hash movement after boot to prove the guard permits canonical URL changes; paired tests cannot exclusively exercise pending cases.

## Lifecycle semantics and pitfalls

- Boot listener already returns while !booted. Normal finishSavedBoot selects/canonicalizes and initializes marker. An exact incoming canonical route without write still acknowledges it through syncRoute.
- About/sheet early returns keep overlay routes untouched; no marker from #about/#add/#edit is needed. Existing app-owned pendingPop deliberately syncs after local completion; outside handler #add/#edit are ignored syntactically and retain later snapshot behavior.
- Protected pendingRecoveryShare stays intentionally unresolved with disabled LINK; no canonical acknowledgment is fabricated. Later retry/import completion uses normal deliberate syncRoute. Do not overwrite recovery payload or claim import completed.
- Unknown #deck/refused or malformed #s share protected prefixes until actual handler fallback/error canonicalization updates marker. They cannot be protected forever after handling; existing syncRoute in those branches must still execute.
- Legacy recognized share route and current canonical equality handler behavior remain distinct: only EXACT equality acknowledges with no work; otherwise existing import/dedup/canonicalization executes.
- Fresh LINK after final destination handling always matches displayed acknowledged state. In-flight old clipboard/share callbacks remain retired by existing captured-href/generation guards; no stale success replay across href change.
- Real remote deletion while a pending target refers to deleted state must resolve according to current fallback rules, not preserve nonexistent selection. Raw route preservation does not promise destination success.

## TDD and generated fault

Freeze expanded T before any S edit and run exact one group once on original source3b07; require the same literal erased-Pygmy assertion RED, with immediate control passing. Unexpected pass/setup failure stops. This RED cannot certify downstream tests; full GREEN must record all cases reached.

After independent T/RED acceptance and final source review, implement D. Run full SV-ROUTE-1 and required existing route/LINK/lifecycle tests GREEN. P generates `tests/mutants/saved_snapshot_overwrites_pending_hash.patch` from committed candidate, strips index lines, exact SV-ROUTE-1 #kills/#suite metadata. Removing snapshot guard must recreate intended pending-Pygmy assertion RED. Restore exact source and require full group GREEN.

Additionally independently review the test's ability to detect missing equality acknowledgment and overbroad all-mismatch guard via private one-variable source faults against the SAME registration; intended failures must be the second peer-update route/LINK and ignored-fragment peer-publication route/LINK assertions respectively, not earlier setup. Decide committed fault additions under existing CONTRACT after observed proof, not by manufacturing unrelated kills.

## Native, CI, stop and recovery gates

Root alone runs ORIGINAL Back/Forward native case body unchanged under one predeclared90s supervised command. Preserve firstPygmy, Back/Forward literal checks and existing deadlines; no preference drain/sleep/retry. A pass is regression evidence, not proof of original CI interleaving. Any expanded controlled native scheduling experiment needs separate reviewed script/arm declaration and honest task-source limits.

Full exact-head Linux CI, all mutation shards, app/harness/native floor counts and panel/data/Python checks must pass before DEV; no retry-green waiver. Current CI40387134731 remains FAILED, historical2ff success separate. Performance gate remains HELD regardless of route results; no measurements here.

Stop on source drift, unexpected baseline outcome, absent actual model publication, healed URL, failed ignored-handler no-action assertion, stale second-update canonicalization, lost recovery/overlay semantics, unrelated source scope or owned cleanup failure. Restore only owned source/fault bytes; preserve concurrent changes, initial error and raw artifacts. No main, CLAUDE, global/setup or app feature scope expansion.

NEXT: independent ENG/design re-review this A2 and exact pre-source boundary coverage. Only after BOTH CLEAR does root activate expanded T; source remains frozen until accepted test freeze/RED. Ledger must link plan/worktree/test/source refs and unresolved native/performance qualifications.


## Independent review and coordinator activation — 2026-10-26

A2 sourceartifact SHAe50b2bba70eee5c5d3ad76da87ecc215c2be6747933ab633159ff41c9c687ea7
independentlyENG/DESIGNCLEAR. A1 was NOTclear: all-mismatch couldstrand ignored
fragments and equalityearlyreturn couldleave staleack acrosssuccessivepeerupdates.
A2 prefixguardpluszero-writeequalityack andspecificboundarytests closebothfindings.
Rootactivates ONLY expanded T in/private/tmp/handpan-saved-variants.HVUKbE/hash-tests,
branchcodex/variants-hash-tests-20261026/base0d36. CurrentT50dc firstmodeledRED
accepted; expand/freeze prescribedcases, repeatintendedoriginalsourceRED once,
independenttest/REDacceptance before source S. App3b07/helper3369/probebd6 remain
frozen; no source edit ornative/performanceexperiment is activated here.

Rootownsledger/integration/browserlease; Tonlyapp.test.js andits floor940.
Helpers throughDEV delivered3542d6ea/source7fe afterFULLCI4ea andactualservedproof;
prior to finalvariantsdelivery, integrate thoseapprovedchanges underreview and
observe actualcombinedfloors ratherthan overwriting counts. No newCLAUDE change
is included in this route repair. Main stillneeds explicitownerconsent.


## Executed unit repair and review closure — 2026-10-26

ExpandedT e77/floor940 executed original3b07 once, intendedpriorACKpendingPygmy
preservationASSERTIONRED; onlyimmediatecontrolcompleted. Initialfour-touchpoint
candidate24bd passed16cases, but independentENG caught an unplannedNULLexemption.
T added17thnaturalcoldfailedincoming-importcase using existingSV12U5one-shotputfault
on healthyexistingAcollection: durableboot/Avisible/rawBretained/LINKdisabled/no
IDBmutation/nohistorywrite, then newerrawPygmy and actualmodeledpeerCpublication.
No directmarkerread/injection, fabricatedsnapshot ornewerrecoveryuseraction.
Candidate24bd failedthat17thliteralpreservationassertion afterfirst16completed.

RootremovedONLYtheunplannednonnullpredicate, matchingreviewedA2truth table.
Finalsource0322e5aad00df5559de43b1d934f514eaf30cbdbd1c7edebe75efe335311e6c6
andT224aa14dc7df5f3ff1bce70dc72f16a17d9e638df1a1082ce99d8a7ef3cc0f76
passALL17orderedcases/finalmanifest,1registration/0skip/cancel/emptystderr1.421s.
IndependentENG audited17thnaturalfixture, initiallateRED andall17GREEN/sourceexact
fourtouchpoints andclearedcommit/integration. PreviousfailedCI/modelproofsremain
immutable; MODELED scheduling is notoriginalnativeCIcausalityproof.

Rootnextcommitsvalidatedsource/tests/plan, integratesalreadyapprovedHelpers4ea
(featurebranch, notdevitself/main), resolvesonlyownedconflictswhilepreserving
bothfeaturecontracts and actualadditivefloors. GenerateFOURfocusedsourcefaults
fromcommittedcombinedcandidate: dropguard(originalACKRED), dropmatching-routeack
(successivepeerupdateRED), broadenprefixguard(ignoredfragmentlateRED), re-addNULL
exemption(coldfailed-import17thRED). All exactheaderclean/fault/restored withnamed
assertions; no alternate/setup killcredit. ThenunchangednativeBack/Forward and
focusedlifecycle/LINK/snapshot regressions, fullactualcounts andexactheadCI.
Performance proposal/remediation staysseparate; no timinggatewaiver or mainmerge.

Rawprivate HV/evidence: hash-intent-unit-red-a1.*, hash-intent-unit-green-a0.stdout.tap,
hash-intent-null-red-a0.*, hash-intent-unit-green-a1.{json,stdout.tap,stderr.log}.
Source/testSlanes remainseparate; rootintegration issolecombinedsourcewriter.
