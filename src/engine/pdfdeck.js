// A generated deck, adapted into the shape the print card builders read.
//
// The engine emits a pan: fields, geometry, chords, colours. hifi's card
// builders read about twenty keys the engine knows nothing about - the title
// line, the credit, the blurb, the legend copy, the diagram radius, the two
// text baselines. tools/decks.py:354 `from_generated` synthesises those on the
// Python side, and this is a statement-for-statement port of it, because a
// browser deck that drew from a second, independently written adapter would
// diverge from the print pipeline in exactly the places nobody looks.
//
// `blank_cards` is deliberately absent, for the reason decks.GENERATED_OMITTED
// records: how many write-your-own cards a person wants is a preference, not
// something derivable from a scale.
var HPE = (typeof HPE !== "undefined") ? HPE : {};
HPE.pdfdeck = (function () {
  "use strict";

  // The diagram band on the card, in points from the card's bottom edge
  // (tools/decks.py:167). R is whatever radius makes the furthest drawn
  // element reach the edge of that band, and the pan is centred in it.
  var BAND_LOW = 50.0;
  var BAND_HIGH = 198.0;
  var BAND_CY = (BAND_LOW + BAND_HIGH) / 2.0;
  var BAND_HALF = (BAND_HIGH - BAND_LOW) / 2.0;
  var Y_NOTE = 30.0;
  var Y_NUM = 14.0;

  // Python's round() is banker's - it breaks a tie to the even digit - and
  // Math.round is half-up. R = round(BAND_HALF / ext, 1), and a 0.1 pt
  // disagreement there moves every field on the diagram.
  //
  // Scaling by a power of ten and testing for .5 is NOT the port: it gets 1.05
  // wrong. Python rounds the double's EXACT value, and the double nearest 1.05
  // is 1.05000000000000004441, which is above the tie, so Python returns 1.1
  // while x*10 lands on exactly 10.5 and a scaled test calls it a tie and
  // returns 1.0. toFixed(20) is the exact expansion to more places than any
  // input here carries, so the tie test is made on the same digits Python sees.
  function bankers(x, digits) {
    var d = digits || 0;
    if (!isFinite(x)) return x;
    var neg = x < 0;
    var s = Math.abs(x).toFixed(20);
    var dot = s.indexOf(".");
    var whole = s.slice(0, dot) + s.slice(dot + 1, dot + 1 + d);
    var rest = s.slice(dot + 1 + d);
    var up;
    if (rest[0] > "5") {
      up = true;
    } else if (rest[0] < "5") {
      up = false;
    } else if (/[1-9]/.test(rest.slice(1))) {
      up = true;
    } else {
      // An exact tie: the even digit wins, which is the half of Python's rule
      // Math.round does not have.
      up = (Number(whole[whole.length - 1]) % 2) === 1;
    }
    var n = Number(whole) + (up ? 1 : 0);
    var out = n / Math.pow(10, d);
    return neg ? -out : out;
  }

  function hexColor(value) {
    var s = String(value).replace(/^#/, "");
    if (s.length !== 6) throw new Error("not a #RRGGBB colour: " + value);
    return [parseInt(s.slice(0, 2), 16) / 255.0,
            parseInt(s.slice(2, 4), 16) / 255.0,
            parseInt(s.slice(4, 6), 16) / 255.0];
  }

  function fieldIds(spec) {
    return Object.keys(spec).filter(function (k) { return k !== "_geom"; });
  }

  function zoneIds(spec, zones) {
    return fieldIds(spec).filter(function (k) {
      return zones.indexOf(spec[k][3]) >= 0;
    });
  }

  function specFrom(generated) {
    var spec = { _geom: {} };
    Object.keys(generated.geom).forEach(function (k) {
      spec._geom[k] = generated.geom[k];
    });
    Object.keys(generated.fields).forEach(function (fid) {
      spec[String(parseInt(fid, 10))] = generated.fields[fid].slice();
    });
    return spec;
  }

  function numericSort(ids) {
    return ids.slice().sort(function (a, b) { return Number(a) - Number(b); });
  }

  function blurb(spec, chordCount, warnings) {
    function line(zones) {
      return numericSort(zoneIds(spec, zones)).map(function (k) {
        return spec[k][0] + spec[k][1];
      }).join("  ");
    }
    var ding = zoneIds(spec, ["ding"]);
    var head = ding.length ? spec[numericSort(ding)[0]][0] +
                             spec[numericSort(ding)[0]][1] + "  |  " : "";
    var out = [head + line(["rim", "inner"])];
    var bottom = line(["bottom"]);
    if (bottom) out.push("BOTTOM:  " + bottom);
    out.push(chordCount + " CHORD" + (chordCount !== 1 ? "S" : "") +
             " - ONE CARD PER CHORD");
    // A warned pan would otherwise print with no sign anywhere on the sheets
    // that the app had flagged it; the engine's own reason string, verbatim.
    warnings.forEach(function (w) { out.push(String(w.reason).toUpperCase()); });
    return out;
  }

  function legendLines(spec, hasBottom) {
    var tops = zoneIds(spec, ["rim", "inner"]);
    var bottoms = zoneIds(spec, ["bottom"]);
    var lines = [];
    if (hasBottom) {
      // hifi.legend_card prints the FIRST line in the bottom-shell accent when
      // has_bottom, so the bottom-note line has to lead.
      lines.push("U1 - U" + bottoms.length +
                 ": BOTTOM NOTES, X-RAY VIEW (SEEN FROM ABOVE)");
    }
    lines.push("NOTE NAME + OCTAVE INSIDE EACH TONEFIELD");
    lines.push("TONEFIELD NUMBERS RUN 1 - " + tops.length + " FROM THE LOWEST " +
               (hasBottom ? "TOP " : "") + "NOTE");
    return lines;
  }

  function legendDemo(spec, chords) {
    if (chords.length) {
      var c = chords[0];
      var root = c[3].filter(function (f) { return c[4].indexOf(f) >= 0; })[0];
      var other = c[3].filter(function (f) { return f !== root; })[0];
      return [other === undefined ? root : other, root];
    }
    var ids = numericSort(fieldIds(spec)).map(Number);
    return [ids[ids.length - 1], ids[0]];
  }

  function fromGenerated(payload) {
    var generated = payload && payload.deck ? payload.deck : payload;

    var spec = specFrom(generated);
    var chords = generated.chords.map(function (c) {
      return [c.main, c.sup, c.subtitle, c.fields.slice(), c.roots.slice()];
    });
    var hasBottom = zoneIds(spec, ["bottom"]).length > 0;
    var warnings = (generated.warnings || []).slice();

    var root = hexColor(generated.colors.root);
    var tone = hexColor(generated.colors.tone);

    // Read, not .get(): a missing or renamed `ext` used to fall back to 1.0,
    // which silently gave every deck R = 74.0 - on a bottom-shell pan that
    // draws the diagram over the header and off both edges of the card with
    // nothing red. A throw at the point of use is the right failure.
    if (!(generated.geom && "ext" in generated.geom)) {
      throw new Error("generated deck has no geom.ext");
    }
    var ext = generated.geom.ext;
    var name = generated.name;
    var tops = zoneIds(spec, ["rim", "inner"]);
    var bottoms = zoneIds(spec, ["bottom"]);

    var degrees = {};
    Object.keys(generated.degrees).forEach(function (pc) {
      degrees[String(parseInt(pc, 10))] = generated.degrees[pc];
    });

    return {
      // --- identity and card copy ---------------------------------------
      title: name + " - Chord Cards",
      name: name,
      sub: hasBottom ? (tops.length + " + 1 TOP  /  " + bottoms.length +
                        " BOTTOM")
                     : (tops.length + " + 1"),
      credit: name.toUpperCase(),
      blurb: blurb(spec, chords.length, warnings),
      legend_lines: legendLines(spec, hasBottom),
      legend_demo: legendDemo(spec, chords),
      // --- data -----------------------------------------------------------
      spec: spec,
      chords: chords,
      degrees: degrees,
      has_bottom: hasBottom,
      // Carried, not dropped: the adapter is not where a warning goes to die.
      warnings: warnings,
      // --- geometry and baselines ------------------------------------------
      R: bankers(BAND_HALF / ext, 1),
      cy: BAND_CY,
      y_note: Y_NOTE,
      y_num: Y_NUM,
      // --- palette ----------------------------------------------------------
      col_root: root,
      col_tone: tone,
      grad: [root, tone]
    };
  }

  // A built-in deck (data/decks.json, embedded in index.html as `const
  // DECKS`) plus its `print` key -> a hifi.build-shaped deck dict. A
  // statement-for-statement port of tools/decks.py:_from_canonical, for the
  // reason fromGenerated ports from_generated: a browser deck that drew from
  // a second, independently written adapter would diverge from the print
  // pipeline in exactly the places nobody looks.
  //
  // NOT fromGenerated(): a built-in geom carries no `ext`, and R/cy/y_note/
  // y_num are the measured literals in `overlay`, not derived from a solver
  // reach. The colours are already the committed three-decimal [r, g, b]
  // arrays JSON carries them as - no hexColor() conversion, unlike
  // fromGenerated, which starts from a "#RRGGBB" string.
  function fromBuiltin(deck, overlay) {
    var spec = { _geom: {} };
    Object.keys(deck.geom).forEach(function (k) { spec._geom[k] = deck.geom[k]; });
    Object.keys(deck.fields).forEach(function (fid) {
      spec[String(parseInt(fid, 10))] = deck.fields[fid].slice();
    });

    var chords = deck.chords.map(function (c) {
      return [c.main, c.sup, c.subtitle, c.fields.slice(), c.roots.slice()];
    });
    var hasBottom = zoneIds(spec, ["bottom"]).length > 0;

    var degrees = {};
    Object.keys(deck.degrees).forEach(function (pc) {
      degrees[String(parseInt(pc, 10))] = deck.degrees[pc];
    });

    var shared = {
      name: deck.name,
      sub: deck.sub,
      spec: spec,
      chords: chords,
      degrees: degrees,
      has_bottom: hasBottom
    };

    var clash = Object.keys(overlay).filter(function (k) {
      return Object.prototype.hasOwnProperty.call(shared, k);
    });
    if (clash.length) {
      throw new Error((deck.id || deck.name) +
                      ": print overlay shadows canonical data: " +
                      clash.sort().join(", "));
    }

    var out = {};
    Object.keys(shared).forEach(function (k) { out[k] = shared[k]; });
    Object.keys(overlay).forEach(function (k) { out[k] = overlay[k]; });

    // The chord count in the blurb's last line is DERIVED from the deck's
    // own chord list, not hand-typed - a hand-typed literal goes stale the
    // moment a chord is added or removed (Pygmy shipped "25 CHORDS" after it
    // grew to 52). String.replace with a bare regex replaces only the FIRST
    // match; Python's re.sub replaces every one, so this needs the /g flag
    // or a last line carrying two numbers substitutes only one of them.
    if (out.blurb) {
      var lines = out.blurb.slice();
      lines[lines.length - 1] = lines[lines.length - 1]
        .replace(/\d+(?=\s*CHORDS)/g, String(chords.length));
      out.blurb = lines;
    }

    // Reviewer nit from W1a: `print.blank_cards` is nested, but
    // src/engine/pdfcards.js reads the top-level `deck.blank_cards`. Lift it
    // so Pygmy's 7 blank cards are not silently dropped from the full PDF.
    if (Object.prototype.hasOwnProperty.call(overlay, "blank_cards")) {
      out.blank_cards = overlay.blank_cards;
    }

    return out;
  }

  return {
    fromGenerated: fromGenerated,
    fromBuiltin: fromBuiltin,
    bankers: bankers,
    hexColor: hexColor
  };
}());
