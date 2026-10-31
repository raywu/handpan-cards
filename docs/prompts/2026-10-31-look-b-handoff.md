# Prompt: build the Handpan Theory look (direction B), lane by lane

For a local Claude Code session on `raywu/handpan-cards`. Paste everything
below the line.

---

You are implementing an owner-approved design, one lane at a time. The
exploration and decisions are done; do not reopen them.

## Read first, in this order

All on branch `claude/eager-cerf-67cabq` (`git fetch origin
claude/eager-cerf-67cabq`); if it is already merged into `dev`, read them
there.

1. `CLAUDE.md` on `dev` (the rules; lanes, CI, tests, i18n).
2. `docs/plans/2026-10-31-look-around-the-cards.md`, section "Lanes for B"
   (your spec) and "Palette readability" (why).
3. `docs/brand/look/B/notes.md` and `B/app.css`, `B/pages.css`: the
   reference look. They are override CSS for a mock; in production you edit
   the real rules in `index.html` and `tools/gen_scale_page.py`, never add
   an override layer.
4. `docs/brand/look/mapping.md`: which existing value folds into which token.
5. `docs/brand/design-system/README.md` and `tokens.json`: the brand book
   (also published at https://claude.ai/artifact/93knqkDWTEUZe8iGLktZYB).
6. `docs/brand/look/README.md`: how to re-run the screenshot and contrast
   harness. The review page with every screen is
   https://claude.ai/artifact/WLJN6SePLb9kTzE8gdhAfp (owner's account; the
   harness reproduces it locally if you cannot open it).

## Owner decisions (2026-10-31)

- Direction **B** (brand board) plus C's light keyline on chip dots.
- Defaults stand unless the owner says otherwise: header lockup 64px, 48px
  below 740px viewport height; scale-page cards get the six drift fixes;
  light scale pages put the progression on a dark plate.
- Focus ring teal; app gold `#E3B25C` stays only as the warning/state
  colour; links are text-primary with a gold underline.
- Cards and the engine never change. No functional or SEO change.

## Do

1. Start lane **L1 (app chrome tokens)** from the latest `origin/dev` on
   `claude/look-b-chrome`. Follow the plan's L1 list exactly: CSS and the
   theme-color meta only.
2. Before editing, screenshot `dev` with the harness (baseline); after,
   screenshot again and compare against B's reference at 380px and 1280px,
   all five built-ins, settings, About, the scale sheet.
3. Update the pinned tests the plan lists, each with the reason "brand board
   tokens (look plan L1)"; regenerate mutant patches that only quote moved
   values; run the full suite the way `CLAUDE.md` and `docs/testing/` say.
4. Open PR M to `main` and PR D to `dev` from the same head, per `CLAUDE.md`
   "Release and CI gates". Stop there and report to the owner with
   before/after screenshots. Do not start L2 until the owner says so.

## Do not

- Ship the header lockup: it says "Handpan Theory" and belongs to the
  rebrand (`docs/prompts/2026-10-31-handpan-theory-rebrand-plan.md`, phase 1).
- Touch `src/engine/`, the engine regions, `data/`, card CSS or anything
  inside `.card`.
- Change a pinned value without saying in the PR which test moved and why.
