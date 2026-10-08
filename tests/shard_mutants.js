// Pure partitioning for tests/mutation_check.sh's MUTANT_SHARD (finding 4,
// 2026-09-30 quality refactor). Kept as its own module, independent of the
// shell script, so tests/mutation_harness.test.js can assert the partition
// is disjoint, complete and e2e-balanced without driving a shell at all.
//
// A plain `index % N` over the whole corpus is NOT good enough: a sizeable
// and growing share of the corpus (E190-2, post-refactor triage: the exact
// count drifts as mutants are added, so this comment names no figure) selects
// tests/e2e.test.js by mutation_check.sh's
// own `*tests/e2e.test.js*` suite rule (not a substring match on the filename - a
// mutant named e_* or sw_* is not what makes it e2e, its `# suite:` command
// is), and those cluster under the `e_`/`sw_` name prefixes. A flat modulo
// or a contiguous chunk both leave one shard e2e-heavy and another
// e2e-light, which is exactly the imbalance that makes one shard the
// long pole. So e2e-selecting and non-e2e mutants are dealt as two
// SEPARATE round-robin decks, each individually balanced to within 1.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// harness.test.js drives the same browser and skips without one, so its
// mutants are e2e-selecting for both the skip rule and the shard balance.
const E2E_SUITE_MARKERS = ["tests/e2e.test.js", "tests/harness.test.js", "tests/drawer_grid.test.js", "tests/drawer_seats.test.js", "tests/drawer_drag.test.js"];

function suiteOf(patchText) {
  const m = patchText.match(/^# suite:\s*(.*)$/m);
  return m ? m[1].trim() : "";
}

// Mirrors mutation_check.sh's own case match:
// `*tests/e2e.test.js*|*tests/harness.test.js*` against
// the suite command, never the patch's filename.
function isE2ESelecting(patchText) {
  const suite = suiteOf(patchText);
  return E2E_SUITE_MARKERS.some((m) => suite.includes(m));
}

function loadMutants(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".patch"))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), "utf8") }));
}

// entries: [{name, text}]. Returns an array of N shards (0-indexed), each a
// sorted-stable list of mutant basenames, such that:
//   - every entry appears in exactly one shard (disjoint + complete)
//   - e2e-selecting entries are dealt round-robin among the shards, and so
//     are the rest, SEPARATELY - so the two groups balance independently
//     and neither can skew the other's spread by more than 1
function partition(entries, N) {
  if (!Number.isInteger(N) || N < 1) {
    throw new RangeError(`partition: N must be a positive integer, got ${N}`);
  }
  // Stable sort by name: the shard assignment must not depend on directory
  // read order (which readdirSync does not guarantee across platforms).
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const e2e = sorted.filter((e) => isE2ESelecting(e.text));
  const rest = sorted.filter((e) => !isE2ESelecting(e.text));
  const shards = Array.from({ length: N }, () => []);
  e2e.forEach((e, i) => shards[i % N].push(e.name));
  rest.forEach((e, i) => shards[i % N].push(e.name));
  return shards;
}

function shardFor(dir, index, total) {
  return partition(loadMutants(dir), total)[index];
}

module.exports = { isE2ESelecting, loadMutants, partition };

if (require.main === module) {
  // CLI: node shard_mutants.js <i 1..N> <N> [mutants-dir]
  // 1-indexed on the command line for shell friendliness (MUTANT_SHARD=i/N).
  const [, , idxArg, totalArg, dirArg] = process.argv;
  const total = parseInt(totalArg, 10);
  const idx = parseInt(idxArg, 10);
  const dir = dirArg || path.join(__dirname, "mutants");
  if (!Number.isInteger(idx) || !Number.isInteger(total) || idx < 1 || idx > total) {
    process.stderr.write("usage: node shard_mutants.js <i 1..N> <N> [mutants-dir]\n");
    process.exit(2);
  }
  const names = shardFor(dir, idx - 1, total);
  process.stdout.write(names.length ? names.join("\n") + "\n" : "");
}
