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
- command receipt/idempotency contracts binding CommandId to stable trusted actor + intent contract + server-derived SHA-256 payload fingerprint;
- explicit receipt outcomes for first acquisition, duplicate-in-progress, duplicate-completed and CommandId integrity violation;
- original CorrelationId retention across transport retries;
- atomic command commit plan carrying proposed terminal outcome, typed owner transitions, authoritative events and replay-critical Core/rule/content provenance;
- strict rule that Core `Succeeded` is not a durable command success until the atomic commit succeeds;
- canonical deterministic multi-resource lock ordering independent of call direction;
- bounded whole-command retry executor driven only by an infrastructure-specific transient failure classifier, with cancellation never auto-retried;
- separate `Nexis.Audit.Contracts` assembly using typed Account/Correlation/Event identities;
- append-only privileged-read audit boundary;
- state-changing Admin command audit entries included in the same atomic command commit plan, including rejected Admin attempts;
- isolated raw-Npgsql PostgreSQL execution adapter using the dedicated `nexis_v2` schema for command receipts, authoritative history, durable outbox and Admin audit only;
- PostgreSQL receipt acquisition with a unique CommandId constraint and trusted actor-shape database constraints;
- PostgreSQL atomic command commit with receipt row revalidation, owner transition appliers, terminal outcome, history/outbox and Admin audit in one transaction;
- PostgreSQL transient retry classification limited to SQLSTATE `40001` serialization failure and `40P01` deadlock detection, while network/commit-ack ambiguity is deliberately not auto-retried;
- disposable PostgreSQL integration-test proof that a second-owner optimistic conflict rolls back an earlier owner's staged update and leaves terminal/history/outbox effects absent;
- V2-only GitHub Actions verification using .NET 10, Release build, warnings-as-errors, Microsoft.Testing.Platform tests and a disposable PostgreSQL 18.6 service.

## Current verification evidence

The PostgreSQL execution-adapter commit `3b4301769d62272d83cba99edeff8100c30b81bc` passed the complete V2 workflow against PostgreSQL 18.6:

- solution restore: passed;
- Release build: **0 warnings, 0 errors**;
- architecture/Core/execution/security suite: **72 passed, 0 failed, 0 skipped**;
- PostgreSQL integration suite: **7 passed, 0 failed, 0 skipped**.

The real-database integration suite proves:

- ten concurrent attempts for the same CommandId produce exactly one acquired execution receipt;
- changed payload under an existing CommandId is an integrity violation;
- two synthetic authoritative owners commit together on success;
- a second-owner revision conflict rolls the first owner's staged update back;
- the failed multi-owner attempt leaves the command receipt incomplete and emits no authoritative history/outbox rows;
- successful commit persists both owner updates, terminal command status, authoritative history and durable outbox together;
- a completed duplicate returns the stored terminal outcome rather than executing again;
- state-changing Admin audit persists in the same transaction;
- privileged read-only audit can append independently without a gameplay command receipt;
- only PostgreSQL serialization/deadlock SQLSTATEs are classified as safe automatic whole-command retries.

The synthetic owner tables used by this suite are transaction-proof infrastructure only. They do not satisfy the still-required real owner-specific gameplay vertical proof.

## Other verified invariants already covered by automation

Current tests also prove, among other things:

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
- platform AccountRole is not carried as Core actor authority;
- capability/entitlement/security-version changes do not turn the same retry into a different command identity;
- opposite-direction multi-resource operations produce the same canonical lock order;
- retryable failures rerun the whole supplied command attempt and stop at the configured bound;
- permanent failures and caller cancellation are not automatically retried;
- atomic command plans retain original receipt correlation for history/events;
- DomainFailed decisions can preserve legitimate committed in-world consequences;
- Admin command plans require an audit entry for the trusted acting Account and original command correlation;
- Audit contracts are separated from the replaceable Audit implementation.

## Partially complete foundation areas

These areas now have real persistence seams but still require additional lifecycle work before they satisfy the full stop conditions:

- event/history: authoritative event rows are persisted transactionally, but Player Log projection/visibility contracts and production replay-corpus extraction remain incomplete;
- outbox: committed authoritative events create durable outbox rows transactionally, but leased multi-worker delivery, publication acknowledgement and idempotent consumer checkpointing are not implemented yet;
- audit: PostgreSQL append-only read audit and atomic state-changing Admin audit are implemented; broader retention/query/admin-review services remain future work;
- concurrency: optimistic revision rollback is proven against PostgreSQL and safe retry SQLSTATE classification exists; real owner-specific lock/revision policy still depends on the first gameplay owner proof;
- command lifecycle: durable receipt + terminal outcome + real atomic persistence exist; stale execution-claim recovery, lease/takeover policy and ambiguous COMMIT acknowledgement reconciliation remain incomplete;
- owner persistence: PostgreSQL can coordinate explicit owner transition appliers, but no real gameplay owner-specific PostgreSQL adapter exists yet.

## Not yet complete

Do not interpret the green CI slices above as permission for broad gameplay fan-out. The following foundation work remains before the full `AGENT-HANDOFF.md` stop conditions are cleared:

1. define the first narrow owner-specific contract packages needed for an end-to-end proof;
2. define the Content Registry contracts required by that proof without a generic content blob;
3. add the first real domain golden rule pack behind internal Core dispatch;
4. implement at-least-once outbox delivery with safe multi-worker claiming and idempotent consumer handling/checkpointing;
5. define stale execution-claim/crash recovery and ambiguous commit reconciliation by CommandId;
6. prove one deliberately multi-owner **real owner-specific** vertical scenario including rollback on one-owner failure;
7. add scheduler/CIEL bypass protections at the executable architecture boundary;
8. complete the remaining Identity capability/policy implementation and security tests without role-ordinal authorization;
9. complete Player Log/history projection boundaries;
10. establish the migration/reconciliation harness before any v1-to-v2 state movement.

## Next safe implementation boundary

The next safe infrastructure-only slice is **durable outbox delivery and idempotent post-commit consumer handling**. It can build on the now-proven PostgreSQL outbox without inventing any unsettled gameplay state.

The design must preserve these rules:

- delivery is at-least-once, not falsely advertised as exactly-once across arbitrary external systems;
- EventId is the stable delivery/idempotency identity;
- multiple workers must not concurrently own the same outbox claim;
- a worker crash must make an abandoned claim eligible again after an explicit lease expires;
- successful publication must be acknowledged durably;
- a crash after external publication but before acknowledgement may cause redelivery, so consumers must be idempotent by EventId;
- internal PostgreSQL projection consumers should persist their side effect and event checkpoint atomically where possible;
- outbox workers never mutate authoritative gameplay owner state directly;
- Core remains unaware of delivery infrastructure.

After that slice, continue with command crash-recovery/ambiguous-commit reconciliation or return to product/system design to select the first real owner-specific vertical proof.

## Verification discipline

Every new code slice must pass the existing V2 CI workflow before another dependent slice is considered stable. A green build is necessary but does not satisfy the Universal Component Release Gate for production promotion.
