# Nexis Universal Component Release Gate

_Status: approved architecture/operations decision, 2026-08-25._

## Scope

This policy applies to **every replaceable moving part of Nexis**, not only `Nexis.Core`.

Examples include, without limitation:

- Core/rules engine;
- Identity/authz implementation;
- Audit/ledger implementation;
- Inventory and Equipment systems;
- Economy/market/bank/escrow systems;
- Combat/PvP systems;
- Travel/World systems;
- Education/Skills/Progression systems;
- Magic/Spirits systems;
- Organizations/guild/consortium systems;
- CIEL subsystems;
- persistence/database adapters;
- realtime/session infrastructure;
- schedulers/background workers;
- query/projection services;
- notification/integration services;
- anti-cheat/abuse-detection services;
- migration/reconciliation tooling when it can affect authoritative data;
- future specialist services or runtimes.

A component upgrade must not become production authority merely because it builds, passes unit tests, or looks better in code review.

This gate is for **material component replacements/version upgrades**. Emergency hotfixes and ordinary low-risk maintenance are a separate release class and do not redefine what counts as an upgrade merely to bypass this policy.

## Principle

Every material replacement or version upgrade is treated as a candidate implementation that must prove compatibility, correctness, stability and operational fitness before cutover.

The exact tests depend on the component, but the release philosophy is universal:

1. isolate the candidate from production authority;
2. reproduce real historical behaviour where possible;
3. run deterministic automated tests appropriate to the component;
4. run diverse AI-assisted adversarial/exploratory testing;
5. run independent Voidsmith human manual testing in parallel;
6. compare and cross-reproduce findings between lanes;
7. soak the exact candidate build for at least 30 continuous days in a production-like environment;
8. block promotion on unexplained material divergence or invariant violations;
9. cut over through stable contracts/configuration/deployment boundaries rather than rewriting unrelated systems;
10. retain a proven rollback path to the previous compatible implementation.

## Production-like proving environment

For **every material component replacement/version upgrade**, provision a brand-new dedicated pre-production VPS that resembles the current production Nexis server and relevant topology as closely as practical.

If a future component runs on infrastructure that cannot meaningfully be represented by one VPS, provision the equivalent brand-new isolated environment that mirrors that component's production topology. This is not a weaker test path; it is the same principle applied to the component's real deployment shape.

The environment should match or closely model the production characteristics that materially affect the component, including applicable CPU, RAM, swap, storage/I/O, operating system, runtime, database, process supervision, network/reverse-proxy path, queues/caches and observability.

Material differences from production must be documented so performance results are interpreted correctly.

The environment uses separate databases, credentials, service accounts, queues, storage, endpoints and secrets. It has no write path to production authoritative state.

Production secrets are never copied merely for realism.

## Immutable candidate

The exact candidate build is identified immutably by version/commit/package/hash.

A material code/configuration change that can alter the candidate's behaviour creates a new candidate and resets the 30-day soak for that candidate build.

Changes strictly to external test-harness instrumentation may be handled separately only when they provably cannot alter candidate semantics or runtime behaviour; that exception is documented as test infrastructure, not silently treated as candidate continuity.

## Historical production evidence

Detailed Nexis logs, events, traces, snapshots and incident records are permanent upgrade assets.

Where the component's behaviour can be reproduced, the proving environment should feed the candidate real historical scenarios from the production-derived replay corpus.

Depending on the component, replay inputs may include:

- commands and authoritative state snapshots;
- emitted/consumed events;
- query inputs and expected knowledge-safe projections;
- transaction/concurrency sequences;
- scheduler occurrences;
- authentication/authorization decisions represented with safe test identities;
- integration request/response fixtures with secrets removed;
- performance/latency profiles;
- historical incidents and known bugs;
- exploit and abuse attempts;
- migration/reconciliation datasets.

A confirmed production bug becomes a permanent regression case for the owning component. A confirmed exploit becomes a permanent adversarial case. A valid rare edge case becomes a permanent compatibility case.

## Three mandatory evidence lanes

### Lane A: deterministic automation

Machine-repeatable tests, replay/conformance checks, invariant assertions, contract tests, integration tests, load tests and telemetry form the objective baseline.

Where deterministic equivalence is required, the harness is the judge. Neither humans nor AI may waive a true invariant violation by opinion.

### Lane B: diverse AI-assisted testing

Multiple independent AI model families/versions may replay, mutate, attack and investigate scenarios in parallel.

Useful roles include exploit hunter, concurrency/race generator, rules/domain specialist, regression archaeologist, divergence investigator, performance hunter, security boundary reviewer and failure-sequence generator.

Specific vendors are not permanent dependencies. Diversity and independence are the requirement.

AI agents operate only against isolated test environments, receive no production-write authority or production secrets, and cannot approve a release by consensus.

### Lane C: Voidsmith human validation

Voidsmith Industries staff or explicitly authorized human testers run manual testing throughout the proving period, in parallel with AI and automation.

Human testing covers realistic end-to-end use, exploratory behaviour, admin/support workflows, stale-state/user-error patterns, long sessions, recovery behaviour and exploit-minded sequences that automation or AI may miss.

No component may pass solely from AI testing. Human validation is a required independent evidence source for every material replacement/version upgrade.

## Parallel comparison and cross-reproduction

The three evidence lanes are compared rather than treated as separate paperwork streams.

Findings should be tagged by provenance, including:

- deterministic-only;
- AI-only;
- human-only;
- independently found by multiple lanes;
- telemetry/performance-only;
- expected version/rule difference;
- unexplained divergence;
- invalid/non-reproducible report.

Material AI findings should be manually reproduced where practical. Material human findings should be converted into deterministic/AI-replayable scenarios where practical. Confirmed useful cases become permanent assets in the owning component's regression/replay corpus.

## Soak duration

Every material Nexis component replacement/version upgrade must complete a minimum continuous **30-day soak** of the exact candidate build in its brand-new isolated production-like proving environment.

The candidate is exercised continuously through representative, burst, stress, recovery and adversarial workloads rather than running tests once and idling.

This 30-day minimum is universal for material version upgrades under this policy. A component-specific policy may add stricter gates or a longer soak, but may not silently shorten the universal minimum. A future deliberate decision to change this rule must explicitly supersede this policy rather than being inferred from convenience.

## Component-specific success criteria

Each component defines measurable gates appropriate to its responsibilities.

Examples:

- Core: semantic equivalence/rule-version correctness, determinism, calculation latency, invariants;
- Economy: conservation, no duplication, settlement correctness, concurrency safety;
- Inventory: ownership/uniqueness/slot invariants;
- Identity: no privilege escalation, session/account mapping correctness;
- Audit: no missing/rewritten authoritative history, visibility correctness;
- Query/projection: no hidden-information leakage, freshness and latency;
- Persistence adapter: transaction correctness, migration/recovery, performance;
- Realtime: ordering, reconnect, state consistency, latency;
- Scheduler: exactly-once/idempotent occurrence handling;
- CIEL: contract correctness, permission/knowledge boundaries, failure containment.

Speed or resource savings never excuse correctness/security regressions unless a changed semantic is explicitly approved as a versioned product decision.

## Promotion blockers

A material candidate cannot be promoted while any applicable blocker remains unresolved, including:

- invariant violation;
- unexplained required-equivalence divergence;
- data loss/corruption risk;
- resource/economy duplication path;
- authorization/privacy/knowledge-boundary regression;
- replay/idempotency/concurrency regression;
- material contract incompatibility with unaffected systems;
- crash, leak or sustained instability;
- material performance regression without explicit approved trade-off;
- material unresolved human or AI finding;
- inadequate required human test coverage;
- inadequate required automated/replay coverage;
- missing rollback compatibility;
- incomplete 30-day soak for the exact candidate build.

## Cutover and rollback

A successful upgrade is cut over through the component's stable contract/configuration/deployment boundary.

Unrelated systems must not require source rewrites merely because one replaceable component implementation changed while its contracts remain compatible.

Before cutover:

- archive release evidence;
- record human release sign-off where required;
- verify compatible contracts/data versions;
- prepare the candidate and previous implementation deployment artifacts;
- verify rollback procedure;
- define enhanced post-cutover monitoring.

The previous proven implementation remains available through the defined rollback window.

## Relationship to Core release policy

`CORE-RELEASE-GATE.md` is the Core-specific specialization of this universal policy. Core retains its stricter replay/determinism/rule-version requirements, but it does not enjoy a unique testing philosophy. The same evidence-first, human-plus-AI, isolated-soak and rollback discipline applies across Nexis.

## Permanent rule

**Never let AI run all tests. Never let manual testing be the only evidence. Never let automated tests be treated as proof of real-world behaviour by themselves.**

Nexis upgrades are proven through independent parallel evidence and cross-comparison before production authority changes hands.
