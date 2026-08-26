# Nexis 2.0 Atomic Command Commit Boundary

_Status: foundation implementation slice, updated 2026-08-26. This document narrows `COMMAND-EXECUTION.md`; it does not replace owner-specific persistence design._

## Purpose

This slice establishes the one-call persistence boundary for a resolved authoritative command. It prevents Application code from independently committing owner state, terminal command status, history events, state-changing Admin audit records or outbox rows.

The central distinction is permanent:

> A Core `Succeeded` decision is a proposed rules result. The command becomes durably `Succeeded` only when the authoritative commit transaction succeeds.

## Command commit plan

`CommandCommitPlan` carries the complete set of effects that must move together:

- stable command execution identity and active execution token;
- original command correlation identity;
- exact Core implementation + Core contract + rule + content versions used for evaluation;
- authoritative evaluation timestamp;
- proposed terminal command outcome;
- typed owner-addressed transitions;
- authoritative event envelopes with immutable EventId/metadata and typed semantic descriptors;
- state-changing Admin audit entries where the command lane is Admin.

The plan contains no EF, Npgsql, HTTP, Redis or frontend types.

Every Admin command attempt requires at least one atomic audit entry. The audit entry must use the original command CorrelationId and its acting AccountId must match the trusted Admin actor. This applies even when the Admin command is rejected: privileged attempts remain auditable without pretending a rejected command mutated gameplay state.

Read-only privileged inspection is not a mutation command and uses the separate append-only audit boundary from `Nexis.Audit.Contracts`.

## Atomic committer guarantee

`IAtomicCommandCommitter` is the only persistence-facing operation exposed by this slice. A production implementation must atomically:

1. verify the durable receipt still belongs to the same CommandId/actor/intent/payload identity and execution token;
2. apply every owner transition through its authoritative owner persistence boundary;
3. persist the terminal command outcome;
4. append authoritative immutable event/history records;
5. append state-changing Admin audit records included in the plan;
6. create durable outbox records for the committed events;
7. commit once.

If any step fails before commit, none of those effects may become durable.

`CommandCommitDisposition.Committed` is the only result that means the staged terminal outcome became authoritative. `ConcurrencyConflict` and `TechnicalFailure` mean the plan did not commit and the caller must reload/re-evaluate or fail according to command policy.

## Event materialization

`CommandCommitPlanBuilder` materializes Core event descriptors into `AuthoritativeEventEnvelope` values before persistence. Event metadata uses:

- a unique EventId;
- authoritative Core evaluation time;
- the **original receipt CorrelationId**, even when a transport retry supplied a different later correlation;
- the descriptor schema version.

The descriptor remains typed. Serialization format belongs to the persistence/outbox adapter and must not leak into Core or public gameplay contracts.

## Replay trace

Each plan carries `CommandExecutionTrace` with:

- Core implementation name/version;
- Core contract version;
- rule version;
- content version;
- evaluation time;
- stable command identity/correlation.

This is the minimum execution provenance required to grow the production-derived replay corpus described by `CORE-ARCHITECTURE.md` and `CORE-RELEASE-GATE.md`.

## What remains intentionally unimplemented

This slice does **not** provide a PostgreSQL/Npgsql committer, owner-specific transition appliers or a pretend generic player-state store. Those belong after the first narrow real owner contracts exist.

The next persistence slice must prove the atomic guarantee with a real transaction-capable adapter and a deliberately multi-owner scenario, including rollback when one owner transition fails.
