# Nexis 2.0 Identity and Authorization Contract

_Status: approved foundation design for implementation after build verification._

## Purpose

Nexis must separate who is authenticated, who is represented in the game world, what the public sees, what the account owns, and what the caller is authorized to do.

Those concepts are related, but they are not interchangeable.

The design deliberately combines the strongest lessons from Torn's stable single-player identity model, WoW's account/character separation, TrinityCore's account-bound granular permissions, and Nexis's own future browser/native/Steam requirements.

## Research basis

- **Torn** treats the player as one persistent account/identity, uses stable player IDs while player names can change, and prohibits multiple accounts operated by one player because alts create economic/competitive abuse. This is a close fit for Nexis's persistent economy and organization/PvP ambitions.
- **World of Warcraft** cleanly separates the Battle.net account from many game characters and now has substantial account-wide/Warband progression. This proves the value of account/character separation, but also demonstrates the design cost of deciding which progression belongs to the account versus the character.
- **TrinityCore** separates account security/RBAC from character GUIDs. An account can hold groups/roles/permissions, and gameplay/server commands check effective permissions rather than inferring authority from a character name. This is the strongest implementation precedent for Nexis's staff/admin boundary.
- **Existing Nexis v1** already has separate internal/public IDs and allows character/player display-name changes. The stable-ID concept should be preserved while the account/player-state coupling is redesigned.

## Core decision

Nexis 2.0 separates **Account** and **Character** permanently at the architecture level.

For the initial Nexis 2.0 product, one normal player account has **one playable character**. The schema/contracts must not collapse AccountId and CharacterId into the same key, so multiple characters can be introduced later only through an explicit game-design decision.

This preserves the Torn-like persistent single-identity economy now without forcing a destructive identity migration if Nexis later adopts a WoW-like multi-character model.

## Identity layers

### Account

The account is the authentication/security/ownership principal.

Account-owned concerns include:

- authentication provider mappings;
- credentials/session security metadata;
- platform/staff authorization assignments;
- account sanctions/status;
- billing/subscription/product entitlements;
- account-level preferences;
- external identity links such as Google or future Steam identity;
- security/audit history relating to access and privilege.

The account is not the character and does not directly own ordinary in-world combat/economy/progression state.

### Character

The character is the in-world gameplay identity.

Character-owned concerns should include by default:

- public player identity/profile;
- display name;
- stats/resources;
- inventory/equipment;
- education/skills/mastery;
- travel/location;
- economy/gameplay balances unless explicitly designated account-wide;
- guild/consortium membership and in-world ranks;
- reputation/knowledge/world progression;
- PvP/combat state;
- character achievements/titles/records unless a future system is deliberately account-wide.

Do not make gameplay state account-wide merely because v2 initially permits only one playable character.

### Public player identity

A character receives an immutable public player identifier distinct from both display name and internal persistence identity.

Nexis v1's public-ID concept is worth preserving.

Rules:

- public ID is stable for the life of the character;
- display name may change according to game rules without changing identity;
- internal AccountId/CharacterId are not exposed merely because a public identifier exists;
- logs/interactions store stable IDs and may additionally snapshot the display name that was shown at the time;
- names, titles, portraits and lore are presentation, never authority.

The exact public-ID format may be selected during persistence/API implementation, but its semantics are fixed by this contract.

## Initial one-character policy

Nexis 2.0 initially exposes one playable character per normal account.

Reasons:

- Nexis is structurally closer to Torn than to an alt-centric MMO in economy, PvP, organizations and long-term identity;
- multiple characters would immediately create design questions around market transfers, guild influence, bounties, voting, leaderboards, farming and anti-cheat;
- none of those problems should be accidentally introduced merely because the database can represent 1:N;
- keeping AccountId and CharacterId separate now preserves future flexibility without paying the gameplay cost today.

If multi-character accounts are ever approved later, each system must explicitly decide what is account-wide, character-wide and transferable before the second playable character is enabled.

## External identities and authentication

Authentication providers map to AccountId. They do not become the account's primary key.

Examples may include:

- password/email login;
- Google identity;
- future Steam identity;
- other approved identity providers.

Rules:

- provider subject identifiers are stored as external identity mappings to AccountId;
- email addresses are mutable contact/recovery data, not authoritative account identity;
- multiple approved providers may later link to one AccountId through an audited secure linking flow;
- account linking/unlinking is a security-sensitive operation and must be auditable;
- provider SDK/database/JWT implementation details remain outside Nexis.Core and module public contracts.

## Actor context

Every command execution receives a server-created ActorContext.

It may include trusted concepts such as:

- AccountId;
- active CharacterId where the command is character-scoped;
- actor kind (Player, Staff/Admin, System, future service actor);
- effective platform capabilities/policies;
- entitlement context required by the command;
- security/session version or equivalent revocation context;
- execution lane.

The client never supplies authoritative ActorContext fields.

A request body containing `role=Administrator`, a character named Hennet, an owner title, a hidden UI toggle or a forged CharacterId can never grant authority.

## Authorization model

### Capabilities/policies, not ordinal roles

`AccountRole` may remain as a convenient staff classification or permission bundle, but code must not authorize sensitive actions with logic such as:

`role >= Administrator`

Instead, handlers/policies ask whether the trusted account possesses a named capability required for that action.

Examples of future platform capabilities might conceptually include:

- view standard support data;
- view sensitive audit data;
- inspect anti-cheat signals;
- issue moderation sanctions;
- perform player-state correction;
- manage content;
- manage staff authorization;
- perform primary-owner/break-glass operations.

The exact capability catalogue is implementation work and should stay intentionally small at first.

### Roles are bundles

Player, Moderator, Administrator and PrimaryOwner may serve as named bundles/default assignments of capabilities.

Authorization uses the resulting capabilities/policies, not the label itself.

This lets Nexis change the staff permission model later without rewriting every command handler.

### Explicit deny

The authorization model should permit an explicit server-side deny/restriction to override inherited grants where operationally necessary, following the mature RBAC pattern used by systems such as TrinityCore.

Do not expose arbitrary player-managed platform permissions.

### Domain roles are not platform roles

Guild officer, Consortium director, party leader, employer or similar in-world positions belong to their owning gameplay domain.

They do not enter platform AccountRole/RBAC.

For example:

- Identity proves which account/character is acting;
- Organizations decides whether that character may withdraw from a guild treasury;
- Identity does not invent a global `CanWithdrawGuildTreasury` staff capability for ordinary guild gameplay.

This prevents Identity from becoming a catch-all permission junk drawer.

## Entitlements are separate from authority

Subscription tier, purchases, cosmetics, expansion access or other commercial entitlements must never imply moderator/admin privilege.

Likewise, staff authority must not silently grant paid gameplay entitlements unless an explicit support/test policy says so.

Keep these concepts separate:

- Authentication: who are you?
- Character selection: whom are you playing?
- Entitlement: what product/content access does the account own?
- Platform authorization: what privileged platform operations may this account perform?
- Domain authorization: what may this character do under the current game rules?

## Session and privilege freshness

Authentication establishes AccountId, but privileged authorization must be evaluated from current server-side authority state.

Do not make long-lived client/JWT role claims the only source of truth for staff privilege.

The account security model should include a server-controlled session/security version (security stamp/session epoch or equivalent) so important changes such as:

- password/security reset;
- staff-role/capability change;
- suspension;
- account compromise response;

can invalidate or force re-evaluation of existing sessions.

The exact token/session mechanism belongs to infrastructure, not Core.

## Administrative operation model

Staff do not become a player by impersonating their session for state changes.

### Read-only support view

A future audited "view as player" projection may render what a target player is entitled to see for support/debugging.

It is read-only and audited as privileged access.

### State-changing support/admin work

All mutations are explicit Admin-lane commands such as correction, grant, reversal or sanction operations against the target account/character.

They include the acting staff AccountId in Admin Audit and follow the already-approved impact-based player-visible logging rule.

No silent impersonation mode may hide who actually performed the mutation.

## Primary owner

`PrimaryOwner` is an account authorization bundle/classification, not a special character identity.

The system must not authorize primary-owner operations because:

- the character is named Hennet;
- the display name matches a configured string;
- a particular public player ID is hard-coded into gameplay code;
- the client enabled an Admin Mode toggle.

Bootstrap assignment/recovery of primary-owner authority is infrastructure/security work and must be explicitly designed, auditable and secret-safe.

## Hennet boundary

Hennet's public character representation is ordinary public game data unless a specific gameplay mechanic says otherwise.

The associated account's staff/owner capabilities remain private server authority.

Public profile serialization must never leak:

- AccountRole/capabilities;
- internal AccountId;
- privileged audit metadata;
- anti-cheat/security state;
- hidden owner/admin flags;
- authentication-provider details.

This is mandatory even if Hennet is publicly recognizable as the owner's character through lore/community knowledge.

## Sanctions and restrictions

Account security/status and gameplay restrictions are separate concepts.

Examples:

- login suspension/ban belongs to account security/moderation;
- marketplace restriction belongs to the relevant moderation/domain policy;
- travel lock, jail, hospital or gameplay condition belongs to gameplay state;
- guild-role removal belongs to Organizations.

One generic `isBanned` boolean must not become a substitute for all restriction semantics.

## Initial contract decomposition

The current skeleton's `Nexis.Modules.Identity/IdentityContracts.cs` is an acceptable first placeholder but must not become the permanent public-contract layout.

Before broad module integration, split identity along the already-approved module-owned contract pattern, conceptually:

- `Nexis.Identity.Contracts` - public stable identity types/contracts that other modules may consume;
- `Nexis.Identity` - identity/security implementation/domain logic;
- infrastructure/auth adapters outside both.

Other modules may depend on `Nexis.Identity.Contracts` when they truly require stable AccountId/CharacterId/actor identity concepts. They must not depend on Identity implementation internals.

If AccountId/CharacterId prove genuinely universal enough for Kernel after implementation review, that move must be deliberate; do not turn Kernel into a dumping ground simply to avoid a reference.

## Required tests before broad gameplay implementation

Add automated tests proving at minimum:

1. changing a character display name does not change AccountId, CharacterId, public player ID or authority;
2. a forged client role/owner/admin field never grants capability;
3. a forged CharacterId cannot act unless the authenticated account is authorized to control it;
4. Hennet's public profile never serializes account/platform authority fields;
5. staff capability removal takes effect from authoritative server state rather than stale client role claims;
6. Moderator/Admin/PrimaryOwner authorization checks use capabilities/policies rather than character name or ordinal role comparison;
7. commercial entitlements cannot grant staff capabilities;
8. guild/consortium roles cannot grant platform admin capabilities;
9. audited read-only staff inspection does not mutate the target player;
10. an admin mutation records the real acting staff account rather than pretending to be the target;
11. the initial one-character-per-account rule is enforced without collapsing AccountId and CharacterId into one identifier;
12. external identity provider data maps to AccountId without becoming game-domain authority.

## Explicit non-goals for the first foundation

- no playable alt/multi-character feature at launch;
- no WoW-style account-wide gameplay/Warband system merely because the schema can support multiple characters;
- no character-name-based privilege;
- no hard-coded Hennet/public-player-ID superuser logic;
- no client-authoritative Admin Mode;
- no single global permission enum containing every guild/job/gameplay action;
- no auth-provider SDK types in Core/module contracts;
- no silent state-changing player impersonation by staff;
- no billing entitlement treated as authorization.
