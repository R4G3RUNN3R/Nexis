# Nexis 2.0 Player Log / History Projection Boundary

_Status: foundation implementation slice, 2026-08-26._

## Purpose

Player Log is a rebuildable, knowledge-aware player-facing projection over eligible immutable history. It is not the authoritative event ledger, Admin Audit, replay trace, operational telemetry, a notification store, or current gameplay state.

This document records the implemented boundary in `Nexis.History.Contracts` and `Nexis.History.Projection`. It narrows the History/Replay, Admin Audit, identity and projection rules in `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md`, `IDENTITY-AUTHORIZATION.md` and `AUDIT-BOUNDARY.md`.

## Stable contracts

`Nexis.History.Contracts` defines persistence-neutral and transport-neutral Player Log values:

- `PlayerLogAudience` requires exactly one non-empty `AccountId` or `CharacterId`; Account and Character are never inferred to be interchangeable.
- `PlayerLogSource` retains immutable provenance as an authoritative `EventId` or `AuditId` without copying the source payload.
- `PlayerLogEntry` retains CorrelationId and authoritative UTC occurrence time plus bounded category, template and plain-text argument values.
- argument sets are immutable, canonically ordered and value-equal for deterministic re-projection.
- projection interfaces return only Player Log entries and expose no owner transitions or mutation boundary.

These contracts contain no PostgreSQL, EF, Npgsql, HTTP, UI, concrete Core, concrete Execution or owner-persistence types.

## Implemented projection policy

`PlayerLogProjectionRegistry` is fail closed:

- an authoritative event produces no Player Log entry unless its exact contract name and schema version have one explicitly registered projector;
- duplicate registrations are rejected;
- projectors must preserve the committed EventId, CorrelationId and occurrence time;
- null entries or collections are rejected;
- there is no raw-event fallback, generic reflection projector or payload display.

The first gameplay projector handles only `nexis.equipment.item-equipped` schema V1. It reconstructs and validates the complete typed `ItemEquippedEvent` payload before disclosure. The player receives a Character-audience entry containing only the normalized semantic placement key. Item-instance identity, occupied-slot details and the raw payload remain internal. Malformed or incomplete payloads fail closed.

`SafeAdminAuditPlayerLogProjector` handles only the audit contract's explicit visibility policy:

| Internal source | Required target | Player Log result |
| --- | --- | --- |
| `InternalOnly` audit | none | no entry |
| `PlayerMaterialEffect` audit | exact target `AccountId` plus explicit `SafePlayerReason` | one Account-audience safe-reason entry |
| unknown/malformed visibility or missing disclosure fields | none | fail closed |

The Admin projector never copies the acting staff AccountId, internal action/outcome, case reference, causation details, capability/security facts, anti-cheat data or raw audit record. A safe reason is an explicit upstream disclosure field, not permission to expose arbitrary internal text.

## Security and identity invariants

- Audience identity is server-derived from the committed typed event or immutable Admin audit fact, never from a query client's requested Account/Character.
- Account-targeted Admin effects are not silently converted to Character-targeted entries.
- Character-targeted gameplay events are not widened to the controlling Account.
- Hennet, display names, public IDs, titles, commercial entitlements and client role claims have no special projection authority.
- hidden world/knowledge facts, private CIEL context, security/anti-cheat facts, replay-only RNG/input data and internal audit metadata require separate explicit safe projectors and remain invisible by default.
- presentation layers must encode `PlayerLogPlainText` for their output medium; Player Log values are plain text, never trusted HTML.

## Replay, persistence and ownership

Projection is deterministic from the same supported versioned source envelope: source identity, correlation, authoritative occurrence time and canonically ordered arguments are preserved. Redelivery remains keyed by EventId at the eventing boundary; downstream storage/checkpoint consumers must remain idempotent.

The projects introduced by this slice do not create Player Log tables, a query API, a runtime consumer registration or any authoritative write path. Existing generic projection checkpoint infrastructure may later host an idempotent adapter, but projection storage remains rebuildable and non-authoritative. Corrections append new authoritative audit/events and re-project; they do not rewrite source history.

## Extension rule

Every new player-visible event schema requires a dedicated reviewed projector and tests proving exact audience, allowed disclosure, malformed-payload failure, hidden-field non-leakage and deterministic provenance. Knowledge-dependent events must consume an explicit trusted knowledge snapshot/policy at the projection boundary before they are registered; absence of that policy means no disclosure.

This slice does not define new gameplay, world knowledge, retention periods, pagination, localization, notification delivery or Player Log persistence schema.
