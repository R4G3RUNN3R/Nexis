# Nexis 2.0 Foundation Implementation Status

_Status: rolling implementation checkpoint, updated 2026-09-01. This file records progress only. It does not supersede `ENGINEERING-MANUAL.md` or any binding architecture/canon document._

## Current branch

`claude/nexis-v2-foundation-continuation-20260829`

Draft PR #4 remains the integration surface and must remain draft until the complete foundation stop conditions in `AGENT-HANDOFF.md` are satisfied.

Existing/current Nexis outside `v2/` remains reference/migration source only. Nothing recorded here authorizes live deployment, live database mutation, or v1 changes.

## Current verified implementation

The V2 branch now contains and has executable coverage for:

- separate stable Core, Identity, Execution, Audit, Eventing, History, Content, Items, Inventory, Equipment, Combat and Automation contract assemblies;
- replaceable `ICoreRulesEngine` with explicit internal evaluator dispatch and no feature implementation, persistence, network or UI dependencies;
- trusted Player/Admin/System/Realtime actor context with Account/Character separation, capability-based platform authority and commercial entitlements kept separate;
- stable `SystemActorKey` identities for automated authorities, kept separate from Account/Character identity and retained through idempotency, persistence and crash recovery;
- deterministic Core evaluation inputs: authoritative UTC time, rule/content versions and replay-safe RNG factories;
- exact integer/rational arithmetic with explicit rounding and checked overflow;
- golden/conformance comparison for baseline and replacement Core implementations;
- versioned, provenance-tagged and content-addressed replay-corpus extraction/retention for the typed Equip Item V1 vertical, with keyed identity pseudonymization, restricted RNG references and deterministic Core re-execution;
- stable operational-observability contracts plus a bounded thread-safe process-local health reporter covering recovery, fencing, outbox, retry, invariant, projection, replay and unexpected concurrency conditions without owning gameplay state;
- CommandId idempotency receipts, canonical payload fingerprints, original-correlation retention and duplicate/integrity-violation handling;
- canonical command codecs and durable crash-recovery payload rehydration without runtime type metadata;
- atomic command commit plans covering owner transitions, terminal command outcome, authoritative history, outbox and state-changing Admin audit;
- canonical global multi-resource lock acquisition plus receipt-aware bounded retries: receipt acquisition occurs once, each post-acquisition retry retains and renews the same fenced token, and exhaustion terminalizes as TechnicalFailure without owner resources/events;
- PostgreSQL command receipt persistence, optimistic owner transition coordination, authoritative history, durable outbox and Admin audit in the dedicated `nexis_v2` schema;
- command execution leases, expired-claim recovery, lease renewal/fencing and ambiguous-commit reconciliation by CommandId;
- leased at-least-once PostgreSQL outbox delivery using EventId as the stable delivery identity;
- multi-worker outbox claiming, lease expiry/recovery, publication acknowledgement and failure-delay redelivery;
- idempotent PostgreSQL projection-consumer checkpoints whose side effect and checkpoint commit atomically;
- exact-version Content Registry resolution with no silent latest-version fallback;
- first real gameplay owner contracts for Inventory possession, Equipment state/placement and Combat participation prerequisites;
- first real Core gameplay rule: `EquipItem`, registered in the reference Core by default;
- real PostgreSQL Equipment owner persistence, including optimistic revision enforcement and multi-slot bindings;
- canonical value-equal `EquipmentSlotSet`, preventing replay/conformance divergence caused by collection reference identity;
- narrow `IAutomatedCommandGateway`/`AutomatedCommandRequest` contracts allowing automated components to submit only a System principal, CommandId, CorrelationId and typed Core intent;
- executable architecture guards preventing future `Nexis.Ciel*` and `Nexis.Scheduling*` projects from directly referencing concrete Core, concrete Execution, Execution internals, PostgreSQL or owner implementation modules;
- executable Identity capability policy derived from current server security facts with exact capability checks, explicit-deny precedence, account binding and security-version freshness; role ordinals and commercial entitlements cannot grant platform authority;
- reusable privileged command-entry authorization contracts/implementation that consume current Identity policy facts and preserve the trusted acting staff AccountId separately from the target identity for downstream atomic Admin Audit.

## First real gameplay vertical proof

`EquipItem` is the first owner-specific end-to-end V2 gameplay proof.

The flow now proves:

1. Application supplies trusted player actor identity plus Inventory, Equipment and Combat snapshots and exact versioned item content;
2. Core validates actor/character identity, possession, combat state, content definition, placement legality and occupied slots;
3. Core emits only an Equipment-owner transition plus semantic `ItemEquipped` event;
4. Inventory remains the possession authority and is read-only for this operation;
5. PostgreSQL applies the Equipment transition using the expected Equipment revision;
6. receipt completion, Equipment state, authoritative history and outbox commit atomically;
7. stale Equipment revision rolls the owner mutation and command side effects back;
8. multi-slot placements persist as one binding occupying all required slots;
9. repeated evaluation of the same trusted inputs produces value-equal transitions/events.

This is intentionally narrow. It proves the architecture with a real owner without authorizing broad Equipment/Inventory/Combat implementation fan-out.

## Automated-authority boundary proof

System work is no longer represented by one anonymous machine actor.

The current foundation proves:

1. trusted automated callers use a stable `SystemActorKey` such as `nexis.scheduler` or `nexis.ciel`, never a fabricated Account or Character;
2. that System principal is part of CommandId idempotency identity, so changing the automated authority changes the actor binding;
3. PostgreSQL command receipts persist `actor_system_key` and enforce mutually exclusive Player/Realtime, Admin and System actor shapes;
4. crash recovery rehydrates and preserves the same System principal rather than degrading it to anonymous SYSTEM authority;
5. the automated submission contract can carry a typed intent but cannot carry owner transitions, a `CoreDecision`, persistence handles or a precomputed gameplay result;
6. future CIEL and Scheduling implementation projects fail architecture tests if they acquire direct references to concrete mutation/persistence boundaries;
7. actual scheduler and CIEL runtime/business logic remain intentionally unimplemented until their behavior is designed, while the mutation-bypass boundary is already enforceable.

CIEL therefore remains advisory/interpretive, and schedulers remain responsible for due-work mechanics rather than authoritative gameplay outcomes.

## Player Log / history projection proof

The Player Log boundary is now represented by separate stable contracts and a replaceable projection implementation.

The current slice proves:

1. Account and Character audiences are exact, mutually exclusive typed identities;
2. unregistered event contracts and schema versions produce no player entry;
3. registered event projectors preserve EventId, CorrelationId and authoritative occurrence time;
4. the Item Equipped V1 projector validates the complete typed event before exposing only its safe placement label;
5. incomplete/malformed typed event payloads fail closed;
6. internal Admin Audit entries never project, while material effects require an exact target Account and explicit safe player reason;
7. acting staff identity, internal action/outcome, case metadata, item-instance identity and raw payloads remain undisclosed;
8. the History contract/projection assemblies reference no concrete Core, concrete Execution or PostgreSQL implementation.

The slice adds no Player Log persistence, query API, runtime consumer registration or authoritative mutation path. `PLAYER-LOG-BOUNDARY.md` is the focused contract record.

## Core replay corpus proof

The internal replay corpus is now separate from Player Log and has an executable first typed scenario boundary.

The current slice proves:

1. historical `CoreEvaluationRequest`, `CoreDecision` and `CommandCommitPlan` facts are cross-validated before extraction;
2. the existing CommandId, original CorrelationId, EventId/causation, canonical payload fingerprint, authoritative UTC time and Core/rule/content versions are retained;
3. AccountId, CharacterId and ItemInstanceId are keyed-pseudonymized while rule-required equality relationships survive;
4. raw command JSON, actor capabilities/entitlements/security version, raw RNG material, credentials and arbitrary extra fields cannot enter the artifact;
5. restricted deterministic RNG is represented only by an opaque resolver reference and is supplied to Core at replay time;
6. ordinary, known-bug, exploit, concurrency and high-value cases use typed canonical tags and provenance;
7. semantically unordered typed inputs normalize to one SHA-256 content-addressed scenario;
8. a compatible `ICoreRulesEngine` can replay the artifact without owner persistence or authoritative effects;
9. immutable file retention deduplicates identical cases and detects tampering/collision;
10. unknown intent schemas fail closed until an explicit privacy-reviewed codec is added.

Only Equip Item schema V1 is registered. No production source was accessed and no real production record was harvested in this repository slice. Authorized offline production export/selection may now populate permanent corpus packs without granting live-database access. `CORE-REPLAY-CORPUS.md` is the focused boundary record.


## Current verification evidence

Checkpoint `4de3b830c19c5659c042aa342d86e3361a0c05a7` passed the complete V2 workflow against disposable PostgreSQL 18.6 after the automated-authority/bypass changes:

- solution restore: passed;
- Release build: **0 warnings, 0 errors**;
- architecture/Core/execution/security suite: **105 passed, 0 failed, 0 skipped**;
- PostgreSQL integration suite: **28 passed, 0 failed, 0 skipped**.

That run covers, among other things:

- stable differentiation of scheduler and CIEL System actor identities;
- the narrow Automation contract dependency allow-list;
- the rule that automated submission envelopes carry intents but not transitions/precomputed outcomes;
- future CIEL/Scheduling project mutation-bypass dependency guards;
- deterministic `EquipItem` reevaluation;
- actor mismatch, active-combat, missing-possession, unsupported-placement, occupied-slot and content-definition rejection paths;
- real Equipment persistence and authoritative history/outbox emission;
- stale Equipment revision rollback;
- multi-slot Equipment persistence;
- concurrent CommandId acquisition and payload-integrity rejection;
- multi-owner all-or-nothing rollback/success infrastructure;
- Admin audit atomicity;
- command crash recovery, lease fencing and ambiguous reconciliation;
- independent outbox workers not claiming the same rows;
- expired outbox lease recovery with stable EventId and incremented attempt count;
- publish acknowledgement and redelivery after publish/failure ambiguity;
- idempotent projection checkpointing and rollback on projection failure.

Earlier PostgreSQL tests exposed a wall-clock leak in initial outbox availability; normal command commits now write authoritative command completion time explicitly. This remains covered by the green integration suite.

On `new-voidsmith`, checkpoint `ec9239a` additionally passed restore and a Debug solution build with **0 warnings, 0 errors**. The architecture/Core/execution/security suite passed **112/112** after adding seven Identity capability-policy adversarial tests. The full solution run reported **112 passed, 28 skipped, 0 failed**; all 28 skips were PostgreSQL integration tests because `NEXIS_TEST_POSTGRES_CONNECTION` is not yet configured on that host. The earlier disposable-PostgreSQL proof above remains the latest complete database-backed run.

The Player Log finishing review independently reran the required workflow from `v2/` with .NET SDK 10.0.111: restore passed; Debug build passed with **0 warnings, 0 errors**; the full solution reported **154 total, 126 passed, 28 skipped, 0 failed**. All 28 skips are PostgreSQL integration tests because `NEXIS_TEST_POSTGRES_CONNECTION` is absent; this review created or used no database. The Player Log/History in-memory and architecture tests are included in the 126 passing tests.

The replay corpus repair independently reran the required workflow from repository root with .NET SDK 10.0.111: Release build passed with **0 warnings, 0 errors**; the complete Architecture/Core/security/replay executable passed **140/140**; and the separate PostgreSQL integration executable reported **28 total, 0 passed, 28 skipped, 0 failed**. Across both executables, **168 tests were discovered: 140 passed and 28 skipped**. All skips are because `NEXIS_TEST_POSTGRES_CONNECTION` is absent. No credentials were invented and no database or production source was accessed.

Checkpoint `14d7a46edeb6258ec865e8609f56e07a646b6a59` completed the remaining replay evidence hardening and passed a Release build with **0 warnings, 0 errors**, the complete Architecture/Core/execution/security/replay executable with **146/146**, and the disposable PostgreSQL 18.6 integration executable with **28/28** and no skips.

The subsequent privileged-entry RED/GREEN slice passed a Release build with **0 warnings, 0 errors** and the complete Architecture/Core/execution/security/replay executable with **153/153**. The reusable boundary denies ordinal-role, entitlement, Character, stale-security, target-substitution, implicit-grant and explicit-deny bypasses while retaining the real acting staff AccountId only after authorization.

The operational-observability RED/GREEN slice added `Nexis.Operations.Contracts` and `Nexis.Operations`; solution restore passed, the Release build passed with **0 warnings, 0 errors**, and the complete Architecture/Core/execution/security/replay/operations executable passed **158/158**. The current slice provides structured sinks and health summaries; validated C7 fixes must wire producers as their quarantine, dead-letter and classification behavior is implemented.


The reference Core implementation version remains `0.5.0-foundation`; the stable Core contract remains V1.

## Real multi-owner gameplay proof (C3)

`UnequipItem` under M-reserve is the first Nexis 2.0 operation that legitimately writes two real
authoritative owners in one atomic command. The proof demonstrates:

1. Equipment clears the equipped reference;
2. Inventory releases the same item reservation;
3. both transitions commit in one transaction or neither does, proven for a stale Inventory revision
   and a stale Equipment revision independently;
4. a repeated CommandId reconstructs the original outcome and never releases or duplicates twice;
5. concurrent unequips produce exactly one winner, and an opposing reservation attempt from a stale
   snapshot cannot double-spend the item;
6. an unequip denied by an authoritative removal restriction commits neither owner transition, denied
   independently by Core and by the Inventory persistence boundary;
7. no invented balance value, cost, cooldown or content is involved.

Possession is never created, destroyed or transferred. Stats, skills and knowledge are not equip
prerequisites, and `MReserveFreedomRuleTests` asserts that mechanically.

`ITEM-AVAILABILITY-RESERVATION.md` records the boundary and the explicit future curse integration
seam. No Curse owner, curse state, questline or purification path exists.

## Public player identity boundary

The account-scoped stable `PublicPlayerId` is implemented. One normal account is one player is one
playable character, with no slots, alts or campaign characters, and `AccountId`, `CharacterId`,
`PublicPlayerId` and display name remain four permanently distinct concepts.

Proven mechanically:

1. a display-name change leaves `AccountId`, `CharacterId` and `PublicPlayerId` unchanged;
2. `PublicPlayerId` exposes no bridge to an internal identifier or actor authority, and no
   `TrustedActorContext` factory accepts one;
3. a forged client-supplied `PublicPlayerId` yields no controllable `CharacterId`;
4. the public projection leaks neither `AccountId` nor `CharacterId`;
5. the public projection leaks no role, capability, security-version or entitlement data, and its
   member list is pinned to exactly two facts;
6. no public identifier, including Hennet's, grants platform authority, even under a policy granting
   the capability to every staff bundle;
7. one-character-per-account is enforced by the `account_id` primary key without collapsing the
   identifier types;
8. concurrent provisioning converges on exactly one identity, with ordinals drawn from a sequence
   rather than `max() + 1`.

Immutability is enforced independently in the contract, in a database trigger refusing any identifier
reassignment, and by uniqueness constraints. `PUBLIC-PLAYER-IDENTITY.md` records the boundary.

## Foundation work still incomplete

The branch is materially further along, but PR #4 must remain draft. Remaining stop-condition work includes:

1. migration/reconciliation tooling before any v1-to-v2 state movement, still gated by unresolved human decisions;
2. broader multi-owner coverage across further gameplay domains, now that the first real two-owner proof (C3, `UnequipItem`) is delivered against real PostgreSQL;
3. reproduction and resolution of valid threat-model findings, producer wiring for the operational surface, and the wider foundation stop-condition audit before broad gameplay implementation.

The real multi-owner proof is delivered. Under the approved M-reserve model, equip reserves the item instance in Inventory and binds it in Equipment, and `UnequipItem` unbinds and releases, so both are genuine two-owner commands writing two real authoritative owners rather than synthetic transactional owners. No mechanic, cost, cooldown, reward or content value was invented to achieve it, and possession never moves.

Exact owner/domain contracts should continue to be introduced only when the corresponding gameplay design is sufficiently settled. Do not create generic state bags merely to make the architecture look more complete.

## Next safe implementation boundary

The replay, privileged-entry, operational-observability, real multi-owner (C3) and public player identity foundation boundaries are implemented and adversarially covered. The next safe slice is evidence-first reproduction and resolution of the three known L3 History/Player Log findings. Migration remains gated; no live source access, gameplay fan-out, generic migration bucket or canon change is authorized.

## Verification discipline

Every dependent code slice must pass the V2 restore/build/test workflow before being treated as stable. A green CI run is necessary evidence, not production-release approval. The Universal Component Release Gate and 30-day soak requirements still apply to material production promotion.
