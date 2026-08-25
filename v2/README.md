# Nexis 2.0

This directory is the parallel Nexis 2.0 implementation root.

The current live Nexis remains untouched and remains the reference/source for preservation and migration work until a controlled cutover is explicitly approved.

## Foundation rules

- C#/.NET is the authoritative game-engine and server-side domain runtime.
- `Nexis.Kernel` contains only tiny universal primitives and contracts.
- `Nexis.Core` contains pure cross-domain game concepts that genuinely belong to the game as a whole. It must not become a catch-all utility project.
- Feature modules own their domain models and public contracts.
- Infrastructure, persistence, networking, authentication providers, caches and external services stay outside domain projects.
- Meaningful state changes are server-authoritative and produce immutable domain events.
- All authoritative event timestamps come from the engine clock.
- Event/audit history is append-oriented. Corrections are represented by new corrective events, never by rewriting prior history.
- Player-facing history is a projection of authoritative history and is knowledge-aware.
- Administrative reads and mutations are always auditable. Only material admin/system effects on a player are projected into that player's log.
- No implementation may infer administrator authority from character/display names or lore.

## Initial layout

```text
v2/
  src/
    Nexis.Kernel/
    Nexis.Core/
    Nexis.Modules.Identity/
    Nexis.Modules.Audit/
    Nexis.Host.Api/
  tests/
    Nexis.Architecture.Tests/
  docs/
    FOUNDATION.md
```

Gameplay modules will be added behind the same boundaries as their designs graduate from approved specifications.
