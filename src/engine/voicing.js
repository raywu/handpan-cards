/* HPE.voicing - legality, root octave and register for a chord voicing.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 * Loads AFTER core.js and reads HPE.core.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 5 (legality), 6 (D2 cluster
 * rule, D11 tie-break), 7 (D9 root octave), 11 (field map shape) and
 * CLAUDE.md "Verified card conventions" rule 3.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* Section 5 / D3: a voicing never exceeds 6 notes - the print floor. */
  var MAX_NOTES = 6;

  /* An interval below an octave is a CHORD TONE (root, 3rd, 5th, 7th, the 4th
   * of a sus chord, the 6th of a 6-chord); an interval of an octave or more is
   * an EXTENSION (9, b9, 11, #11, 13). That is exactly how qualities.json
   * spells them: chord tones 0-11, extensions 13, 14, 17, 18, 21. */
  var OCTAVE = 12;

  var PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

  function core() {
    if (!HPE.core) {
      throw new Error("HPE.voicing requires HPE.core: load core.js first");
    }
    return HPE.core;
  }

  function pitchClass(midi) {
    return ((midi % 12) + 12) % 12;
  }

  function pcName(pc) {
    return PC_NAMES[pitchClass(pc)];
  }

  /* Section 1: the two entry points that take untrusted input return the
   * result type. `choose` is given already-validated data, but the brief for
   * this module asks it to report an impossible request rather than throw, and
   * section 2 forbids inventing a code, so an absent pitch class reuses
   * BAD_NOTE - the generic "this note cannot be used" rejection. */
  function fail(code, x) {
    var reason = core().REASONS[code].reason;
    if (x !== undefined && x !== null) reason = reason.split("<X>").join(String(x));
    return { ok: false, code: code, reason: reason };
  }

  /* ---- the field map (section 11: {id: [name, octave, midi, zone, angle, label]}) */

  function isDing(rec) {
    return rec[3] === "ding";
  }

  function isTopShell(rec) {
    return rec[3] !== "ding" && rec[3] !== "bottom";
  }

  // Every field that may appear in a voicing: section 5, the ding never does.
  function playable(fields) {
    var out = [];
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      var rec = fields[key];
      if (isDing(rec)) continue;
      out.push({ id: Number(key), midi: rec[2], zone: rec[3], top: isTopShell(rec) });
    }
    out.sort(function (a, b) { return a.id - b.id; });
    return out;
  }

  // Section 3: when two fields share the MIDI a rule is selecting on, the
  // TOP-shell field wins.
  function byMidiAscending(a, b) {
    if (a.midi !== b.midi) return a.midi - b.midi;
    if (a.top !== b.top) return a.top ? -1 : 1;
    return a.id - b.id;
  }

  function byMidiDescending(a, b) {
    if (a.midi !== b.midi) return b.midi - a.midi;
    if (a.top !== b.top) return a.top ? -1 : 1;
    return a.id - b.id;
  }

  function instancesOf(list, pc) {
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      if (pitchClass(list[i].midi) === pc) out.push(list[i]);
    }
    out.sort(byMidiAscending);
    return out;
  }

  /* ---- the interval set --------------------------------------------------- */

  // Section 5: when a chord symbol implies more than 6 notes, drop the LOWEST
  // optional extension first - the 9 before the 11, the 11 before the 13. A
  // chord tone is never dropped.
  function reduceIntervals(intervals) {
    var ivs = [];
    for (var i = 0; i < intervals.length; i += 1) {
      if (ivs.indexOf(intervals[i]) === -1) ivs.push(intervals[i]);
    }
    ivs.sort(function (a, b) { return a - b; });

    while (ivs.length > MAX_NOTES) {
      var lowestExtension = -1;
      for (var j = 0; j < ivs.length; j += 1) {
        if (ivs[j] >= OCTAVE) { lowestExtension = j; break; }
      }
      if (lowestExtension === -1) break;
      ivs.splice(lowestExtension, 1);
    }

    var seen = {};
    for (var k = 0; k < ivs.length; k += 1) {
      var pc = pitchClass(ivs[k]);
      if (seen[pc]) {
        throw new TypeError("HPE.voicing: interval set repeats a pitch class");
      }
      seen[pc] = true;
    }
    return ivs;
  }

  function isPowerChord(ivs) {
    return ivs.length === 2 && ivs[0] === 0 && ivs[1] === 7;
  }

  /* ---- legality (section 5) ---------------------------------------------- */

  // isLegal(fields, ids, intervals?) - the invariants that hold for EVERY
  // voicing the engine emits. `intervals`, when given, additionally holds the
  // voicing to its chord symbol (the power-chord rule needs it).
  function isLegal(fields, ids, intervals) {
    if (!ids || !ids.length) return false;
    if (ids.length > MAX_NOTES) return false;

    var seen = {};
    for (var i = 0; i < ids.length; i += 1) {
      var rec = fields[String(ids[i])];
      if (!rec) return false;
      if (isDing(rec)) return false;
      var pc = pitchClass(rec[2]);
      if (seen[pc]) return false;
      seen[pc] = true;
    }

    if (intervals) {
      var ivs = reduceIntervals(intervals);
      if (ids.length !== ivs.length) return false;
      if (isPowerChord(ivs) && ids.length !== 2) return false;
    }
    return true;
  }

  /* ---- root octave (D9, section 7) --------------------------------------- */

  // The LOWEST TOP-SHELL instance of the root pitch class, else - when the
  // pitch class exists only on the bottom shell - the lowest instance overall.
  function rootField(fields, rootPc) {
    var all = instancesOf(playable(fields), pitchClass(rootPc));
    if (!all.length) return null;
    for (var i = 0; i < all.length; i += 1) {
      if (all[i].top) return all[i];
    }
    return all[0];
  }

  /* ---- the legal candidate set (section 6, plan Premise 2 consequence 1) -- */

  // Every legal voicing for (root pitch class, interval set): one instance per
  // pitch class of the chord, over the non-ding fields, in chord-spelling
  // order root, 3, 5, 7, 9, 11, 13. Field ids are NUMBERS (section 11).
  function candidates(fields, rootPc, intervals) {
    var list = playable(fields);
    var ivs = reduceIntervals(intervals);
    var root = pitchClass(rootPc);

    var choices = [];
    for (var i = 0; i < ivs.length; i += 1) {
      var inst = instancesOf(list, pitchClass(root + ivs[i]));
      if (!inst.length) return [];
      choices.push(inst);
    }

    var out = [[]];
    for (var j = 0; j < choices.length; j += 1) {
      var next = [];
      for (var a = 0; a < out.length; a += 1) {
        for (var b = 0; b < choices[j].length; b += 1) {
          next.push(out[a].concat([choices[j][b].id]));
        }
      }
      out = next;
    }
    return out;
  }

  /* ---- register: the cluster rule (D2) and the tie-break (D11) ------------ */

  function above(inst, rootMidi) {
    var out = [];
    for (var i = 0; i < inst.length; i += 1) {
      if (inst[i].midi > rootMidi) out.push(inst[i]);
    }
    out.sort(byMidiAscending);
    return out;
  }

  function below(inst, rootMidi) {
    var out = [];
    for (var i = 0; i < inst.length; i += 1) {
      if (inst[i].midi < rootMidi) out.push(inst[i]);
    }
    out.sort(byMidiDescending);
    return out;
  }

  // choose(fields, rootPc, intervals) -> {ok, value: {fields, roots}}
  //
  // D2 forced test: ANY non-root tone - chord tone AND extension alike - has no
  // instance above the root field.
  //   forced  -> every CHORD TONE moves to its HIGHEST instance below the root
  //              (bottom-shell fields are ordinary instances); a chord tone with
  //              no lower instance stays put. EXTENSIONS keep their NEAREST
  //              instance above the root unless they are themselves forced.
  //   unforced (D11) -> every non-root tone takes its NEAREST instance above
  //              the root.
  function choose(fields, rootPc, intervals) {
    var list = playable(fields);
    var ivs = reduceIntervals(intervals);
    var root = pitchClass(rootPc);

    var rf = rootField(fields, root);
    if (!rf) return fail("BAD_NOTE", pcName(root));

    var tones = [];
    for (var i = 0; i < ivs.length; i += 1) {
      if (ivs[i] === 0) continue;
      var pc = pitchClass(root + ivs[i]);
      var inst = instancesOf(list, pc);
      if (!inst.length) return fail("BAD_NOTE", pcName(pc));
      tones.push({
        interval: ivs[i],
        up: above(inst, rf.midi),
        down: below(inst, rf.midi)
      });
    }

    var forced = false;
    for (var t = 0; t < tones.length; t += 1) {
      if (!tones[t].up.length) forced = true;
    }

    var picked = [rf.id];
    for (var u = 0; u < tones.length; u += 1) {
      var tone = tones[u];
      var field;
      if (!forced) {
        field = tone.up[0];
      } else if (tone.interval < OCTAVE) {
        field = tone.down.length ? tone.down[0] : tone.up[0];
      } else {
        field = tone.up.length ? tone.up[0] : tone.down[0];
      }
      picked.push(field.id);
    }

    return { ok: true, value: { fields: picked, roots: [rf.id] } };
  }

  HPE.voicing = {
    candidates: candidates,
    choose: choose,
    rootField: rootField,
    isLegal: isLegal,
    reduceIntervals: reduceIntervals,
    MAX_NOTES: MAX_NOTES
  };
})(HPE);
