# Incident Report: Profile Image Data Loss

**Discovery time:** 2026-07-17, during Ticket 3 (Character Image Regression) investigation, before any code was modified.

**Status:** Acknowledged, contained. Root cause fixed in this ticket's deploy. Lost file content is not recoverable.

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
