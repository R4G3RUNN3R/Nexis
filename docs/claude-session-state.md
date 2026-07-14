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
