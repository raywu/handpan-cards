/* HPE.select - candidate selection, ranking and the generated deck object.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 * Loads AFTER core.js, voicing.js, layout.js and naming.js and reads all four.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 1 (result contract), 5
 * (collapse rules, the 6-note trim), 7 (D9 root octave), 8 (candidates,
 * ranking, cap, dedup, canonical order), 9-10 (naming and degrees, never
 * re-implemented here), 11 (the deck object), 12 (deck identity), 13 (palette,
 * mirror, auto name), 16 and 17.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* ---- section 8: the cap and the ranking tiers -------------------------- */

  var CAP = 25;                       /* DEFAULT[owner-review]: 25 cards      */
  var NAME_MAX = 16;                  /* section 13: the auto name's cap      */
  var ELLIPSIS = "…";

  /* Ranking and canonical order share one tier order (section 8):
   * triads > power > sus4 > 7ths > extended. */
  var TIERS = ["triad", "power", "sus", "seventh", "extended"];

  /* Section 5: the losing spellings of a coinciding pitch set. sus4 beats
   * sus2, m7 beats 6, m7b5 beats m6. `sus2` is listed for completeness - the
   * section 16 quality table carries no sus2 entry, so that clause is vacuous
   * under the shipped vocabulary. */
  var COLLAPSE_LOSERS = ["sus2", "6", "m6"];

  /* Section 13: the D6 palette set, index 0-5. */
  var PALETTES = [
    {root: "#E0559A", tone: "#E2761B"},
    {root: "#6D40A3", tone: "#C9971E"},
    {root: "#0B7B75", tone: "#DD8F00"},
    {root: "#E2761B", tone: "#E0559A"},
    {root: "#C9971E", tone: "#6D40A3"},
    {root: "#DD8F00", tone: "#0B7B75"}
  ];

  function core() { return need("core"); }
  function voicing() { return need("voicing"); }
  function layout() { return need("layout"); }
  function naming() { return need("naming"); }

  function need(name) {
    if (!HPE[name]) {
      throw new Error("HPE.select requires HPE." + name + ": load " + name +
        ".js first");
    }
    return HPE[name];
  }

  function pc(n) {
    return ((n % 12) + 12) % 12;
  }

  function has(list, value) {
    for (var i = 0; i < list.length; i += 1) if (list[i] === value) return true;
    return false;
  }

  function ids(fields) {
    var out = [];
    for (var id in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, id)) out.push(id);
    }
    out.sort(function (a, b) { return Number(a) - Number(b); });
    return out;
  }

  function isDing(record) { return record[3] === "ding"; }
  function isTopShell(record) { return record[3] !== "ding" && record[3] !== "bottom"; }

  /* Every pitch class present on a field the predicate accepts. */
  function pcsWhere(fields, predicate) {
    var list = ids(fields);
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var record = fields[list[i]];
      if (!predicate(record)) continue;
      var value = pc(record[2]);
      if (!has(out, value)) out.push(value);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function anyField(fields) { return true; }
  function nonDing(record) { return !isDing(record); }

  /* ---- section 8: raw candidates ---------------------------------------- */

  // A quality is a candidate for a root only when every one of its interval
  // pitch classes (the root's included) sits on a NON-DING field - the ding
  // never appears in a voicing, so a ding-only pitch class is neither a root
  // nor a chord tone. An `extended`-tier quality additionally needs every one
  // of its tones on the TOP shell.
  //
  // The eligibility test reads the quality's TABULATED intervals, not the
  // 6-note-trimmed set: section 8 speaks of "its interval pitch classes", and
  // the trim of section 5 is a voicing step.
  function candidates(fields) {
    var qualities = naming().QUALITIES;
    var roots = pcsWhere(fields, nonDing);
    var playable = roots;
    var top = pcsWhere(fields, isTopShell);

    var suffixes = [];
    for (var key in qualities) {
      if (Object.prototype.hasOwnProperty.call(qualities, key)) suffixes.push(key);
    }
    suffixes.sort(function (a, b) { return qualities[a].rank - qualities[b].rank; });

    var out = [];
    for (var r = 0; r < roots.length; r += 1) {
      for (var s = 0; s < suffixes.length; s += 1) {
        var quality = qualities[suffixes[s]];
        if (!has(TIERS, quality.tier)) continue;
        var available = quality.tier === "extended" ? top : playable;
        var fits = true;
        for (var i = 0; i < quality.intervals.length; i += 1) {
          if (!has(available, pc(roots[r] + quality.intervals[i]))) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        out.push({
          root: roots[r],
          suffix: suffixes[s],
          tier: quality.tier,
          rank: quality.rank,
          intervals: quality.intervals.slice()
        });
      }
    }
    return out;
  }

  /* ---- section 5: the pitch-set collapse --------------------------------- */

  // The pitch set a candidate actually sounds: the 6-note-trimmed interval set
  // over the root, as pitch classes.
  function pitchSet(candidate) {
    var reduced = voicing().reduceIntervals(candidate.intervals);
    var out = [];
    for (var i = 0; i < reduced.length; i += 1) out.push(pc(candidate.root + reduced[i]));
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  // Deterministic preference inside one coinciding pitch set: the losing
  // spellings of section 5 go first, then the section 8 ranking tie-breaks.
  function preferenceRank(a, b, tonicPc) {
    var loserA = has(COLLAPSE_LOSERS, a.suffix) ? 1 : 0;
    var loserB = has(COLLAPSE_LOSERS, b.suffix) ? 1 : 0;
    if (loserA !== loserB) return loserA - loserB;
    var tierA = TIERS.indexOf(a.tier);
    var tierB = TIERS.indexOf(b.tier);
    if (tierA !== tierB) return tierA - tierB;
    var degreeA = pc(a.root - tonicPc);
    var degreeB = pc(b.root - tonicPc);
    if (degreeA !== degreeB) return degreeA - degreeB;
    return a.rank - b.rank;
  }

  // Candidates whose pitch sets coincide yield ONE candidate. Where the group's
  // survivors differ only by root - the symmetric sets, diminished 7th and
  // augmented - section 8's tie-break picks the root: the tonic, else the
  // lowest scale degree.
  function collapse(fields, list, tonicPc) {
    var groups = {};
    var order = [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var key = pitchSet(list[i]).join(",");
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(list[i]);
    }

    var degreeOrder = pcsWhere(fields, anyField).slice().sort(function (a, b) {
      return pc(a - tonicPc) - pc(b - tonicPc);
    });

    var winners = [];
    for (i = 0; i < order.length; i += 1) {
      var group = groups[order[i]];
      if (group.length === 1) { winners.push(group[0]); continue; }

      var best = group[0];
      var j;
      for (j = 1; j < group.length; j += 1) {
        if (preferenceRank(group[j], best, tonicPc) < 0) best = group[j];
      }

      // A symmetric set: every survivor spells the same quality on a different
      // root, so the root is chosen by the section 8 tie-break rather than by
      // the ranking order.
      var sameQuality = true;
      var symmetricRoots = [];
      for (j = 0; j < group.length; j += 1) {
        if (group[j].suffix !== best.suffix) sameQuality = false;
        if (group[j].suffix === best.suffix) symmetricRoots.push(group[j].root);
      }
      if (sameQuality && symmetricRoots.length > 1) {
        var chosen = naming().symmetricRoot(symmetricRoots, tonicPc, degreeOrder);
        for (j = 0; j < group.length; j += 1) {
          if (group[j].root === chosen) best = group[j];
        }
      }
      winners.push(best);
    }
    return winners;
  }

  /* ---- voicing (section 5, 6, 7) ----------------------------------------- */

  // `choose` takes the root PITCH CLASS, not the root field: D9 fixes the
  // octave (queue row 23). A not-ok result drops the candidate - `isLegal`
  // checks the note count only, so it is not a pitch-class guard (row 31).
  function voice(fields, list) {
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i += 1) {
      var picked = voicing().choose(fields, list[i].root, list[i].intervals);
      if (!picked.ok) continue;
      var key = picked.value.fields.join(",");
      if (seen[key]) continue;      // section 5: one fields list per deck
      seen[key] = true;
      out.push({
        root: list[i].root,
        suffix: list[i].suffix,
        tier: list[i].tier,
        rank: list[i].rank,
        intervals: list[i].intervals,
        fields: picked.value.fields.slice(),
        roots: picked.value.roots.slice()
      });
    }
    return out;
  }

  function topShellTones(fields, candidate) {
    var count = 0;
    for (var i = 0; i < candidate.fields.length; i += 1) {
      var record = fields[String(candidate.fields[i])];
      if (record && isTopShell(record)) count += 1;
    }
    return count;
  }

  /* ---- section 8: ranking (trim to the cap) and the canonical order ------ */

  // triads > power > sus4 > 7ths > extended; within a tier, more top-shell
  // tones ranks higher; ties by root scale degree ascending from the tonic,
  // then by the quality's `rank`.
  function rank(fields, list, tonicPc) {
    var decorated = [];
    for (var i = 0; i < list.length; i += 1) {
      decorated.push({item: list[i], at: i, top: topShellTones(fields, list[i])});
    }
    decorated.sort(function (a, b) {
      var tierA = TIERS.indexOf(a.item.tier);
      var tierB = TIERS.indexOf(b.item.tier);
      if (tierA !== tierB) return tierA - tierB;
      if (a.top !== b.top) return b.top - a.top;
      var degreeA = pc(a.item.root - tonicPc);
      var degreeB = pc(b.item.root - tonicPc);
      if (degreeA !== degreeB) return degreeA - degreeB;
      if (a.item.rank !== b.item.rank) return a.item.rank - b.item.rank;
      return a.at - b.at;
    });
    var out = [];
    for (i = 0; i < decorated.length; i += 1) out.push(decorated[i].item);
    return out;
  }

  // Roots by scale degree ascending from the tonic; within a root, the tier
  // order; within a tier, by the quality's `rank`.
  function order(list, tonicPc) {
    var decorated = [];
    for (var i = 0; i < list.length; i += 1) decorated.push({item: list[i], at: i});
    decorated.sort(function (a, b) {
      var degreeA = pc(a.item.root - tonicPc);
      var degreeB = pc(b.item.root - tonicPc);
      if (degreeA !== degreeB) return degreeA - degreeB;
      var tierA = TIERS.indexOf(a.item.tier);
      var tierB = TIERS.indexOf(b.item.tier);
      if (tierA !== tierB) return tierA - tierB;
      if (a.item.rank !== b.item.rank) return a.item.rank - b.item.rank;
      return a.at - b.at;
    });
    var out = [];
    for (i = 0; i < decorated.length; i += 1) out.push(decorated[i].item);
    return out;
  }

  /* ---- section 9: naming a candidate ------------------------------------- */

  // A root is spelled as the SEED spells the field the voicing roots on, so a
  // pan written with F reads F and never E#.
  function spellingOf(fields, id) {
    var record = fields[String(id)];
    return record ? record[0] : null;
  }

  function spellingOfPc(fields, value) {
    var list = ids(fields);
    for (var i = 0; i < list.length; i += 1) {
      if (pc(fields[list[i]][2]) === pc(value)) return fields[list[i]][0];
    }
    return null;
  }

  // Section 8 / D4: an m7 is annotatable as `( = (X+3)6 )` and an m7b5 as
  // `( = (X+3)m6 )`, the 6-chord a minor third above the root. Generated decks
  // derive them mechanically.
  function equivalenceRoot(fields, candidate) {
    if (candidate.suffix !== "m7" && candidate.suffix !== "m7b5") return null;
    return spellingOfPc(fields, candidate.root + 3);
  }

  function card(fields, candidate) {
    var rootName = spellingOf(fields, candidate.roots[0]);
    var named = naming().name(rootName, candidate.suffix);
    var subtitle = naming().subtitle(rootName, candidate.suffix,
      equivalenceRoot(fields, candidate));
    return {
      main: named.main,
      sup: named.sup,
      subtitle: subtitle,
      fields: candidate.fields.slice(),
      roots: candidate.roots.slice()
    };
  }

  /* ---- section 17: the NO_THIRDS warning --------------------------------- */

  // No root on the pan has a third above it on the top shell. A root is any
  // pitch class on a non-ding field (section 8).
  function noThirds(fields) {
    var roots = pcsWhere(fields, nonDing);
    var top = pcsWhere(fields, isTopShell);
    for (var i = 0; i < roots.length; i += 1) {
      if (has(top, pc(roots[i] + 3)) || has(top, pc(roots[i] + 4))) return false;
    }
    return true;
  }

  function warning(code) {
    return {code: code, reason: core().REASONS[code].reason};
  }

  /* ---- section 13: the auto deck name ------------------------------------ */

  // `<DING PITCH CLASS> <PARENT DISPLAY> <N>`, N counting the TOP-SHELL fields
  // including the ding. Uppercase - except the ding's own spelling, which is
  // kept verbatim because uppercasing `Bb` would read as B natural. The 16-
  // character cap is unreachable for an auto name (2 + 1 + 8 + 1 + 2 = 14); the
  // ellipsis is kept so the cap is a fact of the code, not of the arithmetic.
  function autoName(fields, parentIndex) {
    var list = ids(fields);
    var top = 0;
    for (var i = 0; i < list.length; i += 1) {
      var record = fields[list[i]];
      if (isTopShell(record) || isDing(record)) top += 1;
    }
    var name = fields["0"][0] + " " + naming().PARENTS[parentIndex].display +
      " " + top;
    if (name.length > NAME_MAX) {
      name = name.slice(0, NAME_MAX - 1) + ELLIPSIS;
    }
    return name;
  }

  /* ---- section 11: build -------------------------------------------------- */

  function build(seed) {
    if (!seed || !seed.fields || !seed.fields["0"]) {
      return {ok: false, code: "NO_DING", reason: core().REASONS.NO_DING.reason};
    }
    var fields = seed.fields;
    var seedOptions = seed.options || {};
    var tonicPc = pc(fields["0"][2]);
    var panPcs = pcsWhere(fields, anyField);

    var parentIndex = (seedOptions.parent === undefined ||
                       seedOptions.parent === null)
      ? naming().inferParent(panPcs, tonicPc)
      : seedOptions.parent;
    var mirror = !!seedOptions.mirror;
    var paletteIndex = seedOptions.palette || 0;

    var solved = layout().solve(fields, {mirror: mirror});
    if (!solved.ok) return solved;      // propagated unchanged (section 1)

    var warnings = [];
    var thirdless = noThirds(fields);
    if (thirdless) warnings.push(warning("NO_THIRDS"));

    var list = candidates(fields);
    list = collapse(fields, list, tonicPc);
    list = voice(fields, list);
    list = rank(fields, list, tonicPc);
    if (list.length > CAP) list = list.slice(0, CAP);
    list = order(list, tonicPc);

    var chords = [];
    for (var i = 0; i < list.length; i += 1) chords.push(card(fields, list[i]));

    var palette = PALETTES[paletteIndex];
    var deck = {
      id: core().deckId(fields),
      name: seedOptions.name ? seedOptions.name : autoName(fields, parentIndex),
      options: {palette: paletteIndex, mirror: mirror, parent: parentIndex},
      colors: {
        root: palette.root,
        tone: palette.tone,
        ga: palette.root,
        gb: palette.tone
      },
      degrees: naming().degrees(panPcs, tonicPc, parentIndex,
        {noThirds: thirdless}),
      geom: solved.value.geom,
      fields: solved.value.fields,
      chords: chords,
      warnings: warnings
    };

    return {ok: true, value: deck, warnings: warnings};
  }

  HPE.select = {
    build: build,
    candidates: candidates,
    collapse: collapse,
    voice: voice,
    rank: rank,
    order: order,
    noThirds: noThirds,
    autoName: autoName,
    PALETTES: PALETTES,
    TIERS: TIERS,
    CAP: CAP
  };
})(HPE);
