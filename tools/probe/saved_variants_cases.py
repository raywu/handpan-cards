#!/usr/bin/env python3
"""Produce frozen, contract-literal backend measurement cases; no app imports.

Usage: python3 tools/probe/saved_variants_cases.py --fixture /absolute/path/to/
       tests/fixtures/saved_variants_v1.json --out-dir /absolute/fresh/directory

The four case bytes are pinned independently of the implementation. Their final
serialized envelopes use fixed UUID placeholders for byte accounting, not hashes
expected from actual randomized migrations. These are test sizes, not product caps.
The existing output parent must exist. A mismatched fixture or case fails before
creating the output directory; an existing directory is never reused or removed.
"""

import argparse
import hashlib
import json
from pathlib import Path

FIXTURE_SHA256 = "b264b2ecb626947ff7cdb93bc61554f4edd6a7ad57b7166ec4004206902c24d2"
CASE_SHA256 = {
    "records-2": "d0a409b66497543be0c75b33a6ec2b065b7ee02425a0a30f242e028e90cfb815",
    "records-20": "0416c0a3b81d1a041e215b7f167e5bcf2773c5169efd6b5f0f6350fde5ff39ee",
    "records-200": "fe4d93aa04799755efbec31273cd778444ca9fada264cb958096b479ded7b320",
    "envelope-exactly-1mib": "f8feeea4057e003a3c92fd271ca7b49a1106dde08d09b81a3118625ca36dadd5",
}


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def measure(text):
    return {
        "utf8Bytes": len(text.encode("utf-8")),
        "utf16CodeUnits": len(text.encode("utf-16-le")) // 2,
        "sha256Utf8": sha256(text.encode("utf-8")),
    }


def uid(number):
    return "00000000-0000-4000-8000-" + format(number, "012x")


def record(index, fixture):
    inventory = "large103" if index == 0 else "pygmyInner18" if index == 1 else "amara9"
    options = {
        "name": "PUBLIC MEASURE " + format(index + 1, "04d"),
        "palette": index % 6,
        "mirror": bool(index % 2),
    }
    if index == 1:
        options["mirrorBottom"] = False
    options["anchor"] = "between" if index % 2 else "one"
    if index == 1:
        options["angles"] = {"bottom": [295, 225, None, 20, None, 130]}
    return {
        "v": 4,
        "s": fixture["inventories"][inventory]["seed"],
        "o": options,
        "measurementMetadata": "測定 🎵",
    }


def golden(records, sources):
    ids = [uid(index + 2) for index in range(len(records))]
    return {
        "schema": 1,
        "collectionId": uid(1),
        "revision": 1,
        "slotStateRevision": 0,
        "entries": [
            {"instanceId": ids[index], "revision": 1, "displayOrdinal": index + 1, "record": row}
            for index, row in enumerate(records)
        ],
        "usedInstanceIds": ids,
        "nextDisplayOrdinal": len(records) + 1,
        "preferredSelection": {"kind": "builtin", "id": "kurd"},
        "slots": {},
        "hidden": [],
        "migration": {"sourceKey": "hpfc.scales.v3", "raw": sources, "instanceIds": ids},
    }


def build(case_id, kind, records, hpfc=None):
    sources = {"hpfc": hpfc, "hpfc.scales": None, "hpfc.scales.v3": dump(records)}
    envelope = golden(records, sources)
    envelope_measure = measure(dump(envelope))
    snapshot = measure(dump(sources))
    source_measure = {key: measure(value) if value is not None else None for key, value in sources.items()}
    totals = {
        unit: sum(value[unit] for value in source_measure.values() if value)
        for unit in ("utf8Bytes", "utf16CodeUnits")
    }
    return {
        "id": case_id,
        "kind": kind,
        "recordCount": len(records),
        "expectedReadableCount": len(records),
        "sources": sources,
        "expectedSources": source_measure,
        "expectedEnvelope": envelope_measure,
        "goldenEnvelopeTemplate": envelope,
        "expectedAccounting": {
            "sourceStringTotals": totals,
            "serializedRawSnapshot": snapshot,
            "finalSerializedEnvelope": envelope_measure,
            "sourcePlusSnapshotPlusEnvelope": {
                unit: totals[unit] + snapshot[unit] + envelope_measure[unit] for unit in totals
            },
            "scope": "Serialization string accounting, not a claim of measured JavaScript heap peak. Raw snapshot is embedded in final envelope; this sum deliberately counts separately retained source, raw-snapshot JSON, and envelope JSON.",
        },
    }


def cases_for(fixture):
    cases = []
    for count, oracle in zip((2, 20, 200), fixture["measurement"]["samples"]):
        case = build("records-" + str(count), "records", [record(index, fixture) for index in range(count)])
        check(case["expectedSources"]["hpfc.scales.v3"] == oracle["expected"], "frozen source accounting mismatch")
        cases.append(case)
    check(len(cases) == 3, "all three independently frozen record cases are required")

    # Padding occurs in both the entry and exact retained source; unrelated hpfc
    # parity appears once. This targets the FINAL envelope, not a 1MiB input.
    row = record(0, fixture)
    row["measurementPadding"] = ""
    base = build("envelope-exactly-1mib", "envelope-1mib", [row], dump({"measurementParity": ""}))
    remaining = 1048576 - base["expectedEnvelope"]["utf8Bytes"]
    check(remaining >= 0, "literal base envelope exceeds stress target")
    padding, parity = divmod(remaining, 2)
    row["measurementPadding"] = "x" * padding
    stress = build("envelope-exactly-1mib", "envelope-1mib", [row], dump({"measurementParity": "p" * parity}))
    check(stress["expectedEnvelope"]["utf8Bytes"] == 1048576, "final stress envelope must be exactly1MiB")
    stress["literalRecipe"] = {
        "baseRecord": "recordRecipe index0: valid large103 notes, ASCII PUBLIC MEASURE 0001 name, preserved unknown measurementMetadata 測定 🎵",
        "measurementPaddingCharacter": "x",
        "measurementPaddingRepeat": padding,
        "hpfcParityCharacter": "p",
        "hpfcParityRepeat": parity,
        "emptyPaddingBaseEnvelopeUtf8Bytes": base["expectedEnvelope"]["utf8Bytes"],
        "independentAccounting": "empty-padding literal envelope bytes + 2 * measurementPaddingRepeat + hpfcParityRepeat = 1048576",
        "uuidPolicy": "Fixed distinct lower-case UUIDv4 placeholders, each36 ASCII chars; actual randomized UUID content changes hash but not bytes. No equality of template SHA with actual randomized migration is expected.",
    }
    cases.append(stress)
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    check(args.fixture.is_absolute() and args.out_dir.is_absolute(), "fixture and out-dir must be absolute paths")
    fixture_raw = args.fixture.read_bytes()
    check(sha256(fixture_raw) == FIXTURE_SHA256, "fixture SHA-256 differs from reviewed frozen input")
    cases = cases_for(json.loads(fixture_raw))
    encoded = [(case, (dump(case) + "\n").encode("utf-8")) for case in cases]
    for case, raw in encoded:
        check(sha256(raw) == CASE_SHA256[case["id"]], "case SHA-256 differs from independent reviewed artifact: " + case["id"])

    # Build/validate everything before reserving output. mkdir is exclusive even
    # for an existing empty directory or symlink; no partial overwrite is allowed.
    output_parent = args.out_dir.parent.resolve(strict=True)
    output = output_parent / args.out_dir.name
    output.mkdir()
    manifest = {
        "formatVersion": 1,
        "fixtureSHA256": FIXTURE_SHA256,
        "cases": [],
        "qualification": "Expected envelope SHA is fixed UUID template only; runtime UUID hash differs. Stored-value serialization accounting is not measured heap or disk durability.",
    }
    for case, raw in encoded:
        name = case["id"] + ".json"
        with (output / name).open("xb") as destination:
            destination.write(raw)
        manifest["cases"].append({
            "id": case["id"],
            "file": name,
            "sha256": sha256(raw),
            "recordCount": case["recordCount"],
            "expectedEnvelope": case["expectedEnvelope"],
        })
    with (output / "manifest.json").open("xb") as destination:
        destination.write((json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"outDir": str(output), **manifest}, ensure_ascii=False))


if __name__ == "__main__":
    main()
