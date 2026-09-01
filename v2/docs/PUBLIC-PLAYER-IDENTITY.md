# Nexis 2.0 Public Player Identity Boundary

_Status: foundation implementation slice, 2026-09-01. This document records the implemented account-scoped stable public player identity. It narrows `IDENTITY-AUTHORIZATION.md` and does not change its binding semantics._

## Decision

One normal Nexis account is one player is one playable character.

Four concepts stay permanently distinct, and no two of them are ever the same value or the same type:

| Concept | Type | Shape | Mutable? | Public? | Grants authority? |
| --- | --- | --- | --- | --- | --- |
| Account identity | `AccountId` | GUID | no | no | no, by itself |
| Character identity | `CharacterId` | GUID | no | no | no, by itself |
| Public player identity | `PublicPlayerId` | ordinal, rendered `P0000000` | **no** | yes | **never** |
| Display name | `PlayerDisplayName` | text | yes | yes | never |

`PublicPlayerId` is deliberately **not** GUID-shaped. An accidental cast, reinterpretation or
copy-paste between an internal identifier and the public one cannot compile, which is a stronger
guarantee than a naming convention.

## Preserved V1 semantics

V1 allocated a numeric public player number rendered with a `P` prefix and zero padding, reserving a
low block below the first ordinary player. V2 preserves that public-facing meaning exactly:

- `PublicPlayerId.Floor` is `1000000` — the lowest ordinal the identity space uses at all;
- `PublicPlayerId.ReservedCount` is `20` — never allocated to an ordinary player;
- `PublicPlayerId.FirstAllocatable` is therefore `P1000020`;
- the canonical rendering is `P` followed by the ordinal zero-padded to seven digits.

Nothing about V1 storage, allocation code or its database was reused, moved or modified. Only the
observable public-identifier semantics were preserved.

## Immutability

`PublicPlayerId` is immutable for the life of the player identity, enforced in three independent
places so that no single bypass defeats it:

1. `PlayerIdentity` exposes no setter, and `WithDisplayName` returns a new value carrying the same
   `AccountId`, `CharacterId` and `PublicPlayerId`;
2. the persistence trigger `refuse_player_identity_reassignment` raises on any `UPDATE` that would
   change `account_id`, `character_id` or `public_player_ordinal`; renaming is the only permitted
   mutation;
3. `UNIQUE (public_player_ordinal)` prevents a second identity adopting an identifier the world has
   already seen.

## Structural guarantees

`nexis_v2.player_identities` enforces the ownership invariants at the database boundary:

- `account_id` **primary key** — an account cannot hold a second playable character. Nexis has no
  slots, alts or campaign characters;
- `character_id` **unique** — a character cannot be controlled by a second account;
- `public_player_ordinal` **unique** — no duplicate public identity, including one created by a
  concurrency race;
- `CHECK (public_player_ordinal >= 1000020)` — the reserved low range is never assigned;
- allocation draws from `nexis_v2.public_player_ordinal_seq` rather than `max() + 1`, so concurrent
  provisioning cannot mint the same ordinal twice.

Provisioning is idempotent. Repeating it for the same account and character returns the original
identity rather than minting a second public identifier, so a retried sign-in is safe. A request that
contradicts a stored mapping raises `PlayerIdentityConflictException` rather than silently returning a
different identity.

## Zero authority

`PublicPlayerId` grants nothing. This is asserted mechanically, not merely documented:

- no member of `PublicPlayerId` returns an `AccountId`, `CharacterId` or `TrustedActorContext`, so
  the type exposes no bridge to internal identity or actor authority;
- no `TrustedActorContext` factory accepts a `PublicPlayerId`;
- `IPlatformAuthorizationPolicy` accepts neither a `PublicPlayerId` nor a `PlayerDisplayName`;
- a client-supplied public identifier is a hostile assertion. `PlayerIdentityDirectory.ResolveControlledCharacter`
  decides control from the server-derived actor and returns **no** `CharacterId` at all when the
  actor does not control it, so a forged identifier cannot yield an actionable character;
- there is no hard-coded public identifier, display name or Hennet special case anywhere. Hennet's
  player actor receives no capability even from a policy that grants that capability to every staff
  bundle.

## Public projection

`PublicPlayerProjection` carries exactly two facts: `PublicPlayerId` and `DisplayName`.

It cannot carry `AccountId`, `CharacterId`, `AccountRole`, capabilities, security version,
entitlements or sanction state, and a test pins the member list so a future field cannot be added
without a deliberate decision. The Hennet boundary in `IDENTITY-AUTHORIZATION.md` is therefore
enforced structurally rather than by reviewer vigilance.

## Not in this slice

No authentication provider mapping, session or security-stamp storage, account sanction state,
profile customization, character creation flow, rename cooldown, rename policy, reserved-name list,
API surface or migration of V1 identity data. `PlayerDisplayName` validation preserves V1's
observable name rules and introduces no new gameplay value.
