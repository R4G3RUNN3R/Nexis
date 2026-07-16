# Organization Core Foundation

This pass introduces a shared organization foundation for Guilds and Consortiums so they stop being authority-less localStorage blobs.

## Shared entities
- `organization`
- `organization member`
- `organization role`
- `organization permissions`
- `organization log`
- `treasury`

## Common fields
- type: `guild | consortium`
- name
- tag
- founder/player owner
- createdAt
- description
- statusText
- treasury
- metadata

## Divergence paths
### Guild
- Social and combat organization.
- Future scope: PvP, wars, sieges, strongholds, guild reputation, guild skills.
- Not implemented in this pass.

### Consortium
- Economic and professional organization.
- Type chosen at creation.
- Different creation costs and passive bonus summaries by type.
- Example templates in this pass: trade, mercenary, smithing, caravan, scholarium.
- Full management simulation intentionally left for later.

## Current implementation shape
- Backend stores organizations in dedicated tables.
- Founder/member/role/log records are persisted server-side.
- Frontend Guilds/Consortiums flows use the shared backend core when logged in through the live server.
- Runtime cache may still keep a local mirror for display, but authority now lives on the server.
