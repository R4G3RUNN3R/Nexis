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
