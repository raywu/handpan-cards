/* HPE.naming - chord names, subtitles, parent inference and degree labels.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 1, 5, 8, 9, 10, 16 and 17.
 * QUALITIES and PARENTS are the literal copies of tests/fixtures/qualities.json
 * and tests/fixtures/parents.json that section 9 requires the module to carry;
 * tests/naming.test.js holds them to the fixtures.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* ---- section 16: the quality table, keyed by the full suffix ---------- */

  var QUALITIES = {
    "": {intervals: [0, 4, 7], display: "MAJOR", main_suffix: "", sup: "", rooted: true, tier: "triad", rank: 1},
    "m": {intervals: [0, 3, 7], display: "MINOR", main_suffix: "m", sup: "", rooted: true, tier: "triad", rank: 2},
    "°": {intervals: [0, 3, 6], display: "DIMINISHED", main_suffix: "°", sup: "", rooted: false, tier: "triad", rank: 3},
    "aug": {intervals: [0, 4, 8], display: "AUGMENTED", main_suffix: "aug", sup: "", rooted: false, tier: "triad", rank: 4},
    "5": {intervals: [0, 7], display: "POWER CHORD", main_suffix: "5", sup: "", rooted: false, tier: "power", rank: 5},
    "sus4": {intervals: [0, 5, 7], display: "SUSPENDED CHORD", main_suffix: "sus", sup: "4", rooted: false, tier: "sus", rank: 6},
    "7sus4": {intervals: [0, 5, 7, 10], display: "SUSPENDED DOMINANT 7", main_suffix: "7sus", sup: "4", rooted: false, tier: "sus", rank: 7},
    "maj7sus4": {intervals: [0, 5, 7, 11], display: "SUSPENDED MAJOR 7", main_suffix: "maj7sus", sup: "4", rooted: false, tier: "sus", rank: 8},
    "maj7": {intervals: [0, 4, 7, 11], display: "MAJOR 7", main_suffix: "maj", sup: "7", rooted: true, tier: "seventh", rank: 9},
    "m7": {intervals: [0, 3, 7, 10], display: "MINOR 7", main_suffix: "m", sup: "7", rooted: true, tier: "seventh", rank: 10},
    "7": {intervals: [0, 4, 7, 10], display: "DOMINANT 7", main_suffix: "", sup: "7", rooted: true, tier: "seventh", rank: 11},
    "m7b5": {intervals: [0, 3, 6, 10], display: "HALF-DIMINISHED", main_suffix: "m7", sup: "b5", rooted: false, tier: "seventh", rank: 12},
    "°7": {intervals: [0, 3, 6, 9], display: "DIMINISHED 7", main_suffix: "°", sup: "7", rooted: false, tier: "seventh", rank: 13},
    "6": {intervals: [0, 4, 7, 9], display: "MAJOR 6", main_suffix: "", sup: "6", rooted: true, tier: "seventh", rank: 14},
    "m6": {intervals: [0, 3, 7, 9], display: "MINOR 6", main_suffix: "m", sup: "6", rooted: true, tier: "seventh", rank: 15},
    "add9": {intervals: [0, 4, 7, 14], display: "MAJOR ADD 9", main_suffix: "", sup: "add9", rooted: true, tier: "extended", rank: 16},
    "madd9": {intervals: [0, 3, 7, 14], display: "MINOR ADD 9", main_suffix: "m", sup: "add9", rooted: true, tier: "extended", rank: 17},
    "6/9": {intervals: [0, 4, 7, 9, 14], display: "MAJOR 6/9", main_suffix: "", sup: "6/9", rooted: true, tier: "extended", rank: 18},
    "m6/9": {intervals: [0, 3, 7, 9, 14], display: "MINOR 6/9", main_suffix: "m", sup: "6/9", rooted: true, tier: "extended", rank: 19},
    "9": {intervals: [0, 4, 7, 10, 14], display: "DOMINANT 9", main_suffix: "", sup: "9", rooted: true, tier: "extended", rank: 20},
    "m9": {intervals: [0, 3, 7, 10, 14], display: "MINOR 9", main_suffix: "m", sup: "9", rooted: true, tier: "extended", rank: 21},
    "maj9": {intervals: [0, 4, 7, 11, 14], display: "MAJOR 9", main_suffix: "maj", sup: "9", rooted: true, tier: "extended", rank: 22},
    "7b9": {intervals: [0, 4, 7, 10, 13], display: "DOMINANT 7 FLAT 9", main_suffix: "7", sup: "b9", rooted: true, tier: "extended", rank: 23},
    "11": {intervals: [0, 4, 7, 10, 14, 17], display: "DOMINANT 11", main_suffix: "", sup: "11", rooted: true, tier: "extended", rank: 24},
    "m11": {intervals: [0, 3, 7, 10, 14, 17], display: "MINOR 11", main_suffix: "m", sup: "11", rooted: true, tier: "extended", rank: 25},
    "13": {intervals: [0, 4, 7, 10, 14, 17, 21], display: "DOMINANT 13", main_suffix: "", sup: "13", rooted: true, tier: "extended", rank: 26},
    "7#11": {intervals: [0, 4, 7, 10, 18], display: "DOMINANT 7 SHARP 11", main_suffix: "7", sup: "#11", rooted: true, tier: "extended", rank: 27},
    "maj7#11": {intervals: [0, 4, 7, 11, 18], display: "MAJOR 7 SHARP 11", main_suffix: "maj7", sup: "#11", rooted: true, tier: "extended", rank: 28}
  };

  /* ---- section 10: the 11 parent candidates, in the FIXED list order ----
   * Aeolian precedes Dorian deliberately: they tie at distance 0 on D Amara
   * and D10 declares Amara Aeolian. */

  var PARENTS = [
    {name: "Ionian", display: "IONIAN", intervals: [0, 2, 4, 5, 7, 9, 11]},
    {name: "Aeolian", display: "AEOLIAN", intervals: [0, 2, 3, 5, 7, 8, 10]},
    {name: "Dorian", display: "DORIAN", intervals: [0, 2, 3, 5, 7, 9, 10]},
    {name: "Phrygian", display: "PHRYGIAN", intervals: [0, 1, 3, 5, 7, 8, 10]},
    {name: "Lydian", display: "LYDIAN", intervals: [0, 2, 4, 6, 7, 9, 11]},
    {name: "Mixolydian", display: "MIXOLYD", intervals: [0, 2, 4, 5, 7, 9, 10]},
    {name: "Locrian", display: "LOCRIAN", intervals: [0, 1, 3, 5, 6, 8, 10]},
    {name: "Harmonic minor", display: "HARM MIN", intervals: [0, 2, 3, 5, 7, 8, 11]},
    {name: "Melodic minor", display: "MEL MIN", intervals: [0, 2, 3, 5, 7, 9, 11]},
    {name: "Phrygian dominant", display: "HIJAZ", intervals: [0, 1, 4, 5, 7, 8, 10]},
    {name: "Harmonic major", display: "HARM MAJ", intervals: [0, 2, 4, 5, 7, 8, 11]}
  ];

  /* ---- caps (section 9) ------------------------------------------------- */

  var NAME_MAX = 16;      // main + sup
  var SUBTITLE_MAX = 26;  // the longest m7b5 equivalence, HALF-DIMINISHED ( = Bbm6 )

  /* ---- degree reference scales (D8) ------------------------------------- */

  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  var MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];
  var MINOR_REF = [0, 2, 3, 5, 7, 8, 10];

  function pc(n) {
    return ((n % 12) + 12) % 12;
  }

  function uniquePcs(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var value = pc(list[i]);
      if (!seen[value]) { seen[value] = true; out.push(value); }
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function member(list, value) {
    for (var i = 0; i < list.length; i += 1) if (list[i] === value) return true;
    return false;
  }

  /* Section 10: a degree is named from the reference degree it is one semitone
   * away from - one semitone BELOW degree N is `bN`, one semitone ABOVE is
   * `#N`; when both apply the accidental convention decides, `b` for a
   * major-relative scale (D8 flats) and `#` otherwise. A pitch class that IS a
   * reference degree carries no accidental. Returns the numeral split so the
   * caller can case the roman part without touching the accidental. */
  function numeral(offset, minorRelative) {
    var ref = minorRelative ? MINOR_REF : MAJOR_REF;
    var exact = -1, below = -1, above = -1, i;
    for (i = 0; i < ref.length; i += 1) {
      if (ref[i] === offset) exact = i;
      if (ref[i] === pc(offset - 1)) below = i;   // offset sits one ABOVE ref[i]
      if (ref[i] === pc(offset + 1)) above = i;   // offset sits one BELOW ref[i]
    }
    if (exact >= 0) return {accidental: "", roman: ROMAN[exact]};
    if (below >= 0 && above >= 0) {
      return minorRelative
        ? {accidental: "#", roman: ROMAN[below]}
        : {accidental: "b", roman: ROMAN[above]};
    }
    if (above >= 0) return {accidental: "b", roman: ROMAN[above]};
    return {accidental: "#", roman: ROMAN[below]};
  }

  /* ---- section 9: chord name and subtitle -------------------------------- */

  function quality(suffix) {
    if (!Object.prototype.hasOwnProperty.call(QUALITIES, suffix)) {
      throw new Error("naming: unknown quality suffix " + JSON.stringify(suffix));
    }
    return QUALITIES[suffix];
  }

  // Section 1: a plain function over validated data. It returns its value
  // directly and throws only on a programming error - a cap breach here is a
  // bug in the caller's root spelling, never user input.
  function name(rootName, suffix) {
    var q = quality(suffix);
    var out = {main: rootName + q.main_suffix, sup: q.sup};
    if ((out.main + out.sup).length > NAME_MAX) {
      throw new RangeError("naming: chord name over " + NAME_MAX +
        " characters: " + out.main + out.sup);
    }
    return out;
  }

  // Section 5 / D4: the equivalence suffix, `( = X6 )` on an m7 and
  // `( = Xm6 )` on an m7b5, where X is the sixth a minor third above the root.
  function subtitle(rootName, suffix, equivRootName) {
    var q = quality(suffix);
    var out = q.rooted ? rootName + " " + q.display : q.display;
    if (equivRootName !== undefined && equivRootName !== null && equivRootName !== "") {
      if (suffix === "m7") {
        out += " ( = " + equivRootName + "6 )";
      } else if (suffix === "m7b5") {
        out += " ( = " + equivRootName + "m6 )";
      } else {
        throw new Error("naming: no equivalence for quality " + JSON.stringify(suffix));
      }
    }
    if (out.length > SUBTITLE_MAX) {
      throw new RangeError("naming: subtitle over " + SUBTITLE_MAX +
        " characters: " + out);
    }
    return out;
  }

  /* ---- section 10: parent inference -------------------------------------- */

  function parentPcs(index, tonicPc) {
    var intervals = PARENTS[index].intervals;
    var out = [];
    for (var i = 0; i < intervals.length; i += 1) out.push(pc(tonicPc + intervals[i]));
    return out;
  }

  // Distance = the number of PAN pitch classes (ding included, counted once
  // each) that are not members of the parent built on the tonic. Lowest wins;
  // ties break by position in the fixed list order, earlier wins.
  function parentDistance(pitchClasses, tonicPc, index) {
    var pan = uniquePcs(pitchClasses);
    var parent = parentPcs(index, tonicPc);
    var distance = 0;
    for (var i = 0; i < pan.length; i += 1) {
      if (!member(parent, pan[i])) distance += 1;
    }
    return distance;
  }

  function inferParent(pitchClasses, tonicPc) {
    var best = 0;
    var bestDistance = parentDistance(pitchClasses, tonicPc, 0);
    for (var i = 1; i < PARENTS.length; i += 1) {
      var d = parentDistance(pitchClasses, tonicPc, i);
      if (d < bestDistance) { bestDistance = d; best = i; }
    }
    return best;
  }

  /* ---- section 10: degree labels ----------------------------------------- */

  // D10 over the parent: the third and the fifth are the parent's own stacked
  // thirds, two and four scale steps up. A minor third gives lowercase, a
  // major third uppercase; a diminished fifth adds the `°` suffix.
  function caseFromParent(index, tonicPc, degreePc) {
    var intervals = PARENTS[index].intervals;
    var parent = parentPcs(index, tonicPc);
    var at = -1;
    for (var i = 0; i < parent.length; i += 1) if (parent[i] === degreePc) at = i;
    if (at < 0) return null;
    var n = intervals.length;
    var third = pc(intervals[(at + 2) % n] - intervals[at]);
    var fifth = pc(intervals[(at + 4) % n] - intervals[at]);
    return {lower: third === 3, diminished: fifth === 6};
  }

  // The same rule over the PAN, for a pitch class outside the parent:
  // uppercase when no third is available at all.
  function caseFromPan(pan, degreePc) {
    var minorThird = member(pan, pc(degreePc + 3));
    var majorThird = member(pan, pc(degreePc + 4));
    var hasThird = minorThird || majorThird;
    return {
      lower: minorThird,
      diminished: hasThird && member(pan, pc(degreePc + 6)) &&
                  !member(pan, pc(degreePc + 7))
    };
  }

  function degrees(pitchClasses, tonicPc, parentIndex, opts) {
    if (!PARENTS[parentIndex]) {
      throw new Error("naming: no parent at index " + parentIndex);
    }
    var options = opts || {};
    var noThirds = !!options.noThirds;
    var pan = uniquePcs(pitchClasses);
    var tonic = pc(tonicPc);
    // D8: minor-relative numerals when the PAN carries a minor third above the
    // tonic, major-relative with flats otherwise.
    var minorRelative = member(pan, pc(tonic + 3));
    var out = {};
    for (var i = 0; i < pan.length; i += 1) {
      var degreePc = pan[i];
      var num = numeral(pc(degreePc - tonic), minorRelative);
      var casing;
      if (noThirds) {
        // NO_THIRDS overrides D10: every numeral uppercase, no stacked thirds.
        casing = {lower: false, diminished: false};
      } else {
        casing = caseFromParent(parentIndex, tonic, degreePc) ||
                 caseFromPan(pan, degreePc);
      }
      out[String(degreePc)] = num.accidental +
        (casing.lower ? num.roman.toLowerCase() : num.roman) +
        (casing.diminished ? "°" : "");
    }
    return out;
  }

  /* ---- section 8: the symmetric-set root tie-break ----------------------- */

  // DEFAULT: prefer the tonic, else the lowest scale degree. `degreeOrder`, when
  // given, is the pitch classes in scale-degree order; without it the order is
  // semitones ascending from the tonic.
  function symmetricRoot(candidateRootPcs, tonicPc, degreeOrder) {
    var candidates = uniquePcs(candidateRootPcs);
    if (!candidates.length) {
      throw new Error("naming: symmetricRoot needs at least one candidate");
    }
    var tonic = pc(tonicPc);
    if (member(candidates, tonic)) return tonic;
    var order = degreeOrder ? uniquePcsInOrder(degreeOrder) : null;
    var best = null;
    var bestRank = Infinity;
    for (var i = 0; i < candidates.length; i += 1) {
      var rank;
      if (order) {
        rank = indexOfPc(order, candidates[i]);
        if (rank < 0) rank = order.length + pc(candidates[i] - tonic);
      } else {
        rank = pc(candidates[i] - tonic);
      }
      if (rank < bestRank) { bestRank = rank; best = candidates[i]; }
    }
    return best;
  }

  function uniquePcsInOrder(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var value = pc(list[i]);
      if (!seen[value]) { seen[value] = true; out.push(value); }
    }
    return out;
  }

  function indexOfPc(list, value) {
    for (var i = 0; i < list.length; i += 1) if (list[i] === value) return i;
    return -1;
  }

  HPE.naming = {
    QUALITIES: QUALITIES,
    PARENTS: PARENTS,
    CAPS: {name: NAME_MAX, subtitle: SUBTITLE_MAX},
    name: name,
    subtitle: subtitle,
    numeral: numeral,
    inferParent: inferParent,
    parentDistance: parentDistance,
    degrees: degrees,
    symmetricRoot: symmetricRoot
  };
})(HPE);
