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
- platform AccountRole is not carried as Core actor authority;
- the same CommandId + same stable actor/type/payload cannot acquire a second execution claim;
- changed actor, intent contract or payload under the same CommandId is an integrity violation;
- capability/entitlement/security-version changes do not turn the same retry into a different command identity;
- completed duplicate commands return the stored terminal outcome instead of executing again;
- opposite-direction multi-resource operations produce the same canonical lock order;
- retryable failures rerun the whole supplied command attempt and stop at the configured bound;
- permanent failures and caller cancellation are not automatically retried;
- atomic command plans retain original receipt correlation for history/events;
- DomainFailed decisions can preserve legitimate committed in-world consequences;
- Admin command plans require an audit entry for the trusted acting Account and original command correlation;
- Audit contracts are separated from the replaceable Audit implementation.

## Partially complete foundation areas

These areas have stable seams but still require persistence/owner integration before they satisfy the full stop conditions:

- event/history: authoritative event envelopes and replay trace exist; production append-only ledger storage and Player Log projection/visibility contracts remain incomplete;
- outbox: atomic commit contract requires durable outbox records for committed authoritative events, but no production outbox store/dispatcher/idempotent consumer adapter exists yet;
- audit: stable contracts and atomic Admin-command inclusion exist; production append-only audit persistence remains incomplete;
- concurrency: canonical lock order and bounded retry policy exist; PostgreSQL-specific transaction/lock/retry adapter does not yet exist;
- command lifecycle: receipt + terminal outcome + atomic commit contracts exist; crash recovery/stale execution-claim lease/takeover semantics remain to be implemented with persistence.

## Not yet complete

Do not interpret the green CI slices above as permission for broad gameplay fan-out. The following foundation work remains before the full `AGENT-HANDOFF.md` stop conditions are cleared:

1. define the first narrow owner-specific contract packages needed for an end-to-end proof;
2. define the Content Registry contracts required by that proof without a generic content blob;
3. add the first real domain golden rule pack behind internal Core dispatch;
4. implement production persistence adapters for command receipts, owner revisions/transactions, history/audit/outbox and retry classification without leaking Npgsql/EF types into public contracts;
5. prove one deliberately multi-owner atomic vertical scenario including rollback on one-owner failure;
6. add scheduler/CIEL bypass protections at the executable architecture boundary;
7. complete the remaining Identity capability/policy implementation and security tests without role-ordinal authorization;
8. complete Player Log/history projection boundaries and idempotent post-commit consumers;
9. establish the migration/reconciliation harness before any v1-to-v2 state movement.

## Next safe implementation boundary

The non-gameplay Core/execution spine is now far enough along that the next meaningful proof needs **real owner-specific contracts or a transaction-capable persistence adapter used only against isolated V2/test state**.

Do not create a generic PlayerState, generic property bag, generic owner-table writer or fake gameplay rule merely to keep implementation moving.

The selected vertical proof must:

- use real authoritative-owner boundaries already approved by `STATE-OWNERSHIP.md`;
- avoid inventing unsettled game balance or content merely to exercise infrastructure;
- use typed snapshots and typed transitions;
- execute through `ICoreRulesEngine` and internal rule dispatch;
- produce a golden conformance scenario;
- prove owner state + terminal command result + events/history + Admin audit when applicable + outbox commit atomically;
- prove rollback when any participating owner transition cannot commit;
- prove a retry reloads/revalidates/re-evaluates rather than reusing stale snapshots.

If no real gameplay operation is sufficiently specified to do that without inventing rules, continue product/system design before creating implementation gravity around guesses.

## Verification discipline

Every new code slice must pass the existing V2 CI workflow before another dependent slice is considered stable. A green build is necessary but does not satisfy the Universal Component Release Gate for production promotion.
