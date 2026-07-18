# Incident Report: Profile Image Data Loss

**Discovery time:** 2026-07-17, during Ticket 3 (Character Image Regression) investigation, before any code was modified.

**Status:** Contained and deployed to production 2026-07-18. Root cause fixed and live-verified. Lost file content is not recoverable.

## Root cause

Production profile images were stored on the live filesystem at:

```
/srv/nexis/source/NexisGame/.data/profile-images/
```

This path is `process.cwd()/.data/profile-images`, where `process.cwd()` for the live `nexis-waitlist.service` is the source repository root (`WorkingDirectory=/srv/nexis/source/NexisGame` in the systemd unit). The `.data/` directory is gitignored and also houses `.data/pglite`, the disposable in-memory-compatible database used for isolated backend testing whenever `DATABASE_URL` is unset.

Throughout this session's testing work (public-ID allocation, Google authentication, PvP fairness, and excursion fixes), the standard pattern used for isolated backend verification was:

```
cd /srv/nexis/source/NexisGame && rm -rf .data && unset DATABASE_URL && node server/index.js
```

The intent was to clear only the disposable pglite database before each isolated run. Because `rm -rf .data` deletes the entire `.data/` directory rather than only `.data/pglite`, and because this command was run directly in the production checkout (the same working directory the live service uses), it also deleted `.data/profile-images/` - real, persistent, uploaded player images - every time it ran. This happened repeatedly across the session.

## Exact destructive command pattern

```bash
rm -rf .data
```

...executed with `process.cwd()` equal to `/srv/nexis/source/NexisGame` (the live service's working directory), with no path validation and no distinction between disposable test data (`.data/pglite`) and persistent production data (`.data/profile-images`).

## Affected storage path

`/srv/nexis/source/NexisGame/.data/profile-images/` - confirmed non-existent at time of discovery. The parent `.data/` directory itself does not exist at all.

## Impact (exact, not estimated)

Queried every account's `player_state.player_snapshot->'portrait'` field directly:

- **Total accounts in the game:** 126
- **Total profile-image database records (accounts that ever uploaded an image):** 1
- **Files confirmed present on disk:** 0
- **Files confirmed missing:** 1
- **Affected public player ID:** P1000000

Only one account in the entire game had ever uploaded a profile image. No other account's upload was lost, because no other account had one.

## Recovery limitations

Checked for any possible recovery path before concluding none exists:

- No backup or snapshot tool present on the server (no rsnapshot, borg, restic, duplicity).
- No LVM or btrfs snapshots (plain ext4 on `/dev/sda1`).
- `/lost+found` empty (would only be populated by `fsck` recovering orphaned inodes after filesystem corruption, not by ordinary `rm`).
- Filesystem-wide search for the exact filename and for any stray `.jpg` copies under `/srv/nexis/source` found nothing.
- Substantial disk write activity occurred between the deletion and discovery (many subsequent test runs, builds, and deploys), meaning even specialized raw-disk undelete tooling would very likely fail at this point and was not attempted given the risk of running such tools against a live production disk for near-zero expected benefit.

**The deleted image content is not recoverable.** The affected player must re-upload a replacement through the normal authenticated upload flow.

## Database record preservation

The database record for P1000000 (`imageKey`, `mimeType`, `updatedAt`) was **not modified or deleted** as part of this incident response, per explicit instruction, in case a copy is later found through some channel outside this server. A CSV snapshot of all profile-image database records (at the time of discovery: the single P1000000 record) was taken before any further changes, at `/srv/nexis/backups/incident-profile-images-20260717/portrait-records-backup.csv`.

## Containment steps taken (this ticket)

1. Confirmed exact impact via direct database query (see above) before changing any code.
2. Backed up the affected database record(s).
3. Relocated profile-image storage to a durable path outside the source repository and outside all test-data directories: `/srv/nexis/shared/profile-images` (configurable via `PROFILE_IMAGE_STORAGE_DIR`).
4. Replaced the blanket `rm -rf .data` test-cleanup pattern with a validated, temp-directory-scoped mechanism that refuses to ever target `/srv`, the repository root, `.data`, the production upload directory, or an empty/unresolved path.
5. Added a graceful missing-file fallback so a missing image can never again produce a broken-image icon, retry loop, or request flood.
6. Added a self-only notice for the affected account explaining the image needs to be re-uploaded.

See the accompanying ticket commit and `docs/claude-session-state.md` for full implementation detail.

## Deployment and live verification (2026-07-18)

Deployed to production as commit `e636a4c` (backend restart + frontend rebuild).
Pre-deploy backup: `/srv/nexis/backups/ticket3-deploy-20260718-080927` (source,
deployed frontend, systemd/env config, empty durable directory snapshot,
profile-image DB record snapshot).

Confirmed at deploy time:

- `PROFILE_IMAGE_STORAGE_DIR=/srv/nexis/shared/profile-images` is set only in
  `/srv/nexis/shared/config/backend.env` (loaded via the pre-existing
  `10-env.conf` drop-in) - no unit file changed, so `daemon-reload` was not
  required.
- The durable directory exists, is owned `nexis:nexis`, mode `750`, and the
  `nexis` user can create and read files there.
- `.data/` contains only the disposable `pglite` test database - no
  `profile-images` subdirectory exists there anymore.
- The running service process's actual environment (`/proc/<pid>/environ`)
  has `PROFILE_IMAGE_STORAGE_DIR` set to the durable path, and its own
  startup log confirms `Profile image storage ready at
  /srv/nexis/shared/profile-images`.

**Unrelated deployment-infrastructure finding surfaced during this deploy**
(pre-existing, not caused by this ticket - recorded as a Deferred Finding in
the Ticket 3 final report): nginx's catch-all route (`location /`) and the
literal `/` route both serve `/srv/nexis/frontend/current/index.html`, not
`app.html`, for any request that isn't the exact `/app.html` path - meaning
`index.html` (not `app.html`) is the real primary entry point for direct
navigation and deep links in production today. This contradicts this
runbook's own "Routing Contract" section below, which describes a genuine
separate public-landing-page/app-shell split that was checked against two
months of historical deploy backups and never actually existed - `index.html`
has always been a full copy of the Vite SPA build. Following the
documented "deploy only to app.html" procedure literally on 2026-07-18 would
have left this fix unreachable from the real entry point, so both files were
updated identically for this deploy (restoring the two-months-standing
pattern of keeping them in sync). This routing/documentation mismatch is
out of scope for Ticket 3 and is flagged for separate follow-up.

Live verification performed against `https://nexis.nexus` itself (not an
isolated instance), using two fresh throwaway test accounts (`Alice
TicketThreeTest` / P1000170 and `Bob TicketThreeTest` / P1000171) plus
direct inspection of Hennet Uthellien / P1000000's real, live profile page.
Full results are in the Ticket 3 final report. Summary: valid upload,
invalid MIME, invalid magic bytes, oversized upload, and path traversal are
all correctly rejected; replacement upload cache-busting works; uploads
persist through hard reload and a real logout/login cycle; another account
cannot replace a different account's image even with crafted extra request
parameters; the public/API responses never expose the storage directory
path or internal account IDs; and the missing-file fallback renders
correctly with zero broken-image icons and no repeated network requests.
**Hennet's public fallback was verified directly** on her real, live
profile page. **The authenticated self-only missing-image notice could not
be verified on Hennet's own account directly** (her login credentials were
never available to this session) **and was instead verified using a
structurally equivalent test account** (Bob, placed into the identical
"record exists, file missing" state) across all four required surfaces
(left identity panel, top-right identity control, account dropdown,
Profile page). Hennet's database record (`imageKey`,
`usr_d8c9acdb-8fc6-45b4-bc5b-0e3df6d6c10c-1778932228571.jpg`) remains
exactly as it was - untouched, not deleted, not auto-replaced.

## Test account cleanup (2026-07-18)

The two production test accounts used for the deploy's live verification -
Alice TicketThreeTest (P1000170) and Bob TicketThreeTest (P1000171) - were
removed after Ticket 3 was accepted as complete, once a full relationship
audit confirmed neither had any interaction with a real player or shared
production object (no marketplace listings, no organization membership or
founding, no duels, no admin-log references, no mentions inside any other
account's `player_snapshot`). Backup taken first at
`/srv/nexis/backups/ticket3-testacct-cleanup-20260718-084159` (account
rows, player_state, sessions, profile-image metadata, the 4 physical test
image files with checksums, and the pre-cleanup allocator values).

Removed: both accounts' sessions, `player_state` rows, and `users` rows
(cascade-deleted `player_state`/`auth_sessions` via the existing FK
constraints once `users` was deleted; every other FK to `users` on these
two accounts was already confirmed at zero rows beforehand). Removed:
Alice's 4 exact test image files under `/srv/nexis/shared/profile-images`,
deleted individually by validated absolute path (existence, regular-file,
and realpath match checked per file) - no wildcard, no `rm -rf`. Bob's
file had already been deleted during Ticket 3's own verification.

The public-ID allocator (`public_id_allocators`, `entity_type = 'player'`)
was never written to directly and was not reduced; it advanced only
through normal registration (once for a same-session cleanup-verification
probe account, also removed afterward). P1000170 and P1000171 can never be
reissued, since the allocator only ever moves forward. Hennet's portrait
metadata was re-confirmed byte-for-byte unchanged after cleanup, and she
remains the only account in the database with any profile-image record.
