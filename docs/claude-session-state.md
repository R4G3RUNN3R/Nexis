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

---

## Codex concurrent-work discovery, round 2 (2026-07-17)

While my 10 background agents (8-item gameplay brief + 4 Codex-system reviews) were in flight, the user ran two more rounds of work through Codex directly on the live server, both merged straight to `main` without going through me:

**Commit `c073fe1` — "Stabilize onboarding guidance and state security."** This is the single most important security finding of the whole session. Before this commit, `server/services/stateService.js`'s `mergeRuntimeState` did an open merge of the client's PUT `/api/state` payload directly into the player's persisted `gold`, `stats` (health/energy/stamina/mana/etc.), `level`, `inventory`, `equipment`, `crafting`, `skills`, `records`, and most other player fields — i.e. any player who edited the request in devtools or replayed a crafted `/api/state` call could set their own gold, level, stats, or inventory contents. Codex rewrote it to a strict allowlist: the client can now only ever set `player.bio` (bio/signature/reservedNote), `player.preferences` (compactMode/reducedMotion/lastHelpTopic), and `player.ui` (dismissedGuideAt/lastCommandBriefAt, later extended for CIEL tutorial state) — every other field is 100% server-authoritative and silently ignored (with a `console.warn` audit log) if the client tries to send it. Also added: `originGuard` middleware (rejects unsafe-method requests from untrusted origins), `rateLimit` middleware, `requireRole` middleware (explicit admin/staff gates), API security headers, and `server/scripts/security-state-sync-canary.mjs` (a live canary that asserts the exploit stays closed). I independently read the full diff and confirm this is a real, serious fix for a real, serious pre-existing vulnerability — not just Codex's own claim.

**Commit `5d3c3bb` — "Add CIEL guided onboarding tutorial."** Turns the previously-decorative CIEL orb into a new-player guide: new registrations route through `/ciel-intro` before Home, a Home spotlight tutorial (identity/orders/activity/quick-actions/readiness/CIEL-feed/records steps) with Previous/Next/Skip, progress persisted server-side under the new `player.ui.cielTutorial` allowlisted field (own sanitizer, step-id enum-validated, capped array length). Existing CIEL orb can relaunch it. Touches `stateService.js` again (adds the `cielTutorial` sub-schema to the `ui` allowlist) and `runtimePlayerState.js` (hydrates `preferences`/`ui` into the mutable runtime state read path).

**Impact assessment on my 6 in-flight gameplay-brief worktrees** (all branched from `e9227d1`, now 8 commits behind `main`): I audited the three highest-risk ones directly (mana-system, titles-system, academy-access-pause all persist new player-level state) rather than trusting their self-reports:
- **mana-system**: has an uncommitted 2-line diff to the *old* `stateService.js` (adding `mana`/`maxMana` to the old `RECOVERY_STAT_KEYS` bar-preservation list). That whole mechanism no longer exists in the new allowlist architecture — this hunk is now moot and needs to be dropped on rebase, not reapplied. Told the agent this directly.
- **titles-system**: architecturally clean and, independently, very well designed — title bonuses are computed fresh into separate `effectiveStats`/`effectiveWorkingStats`/`effectiveBattleStats` on every read and are explicitly never folded into the persisted base stats (own code comment explains why: would bake a temporary bonus into the permanent base). Equip/unequip goes through dedicated authenticated `titleController.js` endpoints (`equipTitleForUser`/`unequipTitleForUser`), not the generic state sync. `resolveEquippedTitleForRuntime` re-validates an exclusive title's owner server-side on every read, so a forged/stale `equippedTitleId` can never leak an exclusive title's bonus (e.g. The Absolute) onto the wrong account. No corrective action needed, just a mechanical rebase onto new `main`.
- **academy-access-pause**: architecturally clean — new `server/lib/academyStudyState.js` module is dependency-free and explicitly designed to be driven by server-side city/travel events (presence-based accrual, freezes on travel, resumes on return), not client-pushed. `cityAcademy` was already on the client-blocked field list pre- and post-hardening. No corrective action needed, just a mechanical rebase.
- **nav-chrome-restructure**: touches `TopBar.tsx` in the same region Codex's security commit touched (readiness badge, command brief). Real but survivable textual merge conflict expected at integration time; already flagged to the agent to report whether its changes are additive or a full replacement.

All 9 of the other in-flight agents independently hit an account-wide Claude API session limit (reset 12:10pm UTC) at almost the same moment this Codex work landed — so "pause all agents" (the user's explicit instruction on discovering this) was already true in practice. Verified `git merge-base`/`git status -sb` show `main` still linear and clean, no divergence from `origin/main`, before and after this analysis.


---

## Combined deploy + recovery protocol + Ticket 1 (2026-07-17, later)

**Combined deploy live-verified**: public-ID fix (`270b1f8`) + Google auth (`f48c885`) restarted into production together. Verified against the live site itself, not just tests: sequential public-ID allocation confirmed live, `PUT /api/state` exploit attempt against production left gold untouched, admin endpoint 403s a normal player, Google config endpoint correctly reports unconfigured. Zero auth errors in logs since restart.

**Map/quest blank-page bug (user-reported) — found and fixed (`413abd5`)**: excursion board frontend (Jobs.tsx, ServerExcursionBoard types) was written against an imagined response shape that never matched `excursionService.js`'s real output (`origin.cityName` vs real `currentCityName`/`originBox`, `location.region/risk/shortSummary` vs real `regionId/riskBand/summary`, `location.rewards.*` vs real `chanceSummary.*`, a `location.recipe` object that doesn't exist). Any render of a populated board crashed silently - exactly the reported symptom from clicking a map excursion marker. Fixed both the types and the render logic; reproduced the exact user-reported flow live in a browser before and after.

**Recovery protocol executed**: classified all 30 worktrees/branches without merging any. Six old branches confirmed already on `main`. Four review-agent worktrees (excursion/oneshots/pvp-worldprogression/wiki-topbar) had zero commits except wiki-topbar (`3c5a502`, real, safe, not yet reintegrated - Ticket 10). Five gameplay-brief worktrees (mana/titles/academy-pause/nav-chrome/org-ui-simplify) have substantial real uncommitted work, none reliant on the old permissive `/state` sync (independently confirmed for the three highest-risk ones in the previous session). `nav-chrome-restructure` and `org-ui-simplify` directly overlap Codex's CIEL-tutorial and Organization-One-Shots commits respectively - deep conflicts, not simple merges, when their tickets come up.

**Ticket 1 (PvP fairness / Life-Health privacy) complete** (`3139c55`): recovered an interrupted review agent's unfinished "hydration bug" lead and traced it to root cause - `buildMutableRuntimeState` never hydrated `pvpProfile`/`cityDiaries`/`qualities`/`worldEventProfile`/`excursions`/`lootPity`, so any unrelated gameplay save silently wiped them (player_snapshot is a full-replace column). Fixed at the source. Separately found and fixed a real Life/Health leak: duel results exposed the opponent's true `maxHealth` to both participants, immediately and in persisted history, via `resolveCombat`'s shared NPC/player result shape. Fixed with viewer-aware redaction. Re-verified all previously-fixed Life/Health scoping (profile self/admin-only, guild/consortium rosters, City People listing) is still intact after all subsequent session work. Duel safety properties (consensual, same-city gated, self-challenge blocked, no full-loot, double-resolution-protected under concurrency) verified, all correct, no changes needed there. 21 new automated checks across 2 new canaries.

**Not yet deployed**: both the map fix and Ticket 1 fix are committed and pushed, held for explicit deploy approval per the recovery protocol's standing rule.

**The Absolute**: still on hold pending the required written design review; not started.

Next per the user's specified order: Ticket 2 (Mana persistence/regeneration), using the now-fixed hydration function.

---

## Ticket 0 — Close the Pending Release (2026-07-17, deployed)

Deployed `413abd5` (excursion field-mismatch fix) and `3139c55` (PvP fairness: duel Life/Health redaction + runtime-hydration fix), previously committed but undeployed. Live commit determined precisely by comparing `nexis-waitlist.service`'s `ActiveEnterTimestamp` against commit timestamps, not by trusting prior session claims.

**Pre-deploy checks**: `git diff --check` clean, `node --check` on all changed backend files, full `npm run build`, 9 canaries (94+ checks: public-ID allocation, Google auth configured/unconfigured, runtime hydration, PvP fairness, excursion grid, PvP/world/org one-shot scaffold, one-shot catalog, wiki coverage) all pass. One pre-existing broken canary found and recorded, not fixed (out of scope): `server/scripts/canaries/consortium-property-office-canary.mjs` has a doubled path in its own import (`../../server/db/pool.js` resolves to `server/server/db/pool.js`), confirmed via `git log` to predate this session entirely (commit `2adb24d`).

**Deploy**: frontend backed up to `/srv/nexis/frontend/backups/ticket0-pre-deploy-20260717-201835`, fresh build from HEAD `abfc09b` rsynced to `/srv/nexis/frontend/current`, confirmed `index.html`'s referenced hashes (`index-CN1nBIGc.js`, `index-CCayB4bQ.css`) match the files on disk. `nexis-waitlist.service` restarted at 20:21:56 UTC, MainPID confirmed as the actual port-3001 listener.

**Post-deploy verification against https://nexis.nexus itself** (not an isolated instance): direct `/adventure` and query-param routes (valid and invalid excursion IDs) all zero console errors; World Map marker → excursion via a real click, zero errors, real content rendered; excursion started through the browser survived navigating to Home and back (the hydration bug, live); `pvpProfile` safety opt-in and the active excursion both survived a real `/api/me` call on a live production account; a full two-account duel (fresh registrations, real HTTP) confirmed Life/Health redaction correct from both participants in both the immediate accept response and persisted history after a fresh GET (reload). Service and nginx logs clean since restart. `security-state-sync-canary.mjs` run directly against `https://nexis.nexus/api` passed. `HEAD` (`abfc09b`) matches `origin/main` exactly.

**Deferred finding (new)**: the Arena page's duel-accept handler (`ServerCombatBoard.tsx`) receives `result` from `respondServerDuel` but never calls a state setter with it, so the inline "Live Combat" result panel never renders after accepting a duel (only after sparring an NPC). Pre-existing, not caused by this deploy - confirmed the redaction logic itself is correct via direct API verification (the "Recent Duel History" text summary that does render doesn't show health values at all, so this gap doesn't currently expose anything, it just means one UI surface doesn't yet render the correct data it would need to).

**Not deployed / out of scope for Ticket 0**: everything in Tickets 1-15 of the new mega-brief (Adventure blank-screen edge cases beyond the excursion fix, character image, World Map zoom, City redesign, Civic Jobs, one-shot diversification, nav dedup, Settings, rate limiting, route surface cleanup, CI, Google production activation). None of the 30 worktrees touched.

---

## Ticket 3 — Character Image Regression → Incident Containment and Permanent Storage Repair (2026-07-17/18, deployed)

Ticket 3 started as a UI regression investigation (character portrait not rendering) and became a self-reported production data-loss incident during that investigation, reported to the user immediately and fully before any code was touched. Full detail: `docs/incident-profile-image-data-loss-20260717.md`.

**Root cause**: profile images were stored at `process.cwd()/.data/profile-images` - the same parent directory as `.data/pglite`, the disposable test database. The isolated-test pattern used dozens of times earlier this session (`rm -rf .data && unset DATABASE_URL && node server/index.js`) deleted real uploads every time it ran, because it was always run in the production checkout. Confirmed impact via direct database query, not estimate: 126 total accounts, exactly 1 profile-image database record ever created, exactly 1 file confirmed missing, affected public ID **P1000000**. No backup/snapshot mechanism existed; the lost file content is not recoverable. The database record itself was preserved untouched throughout, per explicit instruction.

**Fix, committed as `e636a4c`**:
- `server/lib/profileImageStorage.js` (new): resolves durable storage from `PROFILE_IMAGE_STORAGE_DIR`; refuses to silently fall back into the checkout when a real database is configured; disables uploads with a clear log line if misconfigured, rather than crashing or guessing a path.
- `server/lib/safeTestCleanup.js` (new): `assertSafeTestDeletePath` / `createIsolatedTestDir` - test cleanup can now only ever delete genuine `mkdtemp` directories under the OS temp dir; explicitly rejects `.data`, the repo root, and the production upload directory. 18 regression checks proving every dangerous path class is rejected.
- `server/services/profileService.js`: uses the new durable-storage resolver instead of a hardcoded `.data`-relative path; added self-only `portraitFileMissing` detection (checks the file on disk, only computed for the authenticated owner's own view).
- `PlayerAvatar.tsx` / `Profile.tsx`: graceful `onError` fallback to initials instead of a broken-image icon, plus a compact self-only notice ("Your previous profile image is no longer available. Please upload it again.") shown only to the affected account.
- `docs/live-operations-runbook.md`: new "Persistent Upload Storage" section with backup/restore procedure and the `rm -rf .data` warning.
- 39 new automated checks across 2 new canaries, all passing pre-deploy.

**Deploy**: pre-deploy backup at `/srv/nexis/backups/ticket3-deploy-20260718-080927` (source, deployed frontend, systemd/env config, empty durable-dir snapshot, profile-image DB record snapshot). `PROFILE_IMAGE_STORAGE_DIR=/srv/nexis/shared/profile-images` set only in `backend.env` (no unit/drop-in file changed, so no `daemon-reload` needed); directory created `nexis:nexis` `750`, write-tested as the `nexis` user before deploy. Built and deployed from `e636a4c`; `nexis-waitlist.service` restarted, confirmed owning port 3001, startup log confirms `Profile image storage ready at /srv/nexis/shared/profile-images`, and the running process's actual environment has the variable set.

**Deferred finding (new, unrelated to this ticket's code, surfaced during its deploy)**: nginx's catch-all route and the literal `/` route both serve `index.html`, not `app.html` - checked two months of historical deploy backups and confirmed `index.html` has always been a full copy of the Vite SPA build, never a distinct public landing page as the runbook previously (incorrectly) documented. Deploying only to `app.html`, as the old runbook instructed, would have left this fix unreachable from the real entry point, so both files were updated identically for this deploy. Runbook corrected in place; real redesign of the routing/landing-page split is out of scope for Ticket 3 and needs its own ticket.

**Live verification against https://nexis.nexus itself**, using two fresh throwaway accounts (Alice TicketThreeTest / P1000170, Bob TicketThreeTest / P1000171) plus direct inspection of Hennet's real profile page: valid upload, invalid MIME, invalid magic bytes, oversized upload (multer route-level limit), and path traversal (both URL-normalized and Express-routed attempts) all correctly rejected or handled; replacement-upload cache-busting confirmed (different URL each time); uploads persist through a hard reload and a real logout/login cycle; another account cannot replace a different account's image even with crafted extra request parameters; public/API responses never expose the storage directory path or internal account IDs, and `selfProfile` (which carries `portraitFileMissing`) is `null` for every non-self viewer. The missing-file fallback and self-only notice were verified on all four required surfaces (left identity panel, top-right identity control, account dropdown, Profile page) using a synthetic "record exists, file missing" throwaway account (Bob's own upload deleted server-side before any browser ever fetched it, to avoid the 5-minute HTTP cache masking the real post-deletion state) - zero broken-image icons, exactly one failed request per surface with no growth/retry loop. Hennet's own database record and profile were separately confirmed unchanged and now render the same graceful fallback. Service and nginx logs clean throughout. `HEAD` (`e636a4c`) matches `origin/main` exactly; deployed frontend bundle hash matches the local build output.

**Not recovered**: the original lost image content for P1000000. Not attempted: any raw-disk/filesystem recovery tooling, per explicit instruction. The affected player must re-upload through the normal authenticated flow; they will see the self-only notice until they do.

**Per user instruction, stopping after Ticket 3.** Not begun: Ticket 4 or any other item from the numbered queue.
