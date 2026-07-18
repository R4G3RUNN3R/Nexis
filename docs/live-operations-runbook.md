# Nexis Live Operations Runbook

This document records the live server layout and the safe operating steps for Nexis.
The live server remains the source of truth during production repair work.

## Live Paths

- Source root: `/srv/nexis/source/NexisGame`
- Frontend web root: `/srv/nexis/frontend/current`
- Public landing file: `/srv/nexis/frontend/current/index.html`
- React app shell: `/srv/nexis/frontend/current/app.html`
- Built frontend assets: `/srv/nexis/frontend/current/assets`
- Shared backend environment: `/srv/nexis/shared/config/backend.env`
- Backup root: `/srv/nexis/backups`
- Nginx site config: `/etc/nginx/sites-enabled/nexis`
- Systemd service: `nexis-waitlist.service`

## Routing Contract

**Corrected 2026-07-18 (Ticket 3 deploy) - the paragraph below previously
described an intended split that was checked against two months of deploy
backups and never actually existed in production.** Nginx's catch-all
(`location /`) and the literal `/` route both serve `index.html`, not
`app.html`, for everything except the exact `/app.html` path - so
`index.html` is the real primary entry point today, not a distinct public
landing page. In every historical backup checked (back to mid-May),
`index.html` has always been a full copy of the Vite SPA build, identical
in shape to `app.html`.

**Until this is deliberately redesigned, deploy the same build output to
both `index.html` and `app.html`** so the fresh bundle is reachable from
the real entry point. Deploying only to `app.html` (the old instruction)
leaves most real traffic - anything landing on `/` or a deep link -
running a stale bundle. See
`docs/incident-profile-image-data-loss-20260717.md` ("Deployment and live
verification") for how this was discovered.

- `/api/` proxies to the Node backend on `127.0.0.1:3001`.
- Everything else falls back to `index.html` (in practice, the app shell).

## Inspect Live State

```bash
systemctl status nexis-waitlist.service --no-pager
systemctl cat nexis-waitlist.service
nginx -T | sed -n '/server_name nexis.nexus/,/}/p'
curl -I https://nexis.nexus/
curl -s https://nexis.nexus/api/site/rankings | jq .
journalctl -u nexis-waitlist.service --since "15 minutes ago" --no-pager
```

## Safety Backups

Create a timestamped backup before risky changes:

```bash
stamp="$(date -u +%Y%m%d-%H%M%S)"
backup="/srv/nexis/backups/live-change-$stamp"
mkdir -p "$backup"
cp -a /srv/nexis/source/NexisGame "$backup/source"
cp -a /srv/nexis/frontend/current "$backup/frontend-current"
cp -a /etc/nginx/sites-enabled/nexis "$backup/nginx-nexis"
systemctl cat nexis-waitlist.service > "$backup/nexis-waitlist.service.txt"
```

## Backend Deploy

```bash
cd /srv/nexis/source/NexisGame
npm run build
systemctl restart nexis-waitlist.service
systemctl is-active nexis-waitlist.service
journalctl -u nexis-waitlist.service --since "5 minutes ago" --no-pager
```

Only restart the service when backend source or runtime configuration changed.

## Frontend Deploy

```bash
cd /srv/nexis/source/NexisGame
npm run build
cp -a dist/index.html /srv/nexis/frontend/current/app.html
cp -a dist/index.html /srv/nexis/frontend/current/index.html
mkdir -p /srv/nexis/frontend/current/assets
cp -a dist/assets/. /srv/nexis/frontend/current/assets/
```

Then verify both entry points reference the new build (see Routing Contract above for why both matter):

```bash
curl -I https://nexis.nexus/
curl -I https://nexis.nexus/app.html
curl -I https://nexis.nexus/assets/
diff <(curl -s https://nexis.nexus/ | grep -o 'assets/index-[a-zA-Z0-9_-]*\.js') \
     <(curl -s https://nexis.nexus/app.html | grep -o 'assets/index-[a-zA-Z0-9_-]*\.js')
```

## Rollback

**Source rollback** (`/srv/nexis/source/NexisGame`) should use `git revert` for a
specific bad commit, or targeted restoration of the exact changed files from a
backup - **not** a broad `rsync -a --delete` against the whole source
repository. The source tree is a git working copy; wholesale-deleting and
replacing it can destroy `.git` state, uncommitted work, or unrelated later
changes that a scoped revert or file-level restore would leave untouched.

```bash
cd /srv/nexis/source/NexisGame
git revert <bad-commit-sha>          # preferred: reverts just that change
# or, for a narrow file-level restore instead of a full revert:
git checkout <known-good-sha> -- path/to/file.js
```

Only fall back to restoring from a full backup snapshot (below) if the bad
change was never committed, or git history itself is unusable.

Use the most recent known-good backup under `/srv/nexis/backups` for
non-source assets (built frontend, nginx config) or as a last resort:

```bash
backup="/srv/nexis/backups/<backup-name>"
systemctl stop nexis-waitlist.service
rsync -a --delete "$backup/frontend-current/" /srv/nexis/frontend/current/
cp -a "$backup/nginx-nexis" /etc/nginx/sites-enabled/nexis
nginx -t
systemctl restart nginx
systemctl start nexis-waitlist.service
systemctl is-active nexis-waitlist.service
```

## Canary Procedures

Property Office and construction canaries must use isolated test rows and must clean up after themselves.

```bash
cd /srv/nexis/source/NexisGame
set -a
. /srv/nexis/shared/config/backend.env
set +a
node scripts/canaries/consortium-property-office-canary.mjs
```

Expected coverage includes consortium plot purchase, sellback, main build, builder assignment, NPC fallback, quality persistence, room build/upgrade, capacity enforcement, upkeep transitions, and cleanup.

Legacy achievement and merit persistence canary:

```bash
cd /srv/nexis/source/NexisGame
node scripts/canaries/legacy-achievements-canary.mjs
```

Expected coverage includes isolated canary registration, baseline achievement award, visible Chronicle entry creation, server-side Legacy Point totals, merit-rank spending, and reload persistence.

## Persistent Upload Storage (Profile Images)

Uploaded player profile images live at `/srv/nexis/shared/profile-images`, configured via
`PROFILE_IMAGE_STORAGE_DIR` in the systemd unit's environment. This directory is
**outside the source repository and outside any `.data/` test-data directory on
purpose** - see `docs/incident-profile-image-data-loss-20260717.md`. A prior
incident deleted every uploaded image because isolated test cleanup ran
`rm -rf .data` inside the source checkout, and uploads used to live under
that same `.data/` folder.

**Never run `rm -rf .data` (or any recursive delete) against the live
source checkout as test cleanup.** Isolated backend tests must use
`createIsolatedTestDir()` from `server/lib/safeTestCleanup.js`, which only
ever creates and removes directories under the OS temp directory - it will
throw if pointed at `.data`, the repo root, or the production upload path.

Include this directory in every backup taken before a deploy that touches
profile-image code:

```bash
stamp="$(date -u +%Y%m%d-%H%M%S)"
backup="/srv/nexis/backups/profile-images-$stamp"
mkdir -p "$backup"
rsync -a /srv/nexis/shared/profile-images/ "$backup/profile-images/"
find /srv/nexis/shared/profile-images -type f | wc -l
du -sh /srv/nexis/shared/profile-images
sha256sum /srv/nexis/shared/profile-images/* > "$backup/checksums.sha256" 2>/dev/null || true
```

**Restore** (verify into a scratch directory before ever touching the live path):

```bash
restore_check="$(mktemp -d)"
rsync -a "$backup/profile-images/" "$restore_check/"
sha256sum -c "$backup/checksums.sha256" --ignore-missing
# Only after the check above passes:
rsync -a --delete "$backup/profile-images/" /srv/nexis/shared/profile-images/
chown -R nexis:nexis /srv/nexis/shared/profile-images
chmod 750 /srv/nexis/shared/profile-images
```

**Ownership/permissions**: owned by `nexis:nexis` (the service user/group),
mode `750` (owner rwx, group rx, no world access - never world-writable, no
directory listing for unauthenticated requests since the app itself is the
only thing that reads this path directly).

**Retention**: keep at least the 3 most recent backups; delete older ones
manually after confirming a newer one restores cleanly. This directory is
expected to stay small (a handful of images at most, given current usage),
so a full rsync copy is cheap - do not attempt to slim this down with
incremental/delta backups until it's actually large enough to matter.

**Database/file consistency**: `player_state.player_snapshot->'portrait'`
stores the `imageKey` filename; the file lives at
`$PROFILE_IMAGE_STORAGE_DIR/<imageKey>`. These are two independent systems
with no foreign-key enforcement between them - a restore must bring back a
file set that is a superset of every `imageKey` currently referenced in the
database, or some accounts will see the "please re-upload" fallback notice
even though their upload technically still exists. When in doubt, restore
first, then spot-check a few known `imageKey` values resolve.

## Recovery Notes

- If `/` shows stale public copy, inspect `/srv/nexis/frontend/current/index.html` and the nginx root/fallback before rebuilding.
- If app routes show the public landing page, verify that `app.html` exists and that nginx fallback points to `/app.html`.
- If API routes fail, check `nexis-waitlist.service`, backend logs, and the environment file path before editing code.
- If database warnings mention concurrent `client.query()`, inspect transaction-scoped services for `Promise.all` over calls using the same pg client.
- If public profile data looks suspicious, verify unauthenticated, self, non-admin, and admin API states separately.

