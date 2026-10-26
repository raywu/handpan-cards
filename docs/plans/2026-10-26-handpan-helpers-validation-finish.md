# Helpers validation finish — draft amendment for ENG/design review

## Evidence and unchanged scope

Owner approved Helpers throughDEV and the exact Resources CLAUDE packet. Current
candidate2f4db8af, app0bfc, helper66f7. No main merge, global/setup/locale/engine/
app-script or functionalCSS changes. Placement remains Helpers beside101, About
alone, fullnames/fonts/budgets/44px targets preserved. This amendment addresses
observed failures before continuing delivery; do not weaken existing fit oracles.

CI40370694973:882app/38harness/Python/data/bothpanel probes/all1513faults pass;
482native run480pass/two failures: TR1real fontregistry and I18Nline parity.
Plain local3test replay reproduces both failures (raw helpers-ci-browser-triage-a0).
All8fullpanel probes and1344same-localepairs pass; those do not replace I18N's
additional line-count contract. Publicoutbounda2 independently proves one new
HTTPS Helpers tab, known siteidentity, openernull and unchanged practice state.

Font observational copy (no extra pageRPCs/fontloads) reproduces TR1failure:
same document/timeOrigin/FontFaceSet/stylesheetobjects across HHR, but current
FontFace objects differ from initially loaded ones; Bitter700 is nowunloaded
while the four used faces areloaded. Oldbeforehook's retained700face remains
loaded. This demonstrates stale once-only readiness, not document navigation;
why objects are recreated is not established. Do not claim a productionfontbug.

I18NbaselineDEV5628 run separately has one pre-existing MacJapanese Handpaner
linecount failure. Candidate adds two: Helpers at844x390 and101at1280x800.
Rawpairedrects confirm actual oneEnglishline/twoJapanese lines, bothfullyvisible
within unchanged44px boxes. SourceCJK fallbackstacks differ; Englishpropername
language tagging alone cannot defeat ancestor :lang(ja) .mode rules. Preserve
those stacks and the existing global I18N assertions. Do not fix unrelated
Handpaner/Mac debt inside this addition; fullLinuxI18N must pass with no waiver.

## Minimal proposed changes

1. Make both third-row names consistently two-line in all locales:
   Helpers anchor content <span>HANDPAN <br>HELPERS</span>;
   101 anchor content <span>HANDPAN <br>101</span>.
   Keep the literal space beforebr so textContent and normalized accessible names
   retain HANDPAN HELPERS/HANDPAN 101 words exactly. Existing101aria label remains
   localized as before. No newCSS/font reduction/abbreviation/row/translationkey.
   Existing10.5px/1.25 leading pluspadding fits two lines below44px minheight;
   prove actual unchanged boxheight/positions, do not infer from arithmetic.
   Otherfiveexistinganchorblocks retain bytes;101destination/attrs/textsemantic
   preserved with intentionally changed internal wrappingmarkup. The exact approved
   CLAUDE packet remains unchanged and accurate; no further CLAUDE edit proposed.
2. Unitfullname assertion should compare literal semantic text independent of
   presentational span/br; keep exact href/native semantics/order oracles.
   NativeHHRgroups require both labels exactlytwo rendered lines at every named
   state, plus existingcomplete/text/44px/equalwidth/clip/focus/state checks.
   Compare normalized innerText as well as textContent so hidden words cannot pass.
3. Prepare the CURRENT realfont registry deterministically before each independent
   Resources geometry workflow and each measuredstate followingmode/viewportchanges,
   then retain the SAME strict checkFontMode. Reuse existing exported
   panel_fit.MEASURE_SRC via page expression `(${pf.MEASURE_SRC}).fonts()` in an ephemeral local closure, which already waits
   document.fonts.ready and loads the five existinglocalfontspecs; avoid duplicating
   specs or changing the oracle/tool. Fallback snapshots must not requestfontloads.
   Keep original realfontbeforehook's explicit preparation/check intact. No
   fontstatus faking, check bypass, retry or timeout increase. Loadingfailure or
   missingfaces remains failure. This tests currentfaces rather than oldobjects.

## Swarm ownership and sequence

Root owns plan/ledger/integration, exactCLAUDE boundary, one hostbrowserlease,
immutablepins/fullCI/servedDEV and recovery. S in a new isolatedlabelworktree owns
only indexmarkup2names. T in a separate testworktree owns app/e2e semanticname,
rendered2line oracles and shared realfontpreparation. M in separate committed
candidate scratch owns generatedpatches. IndependentENG/design authorednoneofthese.
No parallel hostbrowser work, no edit of saved-variants lanes.

Reviewedamendment -> freezeTtwo-line native acceptanceRED oncurrent0bfc +retained
fontsequenceRED -> S minimalmarkup +Tdeterministicfontprep -> sameoraclesGREEN.
Preserve previousCI/rawfailures and exactbaselineMaconedeft. Nativepreconditions
mustnot substitute forappfunctionality. Root serializes browser jobs with existing
bounds; no fullMac suite.

## Proof and delivery gates

Generate one label-break removal fault targeting HHRrendered-linecontract, and a
scoped test-preparation fault that bypasses only NEWrealfontloading while retaining
strict registryvalidation (existingbeforehook stillloads). Fault must reach the
intendedline/fontguard, not syntax/navigation/startup. Preserveall1513existing
faultidentities, updateonlystalecontext/necessarydeclaredtestmetadata. No new
registrations expected; existingfloors882/482 remain, verify actualcounts.

Rerun affectedunit/nativefontsequence/I18N tests, remainingMacbad[] must equal the
unchangedbaselineHandpaner result only; no silent exemption orweakenedassertion.
Full app882, allsame-localepairs+actualCSSOMedges and all8existingfullpanel probes
need source-bound refresh aftermarkupchange. Reprove changed/newmutants and
metadata/allapply; independentfinalreview, full exact-headLinuxvalidate ALLgreen,
then actualservedDEVbytes/journeys/ownerQA. Main staysheld. Earlierpairedperformance
is historical until rebound. No physicalSafari/CJKspeech proof inferred.

Stop/replan if two-line markup grows targets/panel or breaks semantic names,
fonts cannotload, additional I18N failures appear, causalobservations contradict
setupfix, or anyqualitygatefails. Rollback only owned unmergedchanges preserving
failed evidence; neverreset otherworktrees or erase saved data. Report immutable
plan/branch/worktree/last-next checkpoint in sharedledger/existingthread.


## Evidence-based text-line oracle amendment — awaiting independent review

First combined candidate7fe/test51f native run6executed/5pass: HHR fallback/real,
TR1real, inventory and activation pass. I18N reports12 new Chinese label counts
plus unchanged Japanese Handpaner debt. Root's independently ENG-cleared private
rect diagnostic7941c2 captured12 fixed observations (EN/Hans/Hant ×320/844,
unscrolled/centered) in3fresh ownedprofiles, with allcleanup true. Every Helpers/
101 label has exactly TWO actual text rows and two text-only quantized bins.
Chinese unscrolled320 all-contents Range adds a blockSPAN rectangle at506.375
(bin127) beside texttops505.375(bin126),518.5(bin130): a phantom third line.
Centering changes bin coincidence without changing actual text rows. Source7fe
is not physically three-line at these cells. This is limited fallback evidence,
not the full locale/font/matrix or device claim. Full raw receipt is
/private/tmp/handpan-helpers.HUZs5u/evidence/helpers-label-rect-diagnostic-a0.report.json;
SHC/helpers-label-rect-diagnostic-a0 supervisor4.97s/cleanuptrue. Independent ENG
recomputed all12 raw text/container bin sets and cleared this diagnosis.

Proposed minimal correction (do not implement until ENG/design CLEAR):

- T owns only tests/e2e.test.js and its own suite_health e2e floor482→483 in the
  isolated label-tests worktree. Factor one focused browser-side text-line reader
  used by I18N.measure and a new native oracle-fixture registration. It traverses
  actual nonempty TEXT nodes with TreeWalker, selects each node's contents, and
  counts rect tops using the existing width>0 filter and Math.round(top/4).
  Remove only container/SPAN/BR rectangles from the line count. No element/lang
  exceptions, tolerance, text filtering to firstN lines, hidden-word allowance,
  font/UI/CSS/viewport/sample or baseline-budget change. All existing global
  geometry, line parity, overflow, stack, sheet/About and language checks stay.
- New spec-first native registration uses actual rendered independent fixtures
  with literal expected one/two/three text lines, including nested wrappers and
  explicitBR. Give the wrapper witness explicit12px top padding and24px text
  lineheight at16px font so its container top is separated from its two glyph
  rows; these are independent test-fixture values, not app geometry changes.
  It must demonstrate intended RED against the old all-contents reader on that
  controlled wrapper case before changing the reader; if that case does not
  yield the intended RED, stop and redesign a deterministic fixture.
  Do not manufacture font/platform assumptions or claim a setup failure as RED.
  Retain a real three-line witness that fails if the reader ignores/caps lines.
- M owns generated faults in a separate committed candidate scratch: a real
  third-line label fault proving the existing HHR2-line assertion, and a targeted
  reader-blinding fault capped at2 proving the new independent three-line witness.
  Header selects literal group; intended assertion kills and restoration required.
  Preserve all1513 original fault IDs; review necessary context refreshes only.
- Root runs native fixture RED→GREEN→fault→restored under existing bounded sole
  lease, the affected HHR/TR1 journey and full I18N (remaining Mac bad[] must be
  only the separately documented baseline Handpaner). A full I18N Mac failure is
  still FAILED, never waived or recounted as green. Exact-head Linux full I18N
  must pass without exemptions. Existing literal-title mutation commands retain
  their selection; verify actual e2e floor483 after the single new registration.
- S has no additional app markup change:7fe remains frozen while the oracle is
  repaired. Independent ENG/design review this amendment and independent final
  reviewers audit precise test/source/fault pins and raw receipts. Original failed
  candidate results remain failed; all previous old0bfc fit results remain
  historical until the previously required source7fe full refresh.

Stop if actual text rows exceed2, the new reader misses a genuine third line,
nonempty text is hidden/clipped, registration counts change unexpectedly, any
existing budget/assertion is weakened, or new unrelated I18N failures remain.
This is a measured-oracle correction within approved Helpers validation scope;
no additional CLAUDE, app, font or global change is proposed.


Coordinator activation2026-10-26: final text-oracle amendment5595dee independently
ENG/design CLEAR before implementation. Root activates T's test-only stage1 in
label-tests: shared OLD all-contents reader plus independent rendered1/2/3line
registration/floor483, no reader correction yet. Root accepts intended wrapper
phantom-countRED before T changes onlyreader to actualtextnode ranges. App7fe
stays frozen. Separate generatedactualthirdline/cap2faults, finalreviews and all
previousrefresh/CI/DEV gates remain mandatory. No new CLAUDE or main approval.


## Executed text-reader TDD checkpoint — 2026-10-26

Root accepted the frozen old-reader93c70 native fixture RED: ONE/TWO/genuineTHREE
passed, nested padded two-row wrapper failed3vs2 with named ERR_ASSERTION.
SHC/helpers-text-oracle-red-a0:1test/1fail,0skip/cancel, cleanuptrue2.396s.
Only after acceptance T changed the shared reader to nonempty TEXT-node ranges;
final e2e869e5c1b retains original width>0/Math.round(top/4), all old I18N oracles,
and exact same independent fixture. App7fe remains unchanged; e2e floor483.

Combined SHC/helpers-text-oracle-green-a0 executed5tests:4PASS (new native oracle,
HHR fallback/real andTR1real); fullI18N FAILED only for the separately reproduced
baseline `ja844x390 res-handpaner takes2lines againstEnglish1`. The12new Chinese
phantom counts are gone without a language/control exemption. This is NOT a
passing fullI18N or fullMac claim. Ownedcleanuptrue10.088s,0skip/cancel.

Next generate actualthird-line and cap-at2 oracle faults from this committed
candidate in a separate M scratch, preserve/reconcile all1513oldfaults, prove
changed/new exactheaders, refresh882unit/fullpairedlocale+8fitprobes, independently
review finalbytes, full exactheadLinuxCI, then servedDEV. No new app/CLAUDE/global
changes authorized by this checkpoint. Saved variants keeps priority.


Pre-proof assertion-order correction: independentENG cleared moving unchanged
peerfont/family/weight/tracking/leading checks before the newly added physical2line
assertion, after semantic/visible-name prerequisites. This keeps the existing1px
font fault reaching its original typography assertion. All geometry/line/target
conditions remain, app7fe/floor483 unchanged. FinalT6d89f4 replaces869 only by
this reordering; raw869 RED/GREEN remain historical, not erased. Freeze/rebind
mutation provenance before proofs; require intendedfont andphysical-line kills.

Fullapp882/882 passed. FullEnglish panelbothfont refresh PASS (SHC/helpers-panel-en-a1,
55.273s cleanuptrue). PairedA2 stopped after420passing pairs/5groups due to owned
profile cleanup verification; no geometry failure and outercleanuptrue. Result
remainsFAILED. Root reviews a narrow post-exit ownedprofile cleanup correction
before fresh complete1344pair run; no partial pairs reused. Sevenremaining locale
full-domain probes are running serially under their existing180s bounds.


## Final local validation receipt — 2026-10-26

Currentapp7fe75f54 and T6d89f4e preserve approvedplacement, names,44px targets and
allapplication scripts/deckdata. IndependentENG accepted finalcode andall8generated
patches:6necessaryoldcontextrefreshes+2newfaults,1513oldIDs retained/1515totalapply.
Fullapp882/882 andmutationmetadata54/54 pass; floors882app/483native/38harness.
Rootliteralheader proofs24/24:8cleanGREEN/intendednamedERR_ASSERTIONRED/restoredGREEN,
0skip/cancel/todo/timeout/stderr, allownedcleanuptrue. Fontfault retains its original
peer-fontfailure, newlabel fault actualHelpers3/sibling2 rows, cap2fault genuine
three-linefixture incorrectlyreads2. Allsourcepostimages/restorations independently
audited. HVsourcechangesarenotbundled: Helpers branch remains separatefromvariants.

ALL8freshfullpanel jobs helpers-panel-{en,de,fr,it,es,ja,zh-Hant,zh-Hans}-a1 pass;
16real/fallback reports,128304primarycells plus19866extra-invariance cells and82032
thresholdjudgements (distinctcategories),0skip/all6rules/report-only/invariance/
gutterfailures0. Independentaudit verifiedaggregateoutputs, notunemittedpercellraw.
Theseprobes compareEnglishbaseline/requestedcandidate; same-locale evidencebelow.
Allsourcebindingsbase5628/candidate7fe/tool876/helper66f correct; candidateRef80
appbytes equalcurrent15be, testorder not exercisedbyfitprobe. All32ownedprofiles
removed/emptygroups, supervisors52.7–60.9s/no timeout/empty stderr.

PairedA4 f5d02d9b passedall1344rawunique pairs:384fixed+960from20CSSOMedgecells,
16actualsame-locale/fontgroups×3modes,0skip/retry/exclusion. IndependentENG recomputed
all1344candidate+base-selfjudges fromraw andvalidatedallgeometry/stamps. Bothnames
visible/semanticallycomplete/twophysicalrows; minwidth93.5/minheight44, no clip/
spill/hitfailure. Reachabilityscroll896pairs occursAFTER unscrolledfitmeasurements.
All32ownedcleanuprecords requireactualexit/emptyPGID/profilegone/serverclosed;
no manualresidualRM occurredinA4. Supervisor92.321s/cleanuptrue. A2cleanupfailure
remainsFAILED; A3unexecuted. NarrowreviewedA4cleanupalwaysattemptsnormalclose,
allowsresidualRM onlyaftercompletecapturedpath/child/processguards; no rule/budget
change or claimofactualresidualcause. This is sampled1344paircoverage, notfull
uniformdomain orphysicalSafari/device proof.

FinalmarkupoutboundA3 (script8adf9f0d) proves nativeclick opensEXACTpublicHTTPS
Helpersdocument inONE newpage withnullopener, knownsiteidentity, unchangedpractice/
panelstate andownpopup/browser/servercleanup. Supervisor3.403s/cleanuptrue. No
third-partyfeature/functionality claim. Metadata/appchecksandrawreceipts under
/private/tmp/handpan-helpers.HUZs5u/evidence and the namedSHCsupervisors.

Remaining: finalindependentDESIGNreview, immutablecandidatecontinuity, FULLexacthead
Linuxvalidate allgreen, thenactualservedDEVrevision/journeys andownerQA. FullMac
I18N stillFAILED withonlyknownbaselineJapaneseHandpaner debt; no waive/exemption.
No mainmerge, newCLAUDE/global/auth/toolsetup orphysical-device claim.
