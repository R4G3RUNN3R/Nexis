# Nexis Core Release Gate

_Status: approved architecture/operations decision, 2026-08-25._

## Purpose

No new `Nexis.Core` implementation becomes production authority merely because unit tests, integration tests or the Core Conformance Suite pass.

Every candidate Core release must first survive an isolated, production-like proving period on a newly provisioned VPS before production cutover is permitted.

The goal is to prove three things with real historical evidence:

1. the candidate preserves the required gameplay semantics and invariants;
2. intentional rule changes differ only where explicitly expected;
3. the candidate is measurably stable and operationally equal to or better than the active Core under sustained load.

## Fresh pre-production VPS

For each candidate Core release being considered for production authority, provision a brand-new pre-production VPS.

The test host should resemble the current production Nexis server as closely as practical in the areas that materially affect Core behaviour and performance, including:

- CPU architecture/class and comparable vCPU allocation;
- RAM and swap policy;
- storage class and approximate I/O characteristics;
- operating-system family/version;
- .NET/runtime or candidate-runtime version;
- process-manager/service configuration;
- database engine/version and materially relevant settings;
- network/reverse-proxy shape where relevant to end-to-end measurement;
- logging, metrics and monitoring instrumentation.

Exact hardware identity is not required when the provider cannot offer it, but material differences must be documented so performance comparisons are interpreted correctly.

The pre-production host is isolated from production authority. It uses separate databases, credentials, service accounts, queues, storage, endpoints and secrets. It must have no write path to production game state.

Production secrets are not copied merely to make the environment look realistic. Use dedicated test credentials and synthetic/restricted integration endpoints.

## Immutable candidate build

The Core binary/package/commit being soaked is identified immutably by build/version/commit/hash.

A code change to the candidate Core creates a new candidate. A material Core-code change during the proving period restarts the 30-day soak for the new candidate build. Changes strictly to external test-harness instrumentation may be treated separately when they cannot alter Core semantics or runtime behaviour, but that exception must be documented.

This prevents a release from accumulating twenty-nine days of trust and then quietly becoming different code on day thirty.

## Replay corpus

The candidate Core is fed the full production-derived replay corpus available for the release, not merely a small hand-picked smoke suite.

The corpus should include, as available:

- ordinary gameplay traffic;
- high-value economy operations;
- inventory/equipment transitions;
- combat and PvP;
- travel/timer completions;
- education/progression;
- skills, magic and resource use;
- organization/guild/consortium operations;
- known historical bugs;
- rare edge cases;
- rejected and conflicted commands;
- exploit/adversarial attempts;
- concurrency races;
- admin corrections/reversals where Core evaluation is relevant;
- previously compensated outcomes;
- worst-case or historically slow evaluations;
- synthetic stress/load scenarios that production history has not yet supplied.

Replay data must preserve privacy/security boundaries. Authentication secrets, session tokens, passwords, API keys and unrelated sensitive information are excluded. Restricted deterministic RNG/replay inputs remain internal and access-controlled.

## Multi-agent adversarial test swarm

The month-long proving period deliberately uses multiple independent AI model families as test operators rather than relying on one model or one prompt strategy.

The preferred future setup is several simultaneous independent agents across multiple model families, for example ChatGPT/OpenAI models, Codex, Claude, Gemini and optionally research-oriented systems such as Perplexity or future equivalents. Where useful, two or three different model versions/configurations/instances from the same family may also run independently.

Provider names are not permanent architecture dependencies. The permanent rule is model diversity: use multiple independent reasoning/code-analysis families so correlated blind spots are less likely to survive.

Each agent operates only against the isolated test environment and the approved replay/testing interfaces. AI agents receive no production-write capability and no production secrets.

Useful independent roles include:

- historical replay verifier: replays known production scenarios and checks semantic equivalence;
- adversarial scenario mutator: changes timing/order/state combinations around real scenarios to search nearby edge cases;
- exploit hunter: attempts resource duplication, authority escalation, stale-state abuse, replay/idempotency abuse and invariant-breaking sequences;
- concurrency/race synthesizer: turns valid historical operations into simultaneous or reordered contention scenarios;
- rules specialist: focuses on one domain such as Combat, Economy, Magic, Travel or Organizations and generates boundary cases;
- performance hunter: searches for scenarios producing pathological latency, CPU, allocation or memory behaviour;
- divergence investigator: examines differences between active-Core historical outcomes and candidate-Core results and proposes reproducible minimal cases;
- regression archaeologist: replays every known historical bug/fix and mutates the conditions around it to detect neighbouring regressions.

Agents should initially run independently rather than sharing each other's conclusions, preserving diversity. A later cross-review phase may let agents challenge or reproduce one another's findings.

AI output is evidence generation, not release authority. The deterministic test harness is the judge and recorder. No model may waive an invariant violation, mark an unexplained divergence acceptable, or promote a Core by consensus.

Every AI-generated scenario worth retaining is normalized into the same machine-readable replay format and records provenance such as generator/model family, model/version when available, scenario generation strategy, source historical case(s), deterministic seed/input set and expected/invariant assertions. Valuable generated scenarios become permanent replay-corpus assets for future Core releases.

## Thirty-day soak

A candidate Core must complete a minimum continuous 30-day pre-production soak before production promotion.

During the soak the environment repeatedly executes the historical corpus and approved stress/adversarial suites. The purpose is not to run each scenario once and then idle for the remaining month. Scenarios are continually replayed, shuffled, batched, mutated and stressed so long-duration problems can surface.

The test swarm may generate additional scenarios continuously from the replay corpus throughout the month. Newly discovered valid bugs, edge cases, exploits or performance pathologies are added to the permanent corpus and re-run against both the current production Core semantics and the candidate as appropriate.

The soak should exercise:

- normal representative load;
- burst traffic;
- sustained high load;
- repeated long-running execution;
- concurrency/contention patterns;
- process restarts and recovery;
- scheduler/system-command replay where relevant;
- database reconnect/retry behaviour around the Core boundary;
- memory/handle/resource-leak detection;
- telemetry/logging stability;
- deterministic-repeatability checks;
- accelerated historical time where safe and meaningful, in addition to real wall-clock soak duration.

The test Core is never authoritative during this month and never commits to production state.

## Comparison modes

The proving environment supports at least three comparison modes:

### 1. Semantic-equivalence replay

Use the same compatible gameplay rule/content versions and controlled inputs that produced a historical result. The candidate is expected to produce the same authoritative semantics/invariants except for explicitly allowed non-semantic representation differences.

### 2. Intentional rule-evolution replay

Use a newer approved gameplay rule/formula version. Differences are expected only where the rule specification says behaviour changed. Unrelated divergence remains a blocker.

### 3. Performance/stability replay

After correctness is established, compare evaluation latency, throughput, CPU, memory, allocations, I/O pressure and long-duration stability under the same normalized scenarios and controlled workload profiles.

Speed never excuses semantic regression.

## Required measurements

Track at minimum:

- scenario counts and coverage by domain/category;
- identical/equivalent result rate;
- expected rule-version differences;
- unexplained semantic divergences;
- invariant violations;
- replay failures due to missing historical context;
- idempotency/replay correctness;
- concurrency/race outcomes;
- p50/p95/p99 evaluation latency;
- throughput under representative and stress load;
- CPU consumption;
- memory working set and allocation rate;
- sustained resource growth/leak indicators;
- crash/restart count;
- technical failure/error rate;
- deterministic repeatability rate;
- AI-generated unique scenario yield and confirmed defect yield.

Results are stored as release evidence linked to the immutable candidate build.

## Promotion blockers

A candidate Core cannot be promoted while any of the following remains unresolved:

- unexplained semantic divergence in a required-equivalence scenario;
- invariant violation;
- known resource/economy duplication path;
- authorization/identity boundary regression;
- non-deterministic result where determinism is required;
- replay/idempotency regression;
- material data-contract incompatibility;
- unexplained crash or sustained resource leak;
- material performance regression without an explicitly approved trade-off;
- missing rollback compatibility;
- failure to complete the minimum 30-day soak for the exact candidate build.

## Cutover

After the candidate completes the release gate:

1. freeze the approved candidate build;
2. archive the complete soak/replay report and unresolved-none assertion;
3. confirm compatible contracts/data/rule versions;
4. confirm deployment and rollback packages for both candidate and previous Core;
5. perform production cutover through configuration/composition/deployment, not surrounding-system rewrites;
6. run immediate production smoke/invariant checks;
7. retain the previous compatible Core for the defined rollback window;
8. continue enhanced monitoring after cutover.

The isolated proving VPS remains non-authoritative. It may be retained briefly for post-release comparison or securely destroyed/reprovisioned according to operations policy after evidence is preserved.

## Core-release principle

A new Core earns production authority through reproduced history, adversarial testing, sustained operation and measured evidence. It does not receive authority merely because it is newer, faster, written in a fashionable language, or has been admired enthusiastically by several AIs.
