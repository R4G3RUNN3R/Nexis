# Nexis 2.0 Foundation Implementation Status

_Status: rolling implementation checkpoint, updated 2026-08-26. This file records progress only. It does not supersede `ENGINEERING-MANUAL.md` or any binding architecture/canon document._

## Current branch

`feature/nexis-v2-foundation-skeleton`

Draft PR #4 remains the integration surface and must remain draft until the complete foundation stop conditions in `AGENT-HANDOFF.md` are satisfied.

Existing/current Nexis outside `v2/` remains reference/migration source only. No work recorded here authorizes live deployment or v1 mutation.

## Completed and CI-verified foundation slices

The following are implemented on the branch and have passed the V2 restore/build/test workflow after their latest code changes:

- separate `Nexis.Core.Contracts` stable engine boundary;
- replaceable `ICoreRulesEngine` reference implementation seam;
- CommandId/CorrelationId authoritative execution primitives;
- replay-safe deterministic RNG factory/stream contracts;
- explicit typed owner snapshots, Content Registry inputs, owner-addressed transitions, event descriptors and result payloads;
- Core contract/rule/content version primitives;
- golden-scenario Core conformance and baseline/candidate comparison harness;
- deterministic exact integer/rational arithmetic with explicit rounding and checked overflow;
- explicit internal Core rule dispatch with no reflection/service-locator dependency;
- concrete-Core dependency guard allowing Kernel + stable `*.Contracts` packages while rejecting implementation assemblies;
- separate `Nexis.Identity.Contracts` assembly;
- permanent AccountId/CharacterId type separation;
- server-created trusted actor context for Player/Admin/System/Realtime mutation lanes;
- separation of platform capability facts from commercial entitlement facts;
- Admin/staff actor context without hidden Character impersonation;
- V2-only GitHub Actions verification using .NET 10, Release build, warnings-as-errors and Microsoft.Testing.Platform tests.

## Verified invariants already covered by automation

Current tests prove, among other things:

- Kernel has no dependency on other Nexis assemblies;
- Core contracts do not depend on concrete Core or feature implementations;
- concrete Core does not depend on feature implementation assemblies;
- a fake/replacement Core can satisfy the same stable engine contract;
- deterministic replay can detect semantic divergence;
- repeated Core evaluation receives a fresh stream from the same deterministic RNG inputs;
- rejected/conflicted/technical outcomes cannot silently carry mutation plans through the convenience constructors;
- Core requests freeze supplied snapshot/content collections;
- deterministic ratio arithmetic has explicit positive/negative rounding and overflow behavior;
- duplicate internal rule registration is rejected;
- unregistered intents are mutation-free TechnicalFailure results;
- trusted actor context reaches the selected evaluator unchanged;
- AccountId and CharacterId remain distinct contract types;
- Identity implementation depends on stable Identity contracts, never the reverse;
- staff Admin context has no Character impersonation identity;
- platform AccountRole is not carried as Core actor authority.

## Not yet complete

Do not interpret the green CI slices above as permission for broad gameplay fan-out. The following foundation work remains before the full `AGENT-HANDOFF.md` stop conditions are cleared:

1. define the first narrow owner-specific contract packages needed for an end-to-end proof;
2. define the Content Registry contracts required by that proof without a generic content blob;
3. add the first real domain golden rule pack behind internal Core dispatch;
4. implement command receipt/lifecycle/idempotency contracts and orchestration boundaries;
5. stabilize event/history/audit/outbox contracts for committed authoritative actions;
6. establish persistence/concurrency adapters outside Core/public contracts;
7. prove one deliberately multi-owner atomic vertical scenario including rollback on one-owner failure;
8. add scheduler/CIEL bypass protections at the executable architecture boundary;
9. complete the remaining Identity capability/policy implementation and security tests without role-ordinal authorization;
10. establish the migration/reconciliation harness before any v1-to-v2 state movement.

## Next safe implementation slice

The next implementation work should start with **narrow owner-specific contracts for the first architectural proof**, not broad Combat/Economy/World implementation.

The selected proof must:

- use real authoritative-owner boundaries already approved by `STATE-OWNERSHIP.md`;
- avoid inventing unsettled game balance or content merely to exercise infrastructure;
- use typed snapshots and typed transitions;
- execute through `ICoreRulesEngine` and internal rule dispatch;
- produce a golden conformance scenario;
- be designed so Application/persistence can later prove atomic rollback across owners.

If no real gameplay operation is sufficiently specified to do that without inventing rules, stop at the contract boundary and continue product/system design rather than creating implementation gravity around guesses.

## Verification discipline

Every new code slice must pass the existing V2 CI workflow before another dependent slice is considered stable. A green build is necessary but does not satisfy the Universal Component Release Gate for production promotion.
