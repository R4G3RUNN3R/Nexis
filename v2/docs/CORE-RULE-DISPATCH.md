# Nexis Core Rule Dispatch

_Status: foundation implementation design, 2026-08-26. Subordinate to `CORE-ARCHITECTURE.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `ENGINEERING-MANUAL.md`._

## Purpose

`ICoreRulesEngine` is the stable engine-facing boundary. The selected C# Core still needs an internal mechanism for routing a typed intent to the rule package that understands it without exposing those implementation classes to surrounding systems.

The reference Core therefore uses explicit internal rule-evaluator registration keyed by the intent's `ContractDescriptor` name and schema version.

This dispatch layer is intentionally a concrete-Core implementation detail. A future replacement Core may use a completely different internal architecture while satisfying the same stable `Nexis.Core.Contracts` boundary and conformance suite.

## Permanent boundary

Surrounding systems call:

`ICoreRulesEngine.Evaluate(CoreEvaluationRequest)`

They do not call or reference:

- `CoreRuleExecutionContext`;
- `ICoreRuleEvaluator`;
- evaluator registries;
- concrete combat/economy/travel/etc. evaluator classes;
- Core implementation composition details.

The current internal types are deliberately `internal`. The architecture test assembly receives friend access only so the implementation seam can be tested without making it a public dependency surface.

## Registration rules

- one evaluator is registered for one exact intent contract name + schema version;
- duplicate registrations fail during Core construction;
- null evaluator entries/contracts fail immediately;
- no reflection scanning or magic assembly discovery is required;
- no generic string action switch or `Dictionary<string, object>` payload is introduced;
- an unregistered intent produces `TechnicalFailure` with `core.intent.unsupported` and no state transitions/events;
- a Core contract version unsupported by the selected implementation remains `core.contract.unsupported`.

Intent schema version and gameplay `RuleVersion` remain separate concepts. A contract schema change alters the shape/meaning of the intent boundary. A RuleVersion change may alter gameplay semantics while using the same compatible intent schema.

## Evaluation flow

For a supported request:

1. verify the Core contract version;
2. read the typed intent's contract descriptor;
3. select the exactly registered evaluator;
4. create one fresh deterministic RNG stream from the request's factory;
5. create the internal execution context containing authoritative time, rule/content versions, typed snapshots, typed content inputs and that one RNG stream;
6. invoke the evaluator;
7. return the evaluator's authoritative `CoreDecision` unchanged through the stable boundary.

A rule evaluator does not receive the RNG factory. It receives one stream for one evaluation. This prevents one rule package from creating competing cursors or accidentally making draw order dependent on how many times it asks the factory for a new stream.

## Error semantics

Expected in-world rule outcomes use the existing result vocabulary such as Rejected or DomainFailed.

Unexpected programming/configuration failures are not converted into fake gameplay outcomes. Evaluator exceptions propagate to the Application/execution boundary, where infrastructure records a TechnicalFailure according to `COMMAND-EXECUTION.md` without pretending that gameplay legitimately consumed resources or produced an in-world loss.

A null decision or null deterministic random stream is therefore treated as an implementation defect and fails loudly.

## Persistence and ownership

The dispatcher does not load state, acquire database locks, write owner tables, record idempotency receipts, commit transactions or publish external side effects.

Those remain outside Core:

- Application loads current owner snapshots and coordinates execution/concurrency;
- Core evaluates rules;
- authoritative owners persist only their addressed typed transitions;
- persistence/history/outbox infrastructure commits according to the approved command boundary.

Rule evaluators therefore operate only on the immutable request/context they are given and emit `CoreDecision` outputs.

## Dependency rule

The concrete Core now directly references only the two approved foundation assemblies required by its implementation:

- `Nexis.Core.Contracts` for the stable engine-facing contracts;
- `Nexis.Kernel` for universal command/event/randomness primitives.

It still does not reference Identity, Economy, Inventory, Combat, Travel or any other system implementation/persistence assembly.

## Next safe step

After this dispatcher passes CI, the next Core work should define the first narrow owner-specific contract packages and one real golden rule pack. The preferred proof remains a deliberately small multi-owner operation rather than immediately implementing broad Combat/Economy/World systems.
