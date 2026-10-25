# SEO long-tail technical operations and measurement research

2026-10-25. Independent operations lane of prompt v2 SHA
`16b334034765e063764c71c60dab709a393207c9eddaef595878417e7bad6fc8`.
Repository baseline `217609075a14e6ca4799497210af27d9df842c5e`.
Research/planning only. No app, test, script, provider, authentication, analytics,
indexing, publishing or instruction changes; no browser or test execution.
Primary web documentation was inspected on this date. This note proposes work;
it does not demonstrate that any future publishing/measurement setup operates.

## Decision and evidence baseline

Recommend a small, editorially reviewed English pilot on crawlable static sibling
URLs, subject to owner choices and explicit implementation permission. This is a
provisional recommendation, not an answered interview or publication grant. Keep
SEO-LONGTAIL under the existing SEO umbrella: it shares discovery, GSC data and
site policy, but needs its own plan, owner, lane artifacts and execution gates.

| Finding | Qualification and source |
|---|---|
| App is one independently functional, committed HTML file, no build/framework/package manifest | Verified: README Development; CLAUDE Hard constraints. Static siblings need not introduce a runtime dependency or build into the app. |
| Root has self canonical, Open Graph and exactly WebApplication/WebSite JSON-LD nodes | Verified: index.html23–68 and app tests discoverability/site-name. These are app contracts, not article templates to duplicate blindly. |
| Sitemap contains root only; no lastmod | Verified: sitemap.xml; tests/test_site_files.py103–117 requires absolute trailing-slash, hash-free URLs, exact root set and absent lastmod. New article sitemap requires an owner-approved acceptance-contract change, not weakening/deleting tests. |
| DEV/preview must remain nonindexable and analytics-silent | Verified source: _headers, test_headers_file_sends_noindex_for_every_path; analyticsAllowed excludes all .pages.dev, localhost/file and webdriver. Actual current deployment checks are owned by root, not independently rerun here. |
| Nine explicit custom app events exist | Verified: index.html track call sites; CLAUDE analytics; tests/app.test.js discoverability, SU and AO. List below. Installed/available GA4 reporting auth is unverified. |
| Existing config excludes query as well as fragment | Verified: loadAnalytics index.html14382 sends only location.origin+location.pathname; its comment only mentions hash. Adding a query-before-hash marker alone does not establish usable attribution in existing data. |
| share_open is not an arrival counter | Verified: openShare index9988 suppresses when deck equals bootStored; tests/app.test.js “SU: a reload of the stored deck fires no share_open and no deck_route...” confirms source-level contract. |
| Domain property ownership already completed | Historical owner evidence recovered in SEO recovery; current GSC data/access, selected canonicals and indexing remain Unverified. Do not repeat ownership setup or assume inherited credentials. |
| Automatic event parameter sanitization | Contradicted if inferred: track simply forwards params. Existing caller contracts and tests restrict current params; this is not a universal runtime allowlist for future instrumentation. |

## URL and publishing architecture

Google generally does not support URL fragments as different indexable content.
Keep the custom #s= link as a useful app destination; give a substantive lesson
its own crawlable HTML URL. Source: [Google URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure).
Use normal descriptive a[href] links. An article's standalone value must survive
JavaScript failure and a reader choosing never to open the app. Source:
[Google crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

| Option | Benefits | Costs / failure modes | Disposition |
|---|---|---|---|
| Static sibling /learn/<verified-scale-layout>/index.html in this repo | Same site, plain HTML, committed reviewed bytes; shared DEV/release/recovery, no new CMS | Needs intentional sitemap/test updates and article styles/navigation; concurrent index touches need integrator ownership | Recommended pilot if owner approves publishing home |
| Separate content repository/site on another host/subdomain | Separates authoring/release; CMS optional | More auth, hosting, data/privacy, canonical and cross-domain maintenance; no automatic SEO benefit established | Fallback when editorial home already exists |
| External publication platform | Fast manual editorial pilot if owner uses it already | Platform export, canonical, redirects, analytics and ownership limits; outbound auto-tracking privacy risk | Compare after owner identifies actual platform |
| Hash-only pages or indexable combination explosion | Minimal route implementation | Not a reliable distinct crawlable article; duplicate intent and weak teaching | Reject |

Candidate implementation paths, not approved changes: `learn/index.html`,
`learn/<verified-layout-slug>/index.html`, `learn/assets/lesson.css`,
`content/lessons/<article-id>.json` (editorial records), `tests/test_lesson_pages.py`
and targeted link/arrival fixtures. Reuse an existing compatible helper before
adding one. Do not add all paths just to satisfy an abstraction. For two or three
pilot pages, hand-reviewed committed HTML may be cheaper than a generator; retain
structured musical records even if HTML is manual. Any generator is offline only,
versioned and inspected before execution; it must not become an app build step.

Canonical policy proposal: one HTTPS trailing-slash URL per genuinely distinct
lesson, self canonical with matching internal links/sitemap; alias spellings are
sections or links to that lesson rather than duplicate articles. Do not canonical
all lessons to the app root. Do not use noindex/robots to consolidate duplicates.
For an actual duplicate URL choose redirect or consistent canonical; host redirect
support must be validated, not assumed from a _redirects filename on GitHub Pages.
Google treats canonical signals as preferences, not an unconditional directive.
Source: [Google canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Sitemap should contain only approved published canonical URLs, not drafts,
tracking URLs or hashes. A small pilot can be maintained manually. Preserve the
root entry, hash rejection and an exact approved article set test; retain no-lastmod
unless honest content-change dates and a corresponding reviewed contract are added.
Do not stamp every deployment as fresh content. Source:
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
GitHub Pages can serve static HTML directly; this supports feasibility, not proof
of this repository's current remote settings or custom redirects. Source:
[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Optional article JSON-LD should describe the visible lesson, actual responsible
author/publisher and real dates. No fabricated reviewer, credentials, maker
endorsement, ratings or review scores. Article metadata is not a ranking/rich-result
guarantee. Sources: [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article),
[structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
Accessibility: semantic headings, linked contents for long lessons, meaningful
note diagrams plus equivalent note/field text, large keyboard-accessible CTA,
visible focus, readable phone typography, no audio autoplay or audio-only teaching.
No new runtime JS is needed for the first readable lesson. No claim of native
phone QA until performed.

## Measurement: what exists versus what is needed

Existing explicit events: deck_select, deck_route, scale_create, card_flip,
progression_view, pdf_download, share_open, share_copy, about_open. Current
params avoid custom IDs/names/hash. progression_view means a tier selection,
not a played progression; card_flip means interface action, not music learned.
Both are possible practice-intent proxies, not educational outcomes. Consent,
blocked scripts, browser settings and repeated arrivals create incomplete counts.
No current event links a particular public article to a verified exact-scale
arrival followed by practice. GSC clicks and GA4 users are different measures;
never subtract/join them as a proven person-level funnel.

GSC minimum owner export: last 90 days, Search type Web, dates, pages, queries,
countries/devices with impressions/clicks/CTR/average position; compare a prior
similar period where available. Request aggregate reports only, no account tokens.
Rare long-tail queries may be omitted even while page/chart totals include them;
a missing exact query is not proof of zero demand. Sources:
[Performance report](https://support.google.com/webmasters/answer/7576553),
[query limitations](https://support.google.com/webmasters/answer/17011259),
[data discrepancies](https://support.google.com/webmasters/answer/17010575).
GA4 minimum read-only export: landing page/path, source/medium, device/country and
existing event totals for matching date ranges; avoid user-level IDs or private
URLs. Record export filters, timezone, consent/reporting limitations and retrieval
date. No bulk BigQuery setup required for the initial pilot.

Important privacy trap: Enhanced Measurement outbound click collects link_url.
If an external article automatically measures a custom #s= CTA, it may transmit
the whole free-text share URL even though the app strips it from page_location.
Same-domain article→app links are not outbound events by default. Current stream
settings are unverified and must not be enabled casually. Before new article
analytics, inspect actual payloads for page_location, page_referrer, link_url,
click_text and enhanced/history events using approved isolated validation.
Disable or redact unsafe automatic collectors before any instrumented publication;
redacting only a custom event does not sanitize automatic events. Source:
[GA4 enhanced measurement](https://support.google.com/analytics/answer/9216061).

Proposed separately approved extension: allowlisted opaque public article ID and
placement ID only, with a privacy-reviewed article CTA event and app arrival
correlation that never includes private note strings/names/hash or persistent user
identifiers. Avoid internal UTM campaign labels; they confuse acquisition analysis.
Do not claim GA4 universally starts a new session when a campaign changes.
If instrumentation changes are deferred, publish only with explicitly accepted
limited observability: GSC article performance and aggregate app activity, no
claimed conversion rate. Queries before # remain valid URL construction but are
not a magic attribution implementation. Do not weaken existing URL redaction.

## Reviewed editorial operations proposal

Required record fields: stable article ID/status/canonical URL/intent cluster;
verified layout name, aliases and note inventory with provenance/date; engine
revision, instrument/options, generation procedure including RNG and resolved
progression/chord/voicing/style/tier records; authored explanation and limitations;
reviewer identity/approval date; diagram/media rights; exact CTA, arrival contract
and offline validation results; unique-value rationale; publish/revision dates;
monitoring owner, costs and retirement/redirect decision. Private drafts remain
outside published sitemap/HTML; publishing JSON records must not expose private
notes or undocumented copyrighted material. Duplicate pitch inventories alone do
not prove identical teaching intent; a reviewer resolves merge/split decisions.

| Stage | Responsible / accountable | Output and gate |
|---|---|---|
| Demand/layout selection | Research agent / Ray | Evidence-qualified candidate, exact variant, one query intent owner |
| Engine extraction | Engine lane / technical integrator | Pinned outputs, independent note/voicing availability oracle; refuse unsuitable layouts |
| Teaching draft | Content lane / Ray editorial owner | Unique explanation/practice steps with no fabricated experience |
| Musical review | Named human musician / Ray | Playability, difficulty labels and progression usefulness accepted; otherwise hold |
| Technical/accessibility review | Separate source reviewer / integrator | Metadata/link/arrival/privacy/phone state matrix; exact source reviewed |
| Publish | Integrator / Ray release consent | Exact-head CI, DEV bytes and journeys, owner QA where required; main consent remains explicit |
| Monitor/correct | Named maintainer / Ray | Weekly pilot log; monthly link/layout/content check, changes trigger re-review |

Pilot capacity assumption, to be replaced after first dry run: 2–3 lessons total,
2–4 hours each including drafting, human music/editing and technical QA, plus
30 minutes weekly monitoring. This is a budgeting hypothesis, not measured effort.
No paid SEO subscription, CMS or API needed to establish an initial manual pilot.
If no musical reviewer/time budget is available, stop publication and retain
research records; do not replace review with an agent's score. Audio/images only
with rights and accurate attribution; their absence need not block a clear
text/diagram lesson. No maker affiliation implied by descriptive instrument names.

## Pilot decisions, failures and recovery

Entry: chosen publisher, explicit scope/main consent process, exact verified
layouts, musical reviewer, article unique-value review, approved data/privacy
approach, current baseline and preservation tests. First publish a useful lesson;
second/third only if independently distinct. Do not promise pages for every scale.

Observation proposal: weekly operational checks; strategy review after 8–12 weeks
of confirmed indexability/indexing, capped at 12 weeks from launch for a diagnostic
decision. This is an operational hypothesis, not Google's indexing SLA. If not
indexed, investigate crawl/selected canonical/noindex/discovery before declaring
content demand failed. If sparse, report inconclusive evidence and budget a hold
or deliberate owner extension, not automatic page production. Compare actual
page/query trends and counts; report denominators and absolute small numbers,
never a dramatic percentage without sample context.

Expand only after useful reader feedback or credible qualified search traffic,
validated arrival behavior, editorial capacity and no material quality/privacy
regressions; numeric business thresholds require owner input and first baseline.
Pause on wrong notes/layouts, misleading difficulty, unsafe payload, repeated
thin/duplicate articles, unaffordable reviews or unmaintained links. Low rankings
alone do not justify rewording thousands of generated variants.

Recovery: revert offending article/content change through reviewed branch/DEV
path without reverting unrelated application work. Remove drafts from published
links/sitemap; choose corrected page, relevant redirect or real removal according
to the error, not redirect everything to the app root. GitHub Pages custom 301/410
support remains unverified; a meta refresh is not assumed equivalent. Exposed
analytics data cannot be fixed by a code rollback: disable unsafe collection,
notify owner and use provider-supported remediation under explicit authority.
Engine revisions flag affected lesson records for revalidation; preserve last
reviewed records instead of silently regenerating all published advice. Each
checkpoint must name immutable source, plan, owner/worktree, exact stopping point,
next step and approvals in the shared DEV ledger via the integrator.

## Required validations before implementation is called ready

- TDD around approved article set/canonical consistency, actual html-visible
  musical facts, copied CTA round trip and bad checksum/name/count mismatches.
- Negative privacy tests across manual events, enhanced clicks/history, storage
  failure, repeat arrival, denied consent, DEV/automation and referrer parameters.
- Standalone app still runs from disk; sync regions/data/print/share readers and
  current app event contracts unchanged unless separately approved exact scope.
- Do not use generated lesson output as its only musical oracle. Independent
  reviewer plus frozen human-verifiable note/chord inventory is required.
- Full exact-head CI/mutation requirements and actual DEV delivery remain project
  gates. Existing tests were read, not run in this lane. Provider settings,
  GSC/GA4 auth, live indexing and article analytics behavior remain Unverified.

Open owner decisions: publishing home, audience/language/layout priorities,
reviewer/time budget, success definition and aggregate export access. Separate
approval required for implementation, any CLAUDE.md exact diff, analytics/provider
writes and main release. No output in this note supplies those approvals.
