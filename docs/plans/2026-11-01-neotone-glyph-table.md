# Neotone glyph table (lane P2, measured)

Measured at fixture rev 3 (depth 1/3, `main.r` 0.19, `mutant.r` 0.19), print R = 61.8 pt, K8 glyph factors, by `HPE.pdfcards.neoPlan` with the same step-down the print drawer applies (0.1 pt steps, floor 3.6 / 0.66 = 5.4545 pt on a name so its octave digit stays at 3.6 pt). Each deck is converted with `HPE.layout.proposeProfile` and solved. Sizes are in points; geometry was not changed.

| Scale | Main name | Main octave | Main number | Ding name / octave | Lens name | Lens octave | M number | Lens cap | Widest lens name at fit | Glyphs under 3.6 pt |
|---|---|---|---|---|---|---|---|---|---|---|
| D Kurd 10 | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | - | - | - | - | - | none |
| D Amara 10 | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | - | - | - | - | - | none |
| D Amara 9 | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | - | - | - | - | - | none |
| C# Hijaz / Orion 9 | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | - | - | - | - | - | none |
| F3 Low Pygmy 18 (F5, G5 dropped) | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | 5.46 | 3.60 | 3.76 | 5.75 | 9.40 | none |
| Kurd 9 | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | - | - | - | - | - | none |
| Hijaz + 1 (B2) | 5.85 | 3.86 | 4.66 | 5.46 / 3.60 | 5.46 | 3.60 | 3.76 | 5.75 | 5.85 | none |

## Findings for the owner

- No glyph is under 3.6 pt on any converted scale. The tightest are the ding octave digit (3.602 pt) and the lens octave digit (3.604 pt). Lens labels on F Low Pygmy 18 are 5.461 pt (octave 3.604 pt), at the K8 factor, so the P2 acceptance of lens labels at or over 3.6 pt holds.
- The lens NAME does not fit the lens at depth 1/3. The lens cap is 1.47 x depth/2 = 5.75 pt; a name with its octave is up to 9.4 pt wide on the Pygmy lens notes (C3, Db3, Eb3, Bb3, Db4, Ab5) and 5.85 pt for B2 on Hijaz + 1. The fit step-down cannot shrink it below 5.4545 pt (octave floor 3.6 pt), so the name draws at 5.461 pt and is wider than the lens cap. Per the brief this is reported, not fixed: the options are a larger depth (geometry, owner), a smaller octave floor (print floor, owner), or accepting the overflow.
- F Low Pygmy 18 as shipped does not convert: its inner notes F5 and G5 give `PROFILE_FULL` (Neotone holds nine top and nine bottom notes and no inner notes), so the row above is the scale without F5 and G5, the same case as `tests/fixtures/profile_case_pygmy_v2.json`.
- The Pygmy fixture angles (fixture rev 3: 270, 230, 310, 190, 350, 150, 30, 110, 70) sit 20 degrees from the Chord Card's Pygmy angles (290, 250, 330, 210, 10, 170, 50, 130, 90). `tests/fixtures/neotone_card_reference.json` carries both and the K1 test compares with the 20 degree rotation applied.
