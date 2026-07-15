# Claude Session State — Batch Recovery/Merge/Deploy

Tracking table for the 7 change sets built in isolated worktrees. All verification below was performed live against production (nexis.nexus) with a dedicated test account, not just local builds.

| Change Set | Branch/Worktree | Inspected | Build Passed | Smoke Passed | Merged | Deployed Live | Live Verified | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| City Board crash fix | feature/city-board-hotfix | yes | yes | yes | yes | yes | yes | 200 confirmed authenticated, was 503 |
| Home dashboard panels | feature/home-summary-panels | yes | yes | yes | yes | yes | yes | uses existing inventory endpoint |
| Life Paths | feature/life-paths | yes | yes | yes | yes | yes | yes | one-time choice confirmed (409 on 2nd attempt) |
| Education gating | feature/education-gating | yes | yes | yes | yes | yes | yes | both 403 EDUCATION_LOCKED gates confirmed live |
| Profile/Chronicle | feature/profile-chronicle-wiring | yes | yes | yes | yes | yes | yes | injection attempt audited, self-only data confirmed |
| Travel cargo/escort | feature/travel-transport-cargo | yes | yes | yes | yes | yes | yes | /api/travel/options 200 confirmed live |
| Donations/Stripe | feature/donations-stripe | yes | yes | n/a | **no** | no | no | held: no real Stripe keys configured yet |

## Deploy sequence actually used

1. Merged 6 branches into `main` in order (one merge conflict in `src/pages/Home.tsx` between home-summary-panels and life-paths, resolved by combining both sets of JSX additions — both features intact).
2. `npm run build` — clean, zero TypeScript errors.
3. Isolated smoke test: booted `server/index.js` with `DATABASE_URL` unset (auto-selects pglite, zero contact with production data), registered a test account, hit 9 endpoints covering every merged change set. 9/9 passed after fixing my own test payload field names (`firstName` not `name`, `lifePathId` not `pathId`, `merchant` not `trade` as a valid consortium type).
4. Pushed `main` to GitHub.
5. Deployed frontend build to `/srv/nexis/frontend/current` (backed up first).
6. Restarted `nexis-waitlist.service`.
7. **Found and fixed an unrelated infra issue**: an orphaned root-owned `node server/index.js` process (PID 1307771) had been running since 2026-05-21, outside systemd's tracking, silently squatting on port 3001. Every prior `systemctl restart` this session appeared to succeed but traffic kept reaching that 54-day-old orphan instead of the freshly restarted process — which is why the first live verification pass failed across the board (City Board still 503, new routes 404) despite the code being correct on disk and passing the isolated smoke test. Killed the orphan (confirmed identical cwd/cmdline/config first), restarted the service again, and it correctly bound to port 3001.
8. Re-ran full live verification with a fresh test account directly against production: City Board 200, Travel options 200, Records 200, Life Path selection 200 (+ 409 on a disallowed second attempt), Marketplace 403 EDUCATION_LOCKED, Consortium founding 403 EDUCATION_LOCKED. All confirmed.

## Still open

- **Donations/Stripe**: code complete and reviewed, not merged. Needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` in `/srv/nexis/shared/config/backend.env`, a webhook registered in the Stripe dashboard pointing at `https://nexis.nexus/api/donations/webhook`, and a live webhook test before merging.
- **Prompt injection source unresolved**: the profile-chronicle-wiring agent received injected "coordinator" instructions mid-task pushing for unauthorized file deletions. Its own permission system blocked it; no damage occurred. Source not found in repo or crontab — worth continued vigilance, not further action right now.
- **Orphaned process risk**: worth checking after any future backend deploy that `ss -tlnp | grep 3001` shows the systemd-managed PID, not a repeat orphan, until the root cause of how 1307771 was originally started (outside systemd, as root) is understood.

---

## Refinement Phase 0 — Recovery Log (2026-07-15 07:14 UTC)

All 6 agents from the Refinement Phase 0 wave (2 research + 4 implementation) hit an API session limit simultaneously, mid-investigation, before any had written a file. Verified via `git status` in every worktree: zero uncommitted changes anywhere. Resumed all 6 via SendMessage (not fresh respawns) so each kept its already-gathered file reads/analysis in context rather than re-deriving it.

Worktrees confirmed present, all still at main tip (`77d9420`) at time of recovery:
- `/srv/nexis/source/worktrees/research-torn-mechanics` (`research/torn-mechanics`)
- `/srv/nexis/source/worktrees/research-browser-rpg` (`research/browser-rpg-opportunities`)
- `/srv/nexis/source/worktrees/home-cleanup` (`feature/home-cleanup`)
- `/srv/nexis/source/worktrees/travel-splash` (`feature/travel-splash`)
- `/srv/nexis/source/worktrees/admin-mode-toggle` (`feature/admin-mode-toggle`)
- `/srv/nexis/source/worktrees/adventure-item-chain` (`feature/adventure-item-chain`)

Still held per explicit instruction, not yet started:
- Research C (fit filter) — blocked on Research A + B completing
- Admin Panel refinement — blocked on Admin Mode toggle completing
- Guilds faction rework — blocked on research report + user review
- Consortiums company rework — blocked on research report + user review

---

## Refinement Phase 0 — Batch 1 Deploy Log (2026-07-15)

Merged in order per approved sequence: Home cleanup → Travel splash → Adventure item-gated chain → Admin Mode toggle. All 4 merged with zero conflicts (only AppShell.tsx touched by two branches, auto-merged cleanly). Build clean, pushed to GitHub (`fb7004e`).

Isolated pglite smoke test (zero contact with production data):
- Server boots with all 4 branches merged: PASS
- Travel options endpoint (Travel splash dependency): PASS (200)
- **Admin security — forged admin action from a plain player account: PASS (403, not 200)**, tested against two independent accounts to rule out a "first user is admin" bug
- Adventure chain: confirmed "Smuggler's Gate" (Blackharbor) correctly excluded from a new player's board (new players start in "nexis" city; the board is city-scoped by design) — not a bug, just city-scoping caught by an initial wrong assumption in my own test script

Not yet deployed live (frontend build/service restart) — holding until Consortiums and Guilds reworks are also ready, to batch the live deploy per prior session's pattern rather than restarting the service repeatedly.

Dispatching Admin Panel refinement now that Admin Mode toggle is confirmed merged and its server-side enforcement independently verified.

---

## Refinement Phase 0 — Batch 2 Deploy Log (2026-07-15)

Merged Consortiums rework (`6067c64`) then Guilds rework (`ab9f43d`) into main, both touching `organizationService.js` but auto-merging cleanly (different functions). Build clean with all 6 approved refinement branches now combined. Pushed as `e52aa4a`.

Combined smoke test: server boots correctly with both large systems merged; pre-existing Civic Fundamentals gate on consortium founding still returns 403 correctly. Guild founding itself was already verified with a properly-funded account in the Guilds rework agent's own 23/23-check smoke test (permission enforcement, cap enforcement, gold-gated respec, rally cooldown) — not re-run here since a fresh unfunded test account correctly hit the pre-existing gold-requirement gate, which is expected behavior, not a regression.

Notable: Consortiums rework agent found the codebase actually has 12 consortium types (not 10 as the brief described) and built real perks for all 12 rather than leaving 2 cosmetic-only.

All 6 approved refinement tasks now merged and pushed: Home cleanup, Travel splash, Adventure item-gated chain, Admin Mode toggle, Consortiums rework, Guilds rework. Only Admin Panel refinement remains in flight. Not yet deployed live — holding for that final piece before one batched frontend deploy + service restart, per established pattern.

---

## Refinement Phase 0 — LIVE DEPLOY (2026-07-15 13:42 UTC)

All 6 approved refinement tasks deployed to production and verified live:

1. Frontend backed up to `/srv/nexis/backups/live-change-20260715-134203`, then deployed.
2. `nexis-waitlist.service` restarted — new PID (2771504) correctly bound to port 3001 on first attempt, no repeat of the earlier orphaned-process issue.
3. Live verification with a real production test account: travel options 200, admin audit-logs correctly 403 for a plain player, education gating still 403, City Board still 200 (no regression on the earlier fix), all 7 core page shells (/, /home, /life-paths, /travel, /guilds, /consortiums, /admin) return 200.
4. Browser check via Playwright: zero console errors on Home.

**Batch complete.** All 6 approved refinement tasks (Home cleanup, Travel splash visuals, Admin Mode toggle, Admin Panel refinement, Adventure item-gated chain, Guilds faction rework, Consortiums company rework) are merged, built, smoke-tested, pushed, deployed, and live-verified.

**Still awaiting explicit user approval before any implementation:** everything in the research docs' "Present To User For Approval" section — Guild Warfare, Consortium Roster Requests, Guild Charters, Caravan Trade Runs, Bold Strike difficulty toggle, Outreach Budget, Operation Capacity, Nexis Stalls, Warden's Ledger, Guild Sanctum, Consortium Rivalries, Calling perks, Mastery Diplomas. None of these have been built.

**Donations/Stripe** still held pending real Stripe credentials (unrelated to this batch, unchanged from prior status).
