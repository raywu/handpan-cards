# Saved variants — preserve existing own-property compatibility

## Requirement and reproduced failure

Internal repair within approved saved-variants through-DEV scope. The baseline
app avoids Object.hasOwn for Safari before15.4; the new collection adapter must
preserve that support, including unsupported-storage temporary startup. Independent
final engineering review on sourcea394 reproduced TypeError during
savedEnvelopeShape when Object.hasOwn is unavailable; normal identical boot works.
This is a P1 startup regression, not authority to raise browser requirements.

## Swarm-shaped execution

- T owns one additive app test group plus a generated killing fault, in its own
  checkout. Remove Object.hasOwn only inside the application realm before script
  execution; the host harness stays intact. Require ordinary temporary boot,
  usable add/edit/share, and explicit IDB+locks durable initialization/import/edit
  with completed-record verification. Include null-prototype/overridden
  hasOwnProperty and own __proto__ evidence where relevant. Existing parser,
  future-data/provenance and source-preservation tests stay unchanged. Capture
  meaningful doesNotThrow/doesNotReject assertion RED before the source repair;
  no readiness deadline/setup failure credit.
- S owns index.html app JS only. Introduce one app-local savedOwn(object,key)
  using Object.prototype.hasOwnProperty.call, replacing new Object.hasOwn calls
  outside generated regions. No global polyfill, dependency, CLAUDE.md edit,
  parser/wire/schema change or browser-policy expansion. Preserve normal own-key
  semantics, including objects with inert own prototype-looking properties.
- Root integrates; independent engineering and design reviewers approve this
  plan before source execution, then independently review exact source/test diff.
  Root alone operates native browser checks; only test lane runs model tests.

## Validation and rollback

Require RED→GREEN and generated-fault proof, modern-path tests, generated-source
checks, full updated app suite, affected native journeys and a missing-primitive
native smoke. Simulated absence does not establish physical old-Safari support.
Update source-pinned native/backend/frame measurements to the repaired bytes;
retain a394 receipts as earlier evidence. Reanchor changed fault contexts with
actual generated diffs; preserve all fault semantics/counts and exact-head Linux
validation. Main and unrelated work remain held. On failure retain raw evidence
and stop dependent delivery; revert only isolated repair through normal branch
flow, never reset unrelated work or weaken recovery/tests.
