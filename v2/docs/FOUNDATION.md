# Nexis 2.0 Foundation Contract

_Status: initial implementation skeleton, 2026-08-25._

## Dependency direction

Allowed direction:

`Nexis.Host.Api -> feature modules -> Nexis.Core -> Nexis.Kernel`

Feature modules may reference `Nexis.Kernel` directly when they need universal contracts. Domain projects must not reference the web host, EF Core, PostgreSQL drivers, Redis clients, Caddy concerns, SMTP, payment SDKs, filesystem adapters or frontend code.

## Kernel

`Nexis.Kernel` is intentionally tiny. It owns universal identifiers/contracts such as authoritative time and domain-event metadata. It must not become `Shared`, `Utils`, or any other junk drawer wearing a respectable hat.

Every meaningful domain event carries:

- immutable event ID;
- authoritative UTC occurrence time;
- correlation ID;
- optional causation event ID;
- schema version.

## Core

`Nexis.Core` contains only concepts that genuinely span the game domain. Feature-specific models belong to their owning modules.

## Feature modules

Initial modules prove the pattern:

- `Nexis.Modules.Identity`: account/character identity and authorization vocabulary. Authority is account-bound and server-side.
- `Nexis.Modules.Audit`: append-oriented privileged-action audit vocabulary and the approved internal-vs-player visibility boundary.

Later modules should follow the same pattern, including Education, Knowledge, Research, Economy, Contracts, World, Organizations, Combat, Magic and Spirits.

## Audit invariant

All meaningful administrator activity is internally auditable. Privileged reads, moderation investigations and anti-cheat inspections remain internal. Admin/system actions that materially change or affect a player's authoritative game state may be projected into that player's log with a safe explanation, while sensitive staff notes/signals remain internal.

## Host

`Nexis.Host.Api` is composition and transport, not the game. It may wire modules and infrastructure adapters but must not contain authoritative gameplay rules.

## Persistence

Persistence implementation is deliberately not added in this first skeleton. PostgreSQL remains the planned primary datastore, but domain contracts are being established before persistence technology is allowed to shape them. Event/audit storage will be append-oriented and corrections will use new compensating/corrective events rather than mutation of history.

## Testing gate

Before gameplay modules are implemented, add architecture tests that enforce project dependency direction plus unit tests for event metadata, authorization boundaries, audit visibility and Hennet public/private projection rules.

## Migration boundary

The existing Nexis application and database remain the reference source during the parallel rebuild. No v2 code may silently mutate the live v1 schema. Migration tooling must be explicit, repeatable, auditable and reconcilable.
