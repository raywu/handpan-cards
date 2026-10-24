# Naturalness: UI wording with unchanged scale input

Status: independently reviewed mechanics/contract stage implemented; delegated draft terminology recorded before author dispatch.
Original evidence: `~/Projects/i18n-kit/naturalness/{plan.md,plan.eng-review.md,prompt.md,research.md,corpus/}`.
Those files remain read-only evidence, not execution instructions. Old 6/10
engineering clearance and self-assessed language scores do not clear this plan.

## Objective and fixed boundaries

Improve seven non-English UI tables using natural, friendly and respectful
language. German uses capitalized Du with grammatically appropriate inflections;
other languages use natural local address/capitalization. Include all seven
already-translated ordering/renumbering messages. English UI wording is unchanged.
No added/deleted keys, parser/engine changes, input notation changes, user-data
rewrites, CSS/fonts/layout changes or relaxed fit budgets. English A–G note names,
`#`/`b`, octaves, brackets and zone syntax remain unchanged in input and examples.
Do not substitute German H or solfège for accepted note syntax.

Parallel Mac diagnosis and runbook work follows
[the browser portability plan](2026-10-24-browser-portability.md). Naturalness
authors may work concurrently, but every host browser/probe/mutation browser job
uses the integrator's single lease. Use the shared `docs/testing/browser.md`
when delivered; until then follow inspected existing tools/contracts. Mac full
suite remains unresolved, Linux full CI remains required; no silent substitution.

## Verified baseline and corrections

Canonical/app baseline is `1510ea369573078e6296fe873edb6f538c3212a3`. Runbook
PR563 and contract prerequisite PR565 subsequently merged into accepted dev
`dba61154730558930c8d0660c138fe210edfb6a4`; canonical/app/engine bytes are identical
to that baseline. Both reviewed heads passed all12fullCIjobs; served app, runbook,
AGENTS, plan and fixture bytes match merged source, with noindex. The integrator
candidate and Japanese author start at dba61154; earlier canonical-only authors
start5e1bd9e4 with identical language inputs. Main last verified
`3caf5e28fa4f965d81d90a4f80d53b15f82f39fc`. Recheck before integration/release.
Owner will release HTC#559 themselves; this is not agent main consent. i18n C
and SO-D remain held main releases. Never PR all of dev to main incidentally.

Dev has250 top-level keys,257 scalar leaves for en/de/fr/it/es and250 for
ja/zh-Hant/zh-Hans. Seven plural objects have named forms, not positional pairs.
`tools/sync_i18n.py` checks top-level keys, not the full structural contract.
Before Stage1, the app I18N test unioned plural placeholders and missed per-form
losses. The delivered prerequisite now checks named forms and multiplicity.
DE `compose.DOUBLE_B` existing baseline uses `{L}` twice versus English three times;
preserve the accepted locale baseline instead of assuming English multiplicity.

Do not apply old research rewrites verbatim. `sheet.ring_reset` is a plural status
with `{ring}`/`{n}`, not the reset CTA (`sheet.reset_layout`). Proposed bare
participles can lose count/context. `sheet.put_down_kept` must preserve `{name}`
and completed selection semantics. `reason.NO_DING.below` means typed before the
ding, not lower pitch. The actual small-label key is `reason.SMALL_LABELS`.
Chinese ring nouns require coordinated consumers to avoid doubled 圈; preserve
pitch/note/playable-field/zone distinctions. `音阶` versus `调式` is a meaning
question, not script conversion. Preserve current meaning absent better evidence.
Corpus paraphrases are not verbatim primary quotations or native certification.

## Owner decisions and execution holds

Settled: Du; natural respectful tone elsewhere; include seven ordering messages;
UI-only boundary; no main merge; parallel Mac/runbook work now authorized.
Owner explicitly answered OD1 **das Ding** and OD2 **community terms where
appropriate, native short labels**, and reaffirmed already-settled capitalized
**Du**. These match the earlier documented delegated drafting defaults; no
translation change is needed for this confirmation. Do not re-interview Du.
No main-release consent is inferred. Unresolved meaning questions remain blocked
individually unless a separately documented delegated decision resolves them.
OD4 follows global tone; it does not mandate a Chinese pronoun in every sentence.
OD5 gets concrete semantic evidence/spot-check if unresolved; do not reask broad
settled tone questions. Any unresolved meaning-critical item blocks that wording.

`NAT-FREESTYLE-MEANING`: independent review found that the existing English
"top note" had been interpreted inconsistently across locales. Integrator asked
one concrete optional owner clarification and, under the same explicit autonomy
delegation, adopted the recommendation for reversible drafting: **foreground a
different high chord tone/upper voice each time**, rather than selecting a note
by physical top-shell location. This is a delegated product-copy interpretation,
not an asserted dictionary fact or fabricated interview answer. The pending
owner question remains an override path. All seven translations must express
this chosen musical meaning consistently; English wording, parser and behavior
remain unchanged. This resolves the former unknown-meaning drafting hold;
independent re-review of the actual revised wording is still required.

Pre-existing coverage gap, verified in `activateNote` near `index.html:12055`:
selecting a lone non-bottom field emits a hardcoded English singleton sentence
despite existing `sheet.only_note`. JSON authors must not change that binding.
Track its trigger/key/location as a separate reviewed i18n follow-up; this pass
does not claim to close every pre-existing untranslated runtime path. It remains
relevant to the held i18n release audit, not an excuse to broaden source ownership.

## Swarm and file ownership

Root owns plan/coordination, integration, generated `index.html`, contract tests,
fixtures and mutants. Four source-only author lanes own respectively
`data/i18n/de.json`; `fr.json,it.json,es.json`; `ja.json`;
`zh-Hant.json,zh-Hans.json`. Separate new worktrees, no shared edits. Grouped
Romance or Chinese scheduling is not evidence of native-language competence.
Root plus at most3 agents; stage the fourth author and reviewers as slots free,
accounting for Mac/runbook lanes. Authors supply per-key review/change ledgers
outside their source ownership; integrator preserves durable summaries.

Fresh independent reviewers assess each locale against current English meaning,
actual UI consumers and corpus evidence, not merely author back-translation.
Root alone syncs aggregate generated tables and refreshes affected mutants.
Unsynced JSON-only author branches are internal contributions: no independent
dev merge or claimed full-CI readiness. Preserve original dirty/locked worktrees,
root untracked handoffs and existing work; do not pull/switch/reset root.

## Stage 0 — independent plan review

Obtain independent engineering/test and language/design reviews of this exact
draft, address every material finding and re-review changes. Read substantive
Claude review contracts as evidence; do not claim unsupported native skill
execution. Near-10 requires observable completeness and no unresolved material
findings, not a self-score. Policy holds above remain explicit even if mechanics
are cleared. No translation dispatch before this gate.

## Stage 1 — contract first, before translations

Pin baseline and capture source hashes outside intended I18N changes. Demonstrate
existing plural-union false-green using an isolated deliberate per-form placeholder
loss; retain baseline/fault receipts. Strengthen the existing test titled
`I18N: every table has the keys of en and keeps every placeholder` where practical,
or narrowly add necessary behavior groups. Require exact key/type parity, locale
plural-form keys by name with `other`, per-form identifier sets matched to named
English forms (fallback other only for valid locale forms), and exact leading/
trailing whitespace substrings against pinned dev1510 locale values (all currently
match English edges). Preserve baseline locale multiplicity: English
counts plus the explicit existing DE DOUBLE_B L=2 exception; any further deliberate
change needs semantic review. Never infer exceptions from the candidate itself.

Proposed small provenance-bearing fixture `tests/fixtures/i18n_contract_v1.json`
holds frozen locale plural forms and the single accepted multiplicity exception,
not complete translation snapshots. Test fixture against pinned baseline and
validate the deliberate exception independently. Use actual live-table assertions
and isolated fault cases; no mirrored assertions or tests of a duplicated parser.
Check missing/extra form, placeholder lost in only one form, repeated-token loss,
wrong scalar/object type and exact edge-whitespace loss. Cover meaningful distinct
groups with actual killing mutants under `tests/CONTRACT.md`. Baseline must be
green and faults fail assertions, not syntax/timeouts/skips. Keep exact-one named
selectors in mutant headers. Raise only owned floors to observed counts.

## Stage 2 — author and review language changes

Freeze lexicon and selected review sample before edits. Read all existing250keys
per locale, review changed and retained keys with rationale; rewrite only justified
UI language. Preserve every form, interpolation, edge whitespace, punctuation
required for concatenation and canonical notation example. French interior
NBSP/NNBSP is a locale convention, distinct from fixed edge-space preservation.
Seven included ordering keys: seat_renumber, seat_is_now, list_and, mirror_reflow,
order_hint, rim_follows, inner_follows under `sheet.`.

Frozen40-key sample (all forms,47 Latin-script leaves/40 CJK leaves):

```
sheet.generated
sheet.ring_reset
sheet.bottom_now_has
sheet.bottom_now_has_angles
compose.INNER_BELOW_TOP
sheet.inner_below
sheet.bottom_now_has_both
sheet.seat_renumber
sheet.seat_is_now
sheet.list_and
sheet.mirror_reflow
sheet.order_hint
sheet.rim_follows
sheet.inner_follows
sheet.ring_rim
sheet.ring_inner
sheet.ring_bottom
sheet.zone_top
sheet.zone_inner
sheet.zone_bottom
sheet.generate
sheet.generating
sheet.save
sheet.saving
sheet.reset_layout
sheet.pick_note
sheet.put_down_kept
compose.TYPE_NOTES_ONLY
compose.SOLFEGE
compose.DOUBLE_B
compose.OCTAVES_GUESSED
compose.DUPLICATE_NOTE.top
reason.NO_DING.two
reason.NO_DING.below
reason.SMALL_LABELS
panel.reset_warning
panel.resources
card.hint_notes
footer.shuffle_on
boot.gone
```

Independent A–E rubric, each1–5: A semantic completeness/action/state; B natural
local tone; C consistent domain terminology; D concise readable UI phrasing;
E grammar/typography/context. Report actual per-entry/form evidence, each dimension
mean>=4, no meaning-critical item below4, no unresolved material finding, zero
structural defects. Untouched entries do not get automatic5. This supports but
does not establish native-human certification. Present actual DE/ZH strings and
UI context for owner spotchecks where evidence remains uncertain; record outcomes.

## Stage 3 — aggregate, sync, mutant regeneration

Root integrates independently reviewed canonical contributions into an isolated
candidate based on accepted dev. Run sync, inspect generated drift, prove English
table unchanged and no app bytes outside generated I18N changed. Commit canonical
source/index before generation: `regen_data_mutants.py` needs clean source.
Regenerate on a separate clean committed scratch checkout after inspecting tool
effects. Root owns all generated files; no concurrent editor/mutation sweep.
Refresh only genuinely affected patches; regenerate `i18n_swap_two_keys` from the
new actual I18N line with intended two English values swapped. Use real Git diff
and remove `index` blob headers, never hand-write assumed hunk locations. Preserve
unaffected sync-tool mutant `i18n_render_leaves_closing_tag`; mechanical refresh
of affected `i18n_region_inside_wrapper` needs inspected actual patch results.
Clean-green and deliberate assertion-red receipts for changed mutants; invalid
selectors, stale patches, timeouts and skips are failures, not kills.

## Stage 4 — candidate validation and delivery

Use existing sync --check/validate, Python, appropriate Node/I18N tests, suite
health, actual changed mutants and full exact-head Linux CI. `node --test tests/`
is invalid; use existing runner/explicit files. Host Mac full-suite issue remains
visible; no timeout increases or full-suite pass claim based on targeted checks.
Browser checks include locale switching/persistence, representative translated
statuses/errors/plurals/keyboard paths, and English-convention note input across
all8locales with identical parsed/serialized behavior. Prefer existing tests where
coverage is adequate; any new gap test follows Stage1 TDD/mutant contract.

Both-font panel-fit for all7changed languages against accepted dev, preserving
exact executable budget equations/SITE_DROP/positive-scroll checks, target sizes,
geometry and helper tolerances. Shorten accurate translations on overflow; never
change CSS/fonts/budgets. Working-tree probe omits --candidate; committed candidate
uses exactSHA. --lang selects candidate only, English base stays English; report
that comparison honestly. Any desired same-language before/after comparison needs
an explicit separately reviewed method, not a false claim about this CLI.

Main-target HELD companion PR supplies full `validate`; same-head devPR supplies
integration only. Fresh independent exact-head review, all material findings
addressed, full CI green and final diff inspection precede dev merge. Actual served
DEV app identity must match merged commit, then repeat affected multilingual UI/
input/fit acceptance on served bytes. Preserve raw evidence and limits. Changed
head invalidates old CI/review gates. No agent main merge; held upstream releases
and root path collisions require deliberate integration, never discard documents.

## Failure/recovery and completion

If a language is uncertain, retain known-safe wording and escalate the specific
meaning question; don't invent quality. Missing tool/access becomes a blocker,
not install authorization. Browser contention waits for lease; missing browser,
skips/cancellations, empty selection and stale deployment are incomplete coverage.
Failed contract or fit halts delivery. Isolated contributions may be revised or
abandoned without resetting shared trees. A dev rollback is a scoped reviewed
dev-revert PR under the existing model, no shared-history reset or production
action. Preserve Claude compatibility and English grammar documentation.

Completion evidence: exact source/dev refs, per-locale key ledgers and independent
reviews, owner/delegated decision provenance, frozen sample scores, structural
red/green/mutants, unchanged English/engine/decks/app-outside-I18N hashes, both-font
fit, full CI, actual DEV receipts and unresolved limitations. Update continuity
and shared runbook links without duplicating operational instructions.

## Review ledger

Independent engineering and language/design reviewer
`naturalness_corrected_plan_review` cleared draft v1 at9.5/10, no material findings;
all40keys and sample leaf counts verified. Nonblocking provenance/edge-oracle
clarifications folded in. Mechanics/guard execution is cleared; translation
dispatch was initially held on OD1/OD2 provenance; the explicit delegated choices
above now resolve that drafting gate without fabricating interview answers.
Contract prerequisite source review9.5 at5e1bd9e4;853app/21I18N pass,17faults
assertion-red and5actualmutants proven. FullCI40129424063 passed all12jobs,
including475e2e with0fail/skip/cancel; mergeddev via565. Runbook source review9.5,
fullCI40129764065 all12pass,473e2e with0fail/skip/cancel; mergeddev via563.
MainPR562 ready/HELD; CI-only564 remains draft and MUST NOT MERGE MAIN.
Source-language review is completed below; runtime, final-head CI and delivery
gates for the assembled wording candidate remain pending.

### Source-language review closure

All seven source tables now have independent all-key/context review and frozen
sample assessment. Cleared source heads: DE `d5359d07a914a9a411f4bab320f627a2034609c6`;
FR/IT/ES `e152f3f1be91fd29a9fed0fce62b603d570d9676`;
JA `c780a9926684951e693704f11cd350b9f4cc9def`;
Hant/Hans `e5b006b9c32222a0c6932036ceea4a732b275bc2`.
Every locale's sample dimensions mean>=4, no unresolved material language issue.
These model reviews do not establish native-human certification or runtime fit.
DE/JA composed renumbering grammar, Spanish screen-vs-playing verbs and a stale
reset-action reference were caught and corrected; exact-head re-review cleared.
Review fragments in actual one/two/three-plus compositions, and referenced control
labels against displayed labels. Never apply a screen-action verb replacement
across music instructions or globally capitalize text inside placeholders.

Integrator assembled only those canonical commits and synced once. Combined
I18N21/21pass,0fail/skip/cancel; all250keys remain. English+decks+12engine files
and app bytes outside generated I18N are identical to accepteddevdba61154.
Changed top-level key counts: DE129,FR51,IT92,ES100,JA95,Hant91,Hans103 (661total).
Source-only approval does not clear mutation regeneration, browser48-cell input/
locale acceptance, seven-language both-font full fit, final review, CI or dev gates.
The temporary acceptance harness and any execution supervisor must be independently
source-reviewed before browser execution. Explicit foreground activation is a
documented active-target precondition, never a claim that the full Mac suite is fixed.
