# Administrator Panel MVP

This pass adds a real server-authoritative administrator workflow for player intervention.

## Scope
- Admin-only route in the frontend.
- Server-side permission checks based on reserved administrator public IDs.
- Search/select players by name or public ID.
- Server-authoritative player actions for bars, stats, currencies, job assignment, inventory, and item enhancements.
- Audit logging of every admin action with actor, target, reason, before/after summary, and timestamp.

## Security posture
- The frontend only exposes the panel when the current player is an administrator.
- The backend is the actual source of truth and rejects non-admin callers.
- Every mutation is written through the backend player-state repository and stored in the database-backed runtime state.

## Deliberate non-scope
- No guild/consortium control surface beyond a future placeholder.
- No bulk tools, no wipe actions, no fake moderation UI.

## Admin hotfix (target resolution + one-shot token grants)
- Every admin player-targeting endpoint (`GET /admin/players/:targetPublicId`,
  `POST /admin/players/:targetPublicId/actions`,
  `POST /admin/players/:targetPublicId/one-shot-tokens`) accepts only the
  player's **public ID** in the route. The server resolves it to the
  authoritative internal user itself via
  `server/lib/adminTargetResolution.js` - never trust a client-submitted
  internal-shaped ID. Root cause this closed: the inline quick-action
  controls (Fill/Set/Reduce next to gameplay bars) previously submitted
  `PlayerContext`'s `player.internalId`, which is populated from the
  login/register response's synthetic `plr_<publicId>` placeholder
  (`authService.js`'s `mapPublicApiUser`), never the real database
  `internal_id` - every admin's own quick actions failed with "Target
  player not found."
- Personal one-shot token grants (Resources tab, administrator-only) add to
  the existing `dmosOneShots.tokens.sealed` (tradeable) /
  `.patronBound` (donor) counters already consumed by
  `nexisOneShotService.js`/`organizationOneShotService.js` - no parallel
  balance. Locked via Ticket A's row-locking architecture, idempotent via
  a dedicated `admin_one_shot_token_grants` table (client-supplied
  idempotency key, server-generated operation ID), and fully audited via
  the existing `admin_action_logs` table. See
  `docs/ticket-b-one-shot-token-integration-contract.md` for how Ticket B
  should consume donor bonus credits.
