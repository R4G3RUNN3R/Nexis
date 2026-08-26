# Nexis Core Rule Dispatch

_Status: foundation implementation design, 2026-08-26. Subordinate to `CORE-ARCHITECTURE.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `ENGINEERING-MANUAL.md`._

## Purpose

`ICoreRulesEngine` is the stable engine-facing boundary. The selected C# Core uses explicit internal rule-evaluator registration keyed by the intent's `ContractDescriptor` name and schema version. Surrounding systems never call evaluator classes directly.

This dispatch layer is a concrete-Core implementation detail. A future replacement Core may use a different internal architecture while satisfying the same stable contracts and conformance suite.

## Trusted execution context

Each evaluation now includes a server-created `TrustedActorContext` from `Nexis.Identity.Contracts` in addition to CommandId, CorrelationId, authoritative time, rule/content versions and deterministic RNG inputs.

The actor context deliberately separates:

- stable AccountId from CharacterId;
- player, staff and system actor kinds;
- Player/Admin/System/Realtime mutation lanes;
- effective platform capability keys;
- commercial entitlement keys;
- server-side security/session version.

`AccountRole` is not carried into Core actor authority. Character names, titles, public IDs, guild ranks and client-supplied role fields are also absent. Staff Admin-lane actor context does not impersonate a Character; any character being corrected/acted upon belongs in the typed command intent and is checked by the owning rules/authorization flow.

## Evaluation flow

For a supported request:

1. verify the Core contract version;
2. read the typed intent contract descriptor;
3. select the exactly registered evaluator;
4. create one fresh deterministic RNG stream;
5. create the internal execution context containing trusted actor facts, authoritative time, rule/content versions, typed snapshots/content and that one RNG stream;
6. invoke the evaluator;
7. return its authoritative `CoreDecision` unchanged through `ICoreRulesEngine`.

Evaluators do not receive the RNG factory and cannot manufacture new trusted actor context. They receive the server-created actor object unchanged.

## Registration and error rules

- one evaluator per exact intent contract name + schema version;
- duplicate registrations fail during Core construction;
- no reflection scanning or magic service locator;
- no generic action/property dictionary;
- unregistered intents return mutation-free `TechnicalFailure`;
- unexpected evaluator/configuration failures propagate and are not translated into fake in-world losses.

## Persistence and ownership

The dispatcher does not load databases, lock rows, persist state, write history, manage idempotency receipts or emit external side effects. Application coordinates those responsibilities and owners persist only their addressed transitions.

## Dependency rule

Concrete Core may reference the tiny `Nexis.Kernel` substrate and stable `*.Contracts` assemblies required for typed rule inputs. It may not reference `Nexis.Modules.*`, Host/API, persistence, EF/Npgsql, network, UI or other implementation assemblies.

This rule lets future domain contracts be added without weakening replaceability: contract dependencies are allowed; concrete-system dependencies are not.
