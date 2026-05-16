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

Nginx intentionally splits the static public landing pages from the React app shell.

- `/` serves the public landing page at `index.html`.
- `/welcome`, `/login`, and `/register` are direct public/static entries where configured.
- `/api/` proxies to the Node backend on `127.0.0.1:3001`.
- Application routes fall back to `/app.html`.

Do not deploy Vite's `dist/index.html` over `/srv/nexis/frontend/current/index.html`.
Deploy it to `/srv/nexis/frontend/current/app.html` instead.

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
mkdir -p /srv/nexis/frontend/current/assets
cp -a dist/assets/. /srv/nexis/frontend/current/assets/
```

Then verify:

```bash
curl -I https://nexis.nexus/
curl -I https://nexis.nexus/app.html
curl -I https://nexis.nexus/assets/
```

## Rollback

Use the most recent known-good backup under `/srv/nexis/backups`.

```bash
backup="/srv/nexis/backups/<backup-name>"
systemctl stop nexis-waitlist.service
rsync -a --delete "$backup/source/" /srv/nexis/source/NexisGame/
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

## Recovery Notes

- If `/` shows stale public copy, inspect `/srv/nexis/frontend/current/index.html` and the nginx root/fallback before rebuilding.
- If app routes show the public landing page, verify that `app.html` exists and that nginx fallback points to `/app.html`.
- If API routes fail, check `nexis-waitlist.service`, backend logs, and the environment file path before editing code.
- If database warnings mention concurrent `client.query()`, inspect transaction-scoped services for `Promise.all` over calls using the same pg client.
- If public profile data looks suspicious, verify unauthenticated, self, non-admin, and admin API states separately.

