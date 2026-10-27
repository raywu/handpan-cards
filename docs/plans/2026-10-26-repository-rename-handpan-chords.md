# Repository rename: handpan-cards -> handpan-chords (simplified)

Status: **GATED on owner OK. Nothing here is executed.** Supersedes the 655-line
draft (in history). Never run `gh repo rename` or move
folders until the owner says go. Do not reuse the old slug afterwards (that kills
GitHub's redirect). Rename only; no product, storage or data change.

Preconditions at go time: no lane is mid-push; saved before-state:
`git worktree list --porcelain > ~/handpan-worktrees-before.txt` and
`git status --porcelain > ~/handpan-status-before.txt`; every open PR noted
(numbers survive the rename).

## 1. GitHub repo rename and redirect

Do: `gh repo rename handpan-chords --repo raywu/handpan-cards` (owner-run, or
Settings > General > Repository name).

Behaviour (GitHub docs): the old URL redirects web, git fetch/push and API to the
new name; issues, PRs, stars and the repo node ID are kept. Redirect is lost if
anyone creates a new `raywu/handpan-cards`. Project-site URLs (`raywu.github.io/...`)
are not redirected; we serve from the custom domain, so that is moot.

Verify:
- `gh repo view raywu/handpan-chords --json name,id,defaultBranchRef` -> name
  `handpan-chords`, same `id` as before (record it first).
- `curl -sI https://github.com/raywu/handpan-cards | head -1` -> `301`.
- `gh pr list --repo raywu/handpan-chords --state open` lists the same PRs.

### Pages custom domain (handpan.raywu.org) and Cloudflare DEV

Does not break:
- `handpan.raywu.org`: served by Pages from `main:/` with the repo's `CNAME` file
  (`handpan.raywu.org`). The DNS record is a proxied CNAME, visible only in the
  Cloudflare dashboard (public DNS shows Cloudflare A records); GitHub resolves
  Pages by domain, not by repo name. The repo name is not in any production URL, sitemap,
  canonical, og or JSON-LD value.
- Existing DEV deployment keeps serving old bytes.

Might break (unverified, check, do not assume):
- Cloudflare Pages project `handpan-cards-dev` (https://handpan-cards-dev.pages.dev/,
  built from `dev`) is bound to the repo through the Cloudflare GitHub App, which
  may or may not follow the rename. The Pages project name and `.pages.dev` host do
  NOT change on their own, so tests that name `handpan-cards-dev.pages.dev` stay
  correct. Do not rename or recreate the Cloudflare project in this plan.

Verify:
- `gh api repos/raywu/handpan-chords/pages --jq '.cname,.status'` -> `handpan.raywu.org`, `built`
- `curl -sI https://handpan.raywu.org/ | grep -E '^HTTP/[0-9.]+ (200|301)'` -> a match (Early Hints 103 can come first); `git show origin/main:CNAME` unchanged.
- Cloudflare dashboard > Workers & Pages > handpan-cards-dev > Settings > Builds:
  repository shows `raywu/handpan-chords`. Then use Cloudflare "Retry deployment" on `dev` (never push `dev`) and
  confirm a new deployment starts and `curl -sI https://handpan-cards-dev.pages.dev/ | grep -E '^HTTP/[0-9.]+ 200'`
  matches. If the binding is stale: reconnect the repo in that dashboard (owner);
  do not uninstall the shared GitHub App.

## 2. Git remote URL in clones and worktrees

All worktrees share one `.git` config, so one change covers them. Other clones
(laptop copies, CI boxes, dotfiles scripts) each need it.

Do (from the main checkout, after step 1):
`git remote set-url origin git@github.com:raywu/handpan-chords.git`

Verify:
- `git remote -v` -> both lines show `handpan-chords`.
- `git ls-remote --heads origin dev main | head` returns refs.
- In any linked worktree: `git -C <wt> fetch origin` succeeds.

## 3. Move ~/Projects/handpan-cards -> ~/Projects/handpan-chords

Only after steps 1-2 and a quiet window (no running agents, tests, or editors in the
tree). The main checkout cannot use `git worktree move`; move it by hand and repair.
Never `cp -r` it (the copy shares the git dir).

Do:
1. `[ ! -e ~/Projects/handpan-chords ] && mv ~/Projects/handpan-cards ~/Projects/handpan-chords`
   (same volume, so this is an atomic rename; refuse if the target exists).
2. `cd ~/Projects/handpan-chords && git worktree repair $(awk '/^worktree /{p=$2} /^prunable/{k[p]=1} /^$/{if(p&&!k[p])print p;p=""}' ~/handpan-worktrees-before.txt | sed -E "s#^$HOME/Projects/handpan-cards(/|\$)#$HOME/Projects/handpan-chords\1#")`
   (paths from the before-list, minus those flagged prunable, which would make
   `repair` abort at the first invalid path with exit 128; BSD sed, so no `\b`). Nested `.claude/worktrees/` trees
   moved with the folder; others still name the old path and need their new path
   passed. Locked or prunable trees: leave them, do not prune.
3. Update host tools by hand and only if they break: `~/.codex/config.toml` project
   path, `~/.claude.json` project entry (Claude auto-memory is keyed by path, so
   `/memory` may look empty under the new path; copy nothing until checked).

Verify:
- `git -C ~/Projects/handpan-chords worktree list` -> no `prunable` entries beyond
  the before-list's (`[ "$(git worktree list --porcelain | grep -c '^prunable')" = "$(grep -c '^prunable' ~/handpan-worktrees-before.txt)" ]`); every non-prunable path exists:
  `git worktree list --porcelain | awk '/^worktree /{p=$2} /^prunable/{k[p]=1} /^$/{if(p&&!k[p])print p;p=""}' | while read -r d; do test -d "$d" || echo "MISSING $d"; done` prints nothing.
- `git -C ~/Projects/handpan-chords status --porcelain | diff - ~/handpan-status-before.txt` is empty.
- `cd ~/Projects/handpan-chords && python3 tools/validate.py` passes, plus `node --test tests/core.test.js` as a smoke test.
- `ls ~/Projects/handpan-cards` -> No such file (no compat symlink; it would hide
  stale references).

## 4. In-repo references (checklist; none edited by this plan)

`grep -rIn "handpan-cards" . --exclude-dir=.git` found these outside the 64 files
under `docs/plans/` and `docs/prompts/` (historical records: leave as is, GitHub
redirects keep their links alive):

Change after cutover (owner-approved edit, own PR to dev):
- `README.md:39` clone URL -> `https://github.com/raywu/handpan-chords.git`
- `docs/agents/workflows.md:26` bootstrap prompt "In raywu/handpan-cards" -> new slug
- `docs/WORKSTREAMS.md:804` locator text only; its many
  `github.com/raywu/handpan-cards/pull|blob|actions` links (e.g. line 136) are
  immutable receipts and keep working through the redirect: leave.
- `docs/CLAUDE_RETURN_HANDOFF.md:114` and `docs/CLAUDE_TAKEOVER_PLAN.md:101`:
  do-not-reset guards naming `/Users/ray/Projects/handpan-cards`; update the path.
- `docs/DEVELOPMENT_CONTINUITY.md:26` ("historical" path): leave.

Do NOT change:
- `CLAUDE.md:851` and `tests/app.test.js:9557-9558`: they name the Cloudflare host
  `handpan-cards-dev.pages.dev`, which does not rename. (Editing CLAUDE.md needs
  separate owner approval anyway.)
- Storage/lock key `handpan-cards:saved-scales:v1` (WORKSTREAMS.md:571): renaming it would orphan users' saved
  scales. It is a name, not a URL.
- `TODOS.md:9` and `docs/SCALE_ENGINE_PLAN.md` gstack paths
  (`~/.gstack/projects/raywu-handpan-cards/...`) are private cache paths.
- `CNAME`, `robots.txt`, `sitemap.xml`, `_headers`, `index.html` URLs: none contain
  the repo name; verify with the grep below.

Verify (run in a fresh lane worktree, so the tree is clean):
- `grep -rIn "handpan-cards" . --exclude-dir=.git --exclude-dir=plans --exclude-dir=prompts | grep -v "handpan-cards-dev\|saved-scales\|raywu-handpan-cards"` -> after the edits, only the receipt links and "historical" lines named above remain.
- CI `validate` green at the head SHA of the reference-update PR.

## Rollback

1. Folder: `mv ~/Projects/handpan-chords ~/Projects/handpan-cards`, then
   `git worktree repair` with the before-list paths run from `~/Projects/handpan-cards`, prunable ones skipped, and no path rewrite (the before-list paths are already right).
2. Remote: `git remote set-url origin git@github.com:raywu/handpan-cards.git`
   (until step 3 the old URL resolves only through the redirect; step 3 makes it native).
3. GitHub: `gh repo rename handpan-cards --repo raywu/handpan-chords`. The new
   name then redirects to the old one; no data is lost, numeric ID is unchanged.
4. Revert the reference PR with `git revert`.
Verify: step-1 and step-2 verify commands with the names swapped.

## Order and gate
1 -> 2 -> (Cloudflare DEV check) -> 3 -> 4. Steps 1-3 are one sitting and one
operator. Step 4 goes through the normal dev-first lane. Execution needs an
explicit owner "go"; this document alone authorises nothing.
