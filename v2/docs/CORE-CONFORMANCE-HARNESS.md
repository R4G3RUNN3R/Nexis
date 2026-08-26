# Nexis Core Conformance Harness

_Status: foundation implementation note, 2026-08-26. Subordinate to `CORE-ARCHITECTURE.md`, `CORE-RELEASE-GATE.md`, `STATE-OWNERSHIP.md` and `ENGINEERING-MANUAL.md`._

## Purpose

A replaceable Core is useful only if replacement compatibility can be proven with repeatable evidence.

The Core Conformance Harness executes the same named golden scenario against any implementation of `ICoreRulesEngine` and compares the authoritative semantic result. It is deliberately implementation-neutral: the scenario supplies stable Core contracts and controlled inputs, while the selected Core supplies only the rules/logic/calculation result.

The harness is not a persistence test, API test or UI test. It must not grant a candidate Core access to owner databases or external services merely to make a scenario pass.

## Golden scenario requirements

Every conformance scenario must define:

- a stable scenario name;
- the required `CoreContractVersion`;
- a factory that produces semantically identical fresh `CoreEvaluationRequest` instances;
- immutable typed intent, owner snapshots and relevant Content Registry inputs;
- fixed authoritative evaluation time where time matters;
- fixed rule/content versions;
- deterministic RNG inputs capable of reproducing the same draw sequence;
- a semantic projection/fingerprint that includes every output field material to the rule being tested;
- an expected golden fingerprint or equivalent invariant assertions.

A scenario must not compare object identity, memory layout, private implementation type names or incidental serialization formatting. Candidate implementations may differ internally while remaining semantically equivalent.

## Deterministic RNG rule

`CoreEvaluationContext` carries an `IDeterministicRandomFactory`, not one shared mutable RNG cursor.

Each Core evaluation creates a fresh random stream from the same retained authoritative RNG inputs. Therefore, if the same request is re-evaluated because Application reloads/locks contested state, the random stream can begin from the same deterministic position rather than silently advancing because an earlier speculative evaluation consumed draws.

This rule is important for:

- transaction re-evaluation;
- historical replay;
- Core-vNext shadow comparison;
- support investigation;
- exploit review;
- deterministic golden tests.

The production RNG factory/stream implementation remains outside this foundation slice. It must later preserve enough restricted replay information to reproduce draws without exposing exploitable seeds or future random outcomes to players.

## Content inputs

`CoreEvaluationRequest` now has an explicit `ICoreContentInput` collection in addition to authoritative owner snapshots.

Static/versioned definitions from the Content Registry are therefore supplied to Core through typed contracts rather than read directly from a database, filesystem, HTTP service or registry implementation. Domain-specific content contracts retain their own typed IDs and fields; there is no generic content dictionary or JSON bag in the Core boundary.

## Comparison modes

The initial harness supports two useful foundation checks:

1. **Golden check** - run one implementation against a scenario's expected semantic fingerprint.
2. **Baseline/candidate comparison** - run the same scenario against two implementations and verify that their semantic fingerprints are equivalent.

This is intentionally small. As real gameplay contracts arrive, the harness should grow scenario packs for rule domains rather than growing one universal test object.

Future production-derived replay should extend the same model with persisted scenario manifests, checksums, provenance, transition/event details, timing telemetry and intentional rule-version divergence classification defined by `CORE-ARCHITECTURE.md` and `CORE-RELEASE-GATE.md`.

## Foundation coverage

The initial tests cover:

- the reference Core's unsupported-intent golden result;
- an independently implemented compatible replacement producing the same result;
- deliberate semantic divergence being detected;
- deterministic RNG replay when the same request is evaluated more than once;
- two deterministic Core implementations producing the same RNG-backed result;
- deliberate RNG/result divergence being detected;
- immutable request copies of owner snapshots and Content Registry inputs;
- invalid default Core contract versions being rejected at the request boundary.

The current scenarios are architecture probes, not gameplay rules. They exist to prove the replacement mechanism before Combat, Economy, Travel, Magic or other domain logic is introduced.

## Next Core implementation slices

After this harness is build-verified, continue in this order unless a newer approved design supersedes it:

1. deterministic numeric/rounding policy for authoritative calculations;
2. stable owner-specific snapshot/transition contracts for the first proof domains;
3. Content Registry contract/version negotiation details required by those domains;
4. selected Core rule dispatch/evaluator structure behind `ICoreRulesEngine`;
5. first real golden rule pack using typed domain contracts;
6. command/application integration and one atomic multi-owner vertical proof;
7. production replay manifest/storage tooling after event/history persistence exists.

Do not use the conformance harness as permission to begin broad gameplay implementation before the stop conditions in `AGENT-HANDOFF.md` are satisfied.

## Verification status

The files in this slice require `dotnet restore`, build with warnings as errors, and test execution on a .NET 10 environment before the branch can be described as green. Static review is useful but is not substitute evidence.
