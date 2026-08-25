# Nexis 2.0 Agent Entry Point

This file is intentionally short. It is a map, not a second rulebook.

## Mandatory first read

Before non-trivial work anywhere under `v2/`, read and obey:

1. `docs/ENGINEERING-MANUAL.md` - canonical workflow, quality, security, multi-agent and Definition-of-Done policy.
2. `docs/CORE-ARCHITECTURE.md` - authoritative Core responsibility/replacement boundary.
3. `docs/STATE-OWNERSHIP.md` - one authoritative write owner per state concept.
4. `docs/COMMAND-EXECUTION.md` - command/Core/owner orchestration, idempotency, concurrency and atomic commit rules.
5. `docs/IDENTITY-AUTHORIZATION.md` - Account/Character/public identity and authorization boundary.
6. `docs/CORE-RELEASE-GATE.md` and `docs/COMPONENT-RELEASE-GATE.md` when upgrade/replacement/release work is involved.
7. `docs/AGENT-HANDOFF.md` for current foundation order and stop conditions.

`docs/ENGINEERING-MANUAL.md` is the canonical instruction manual for Codex, Claude and every other engineering agent. Do not invent a Codex-specific Nexis architecture or quality bar.

## Absolute constraints

- Work inside the explicit task scope and branch/worktree.
- Existing/current Nexis outside `v2/` is reference/migration source unless the task explicitly authorizes changes there.
- `Nexis.Core` owns gameplay rules/calculations and is replaceable behind stable contracts.
- Every persistent state concept has one authoritative write owner.
- Application coordinates snapshots -> Core -> typed owner transitions; Application is not a second rules engine.
- No global mutable `PlayerState`/`RuntimeState`/qualities/counters blob.
- No direct foreign-system table writes.
- No client-authoritative gameplay state, time, RNG, ownership or privilege.
- No scheduler/CIEL/admin bypass around command/Core/owner boundaries.
- No rogue rewrite, second app, new runtime, microservice split or architecture change unless explicitly approved.
- Do not deploy/merge to production/live refs unless explicitly requested.
- Add/update tests and `CHANGELOG.md` for direct code/repo changes.
- Never claim restore/build/test success without observed evidence.

## Parallel agents

You may delegate independent work freely. Every sub-agent must receive the same canonical manual, relevant binding docs, explicit scope, owners/contracts involved, acceptance criteria and verification requirements. Shared public-contract or architecture edits require one designated integrator.

## Verification baseline

From repository root when applicable:

- `dotnet --info`
- `dotnet restore v2/Nexis.slnx`
- `dotnet build v2/Nexis.slnx --no-restore`
- relevant tests and full suite when feasible

Warnings are errors. If the environment prevents a check, report that fact instead of inventing a pass.

## Completion

Use the Definition of Done and final handoff format in `docs/ENGINEERING-MANUAL.md`.
