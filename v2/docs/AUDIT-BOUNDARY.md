# Nexis 2.0 Audit Contract Boundary

_Status: foundation implementation slice, 2026-08-26. This document narrows `IDENTITY-AUTHORIZATION.md` and `COMMAND-EXECUTION.md`._

## Stable contract split

Administrative audit vocabulary now lives in `Nexis.Audit.Contracts`; `Nexis.Modules.Audit` is the replaceable implementation assembly.

Stable audit contracts use typed Nexis identities:

- `AuditId` for audit record identity;
- `AccountId` for acting/target platform identity;
- `CorrelationId` for the causal command/read operation;
- optional `EventId` for a causative authoritative gameplay event.

Character names, titles and raw client role claims are not authority and are not audit actor identity.

## Append-only rule

`AuditEntry` is an immutable fact. Normal operation does not update/delete historical audit entries. Corrections, reversals and later findings append new linked records/events instead of rewriting history.

`IAppendOnlyAuditLog` exists for privileged operations that do **not** participate in a gameplay state mutation transaction, especially sensitive authorized reads.

State-changing admin operations must not call that append boundary independently and then mutate gameplay state separately. Their audit entries belong in the same atomic command commit as the owner transitions, terminal command outcome, authoritative events and outbox. That integration is the next command-commit refinement.

## Visibility

`AuditVisibility.InternalOnly` and `AuditVisibility.PlayerMaterialEffect` preserve the existing policy distinction. The internal audit record is not itself a Player Log entry. `SafeAdminAuditPlayerLogProjector` emits nothing for internal-only records and requires an exact target Account plus explicit `SafePlayerReason` for a material-effect entry; acting staff identity, internal action/outcome and case metadata are never copied. The complete player-facing rules are in `PLAYER-LOG-BOUNDARY.md`.

## Player-disclosable reason is validated at the write boundary

Audit history is append-only and immutable. A `SafePlayerReason` that the Player Log cannot project
would therefore be a permanently poisoned row that throws on every projection attempt, so the reason
is validated when the `AuditEntry` is constructed rather than when it is first displayed.

`PlayerDisclosableAuditText` applies the same normalization and the same bound as
`PlayerLogPlainText`, and **rejects rather than truncates**: silently shortening a staff-written
reason would change the recorded justification for a privileged action. Validation applies whenever a
reason is supplied, not only for currently player-visible entries, because the field is
player-disclosable by definition and the row is immutable once written.

An absent reason (null or whitespace) is stored as absent and is the one input where the two
boundaries deliberately differ. That is not a poisoning risk: the projector refuses to disclose a
player-material entry that carries no reason at all.

`Nexis.Audit.Contracts` cannot reference `Nexis.History.Contracts` without a dependency cycle, so the
rules are restated rather than shared. An architecture test asserts the two boundaries reach exactly
the same decision on adversarial inputs, so drift fails the suite.
