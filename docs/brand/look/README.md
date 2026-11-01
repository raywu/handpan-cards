# Look explorations (2026-10-31)

Evidence for `docs/plans/2026-10-31-look-around-the-cards.md`. The owner
picked **B**. Nothing here ships; the CSS files are mocks injected over the
real app, used as the reference for every value the lanes change.

- `A/`-`D/`: each direction's `app.css`, `pages.css`, `notes.md`.
- `cardmatch.md`: app vs scale-page card, every difference and the fixes.
- `mapping.md` / `mapping.json`: every chrome value, keep / token / drop.
- `shoot.js`, `measure.py`: the screenshot and palette-contrast harness.

## Re-running the mocks

The mock CSS loads logos from `/_look/logo/`. From a `dev` checkout:

```bash
git show claude/eager-cerf-67cabq:docs/brand/look/shoot.js > /tmp/shoot.js   # or copy from this branch
mkdir -p _look && cp -r <this branch>/docs/brand/logo _look/logo              # untracked; do not commit
python3 -m http.server 8765 &
node /tmp/shoot.js docs/brand/look/B/app.css out/b http://127.0.0.1:8765/ docs/brand/look/B/pages.css
python3 docs/brand/look/measure.py B "#0F0E0B" "#1A1814"
```

Gotchas: the app route is `#deck=d-amara-10` (slugs, not deck ids); at
1280px the settings panel is docked so `#settings-trigger` is hidden; the
scale-page flip checkbox needs `click({force:true})`.
