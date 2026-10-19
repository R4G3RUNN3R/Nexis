# Nexis V2 Foundation Stop-Condition Audit

_Status: dated audit record, 2026-09-03. Subordinate to `ENGINEERING-MANUAL.md`, `AGENT-HANDOFF.md`, `CORE-ARCHITECTURE.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `IDENTITY-AUTHORIZATION.md`. It records findings only; it changes no architecture, canon or ownership, and it authorizes nothing._

## Purpose and scope

`AGENT-HANDOFF.md` lists thirteen stop conditions that gate broad Education, Combat, Economy, Magic, Spirits, World, Travel, Marketplace, Guild and Consortium implementation, plus a longer list of required architecture tests. Until now those lists were checked narratively, slice by slice. This audit walks both lists once, end to end, and records for each item the exact code and test evidence, the remaining gap, and whether that gap is solvable in code now or is gated on a human, design or migration decision.

Branch `claude/nexis-v2-c5-stop-audit-20260902`, base `f72e8bc`.

### Evidence honesty

Three grades of evidence are used, and they are never blurred:

- **Observed** - a check this session ran and whose result was read. Only the C5 producer classes, the classes exercising the paths C5 changed, the new blob guard and the full Release build are Observed here.
- **Present** - the named test exists in the repository and asserts the named property, verified by reading it. Its last recorded green run is in `IMPLEMENTATION-STATUS.md`, not in this session.
- **Absent** - no executable evidence exists.

Per `ENGINEERING-MANUAL.md` and `COMPONENT-RELEASE-GATE.md`, AI never runs all tests. This audit therefore deliberately does **not** claim a whole-suite result, and no grade below is release approval.

### Verification observed for this audit

| Check | Result |
| --- | --- |
| `dotnet build Nexis.slnx -c Release` | Build succeeded, **0 warnings, 0 errors**, SDK 10.0.111 |
| `Nexis.Architecture.Tests --filter FullyQualifiedName~ClaudeC5OperationalProducerTests` | 18/18 passed |
| `Nexis.Architecture.Tests --filter FullyQualifiedName~ClaudeC5GlobalStateBlobGuardTests` | 9/9 passed |
| `Nexis.Architecture.Tests --filter FullyQualifiedName~ReplayCorpusTests` | 25/25 passed |
| `Nexis.Persistence.Postgres.Tests --filter FullyQualifiedName~ClaudeC5PostgresOperationalProducerTests` | 10/10 passed |
| `Nexis.Persistence.Postgres.Tests --filter FullyQualifiedName~PostgresOutboxIntegrationTests` | 8/8 passed |
| `Nexis.Persistence.Postgres.Tests --filter FullyQualifiedName~PostgresExecutionIntegrationTests` | 19/19 passed |

PostgreSQL runs used a disposable `postgres:18.6-alpine` container created and destroyed for this session. No live, production or V1 database was contacted.

## Part A - the thirteen `AGENT-HANDOFF.md` stop conditions

| # | Stop condition | Status | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| 1 | Solution restores/builds cleanly | **PASS** (Observed) | `dotnet build Nexis.slnx -c Release`, 0/0, warnings-as-errors via `Directory.Build.props` | none |
| 2 | Dependency and ownership architecture tests exist and pass | **PASS** (Present; blob guard Observed) | `CoreArchitectureTests`, `IdentityArchitectureTests`, `ExecutionArchitectureTests`, `AuditArchitectureTests`, `EventingArchitectureTests`, `HistoryArchitectureTests`, `AutomationArchitectureTests`, `ClaudeContinuationAutomationGuardTests`, and the `ClaudeC5GlobalStateBlobGuardTests` added by this audit | see Part B for per-item detail |
| 3 | Core public contracts separated from concrete Core | **PASS** (Present) | `CoreArchitectureTests.CoreContracts_DoNotReferenceConcreteCoreOrSystemImplementations`, `.ConcreteCore_DependsOnlyOnKernelAndStableContractAssemblies`, `.ReplacementCore_CanSatisfyStableContract` | none |
| 4 | Owner snapshot/transition boundaries represented without a universal player blob | **PASS** (Observed) | Typed `InventorySnapshot`, `EquipmentSnapshot`, `CombatParticipationSnapshot` in their own contract assemblies; `EquipItemVerticalTests`, `MReserveUnequipVerticalTests`; the blob prohibition is now executable in `ClaudeC5GlobalStateBlobGuardTests` | none for the implemented owners; every future owner must supply its own typed snapshot |
| 5 | Surrounding systems independent of concrete Core and foreign private persistence | **PASS** (Present) | `AutomationArchitectureTests.OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies` scans every `src/*.csproj` against a reviewed allow-list; `ClaudeContinuationAutomationGuardTests` proves that scan is non-vacuous | none |
| 6 | Core conformance/golden-scenario harness exists | **PASS** (Present) | `CoreConformanceHarness.cs`; `CoreConformanceTests` incl. `CompatibleReplacementCore_MatchesReferenceCore` and `ConformanceHarness_DetectsSemanticDivergence` | harness covers the implemented rule set only; it grows with each rule |
| 7 | Identity/Hennet security tests pass | **PASS** (Present) | `PublicPlayerIdentityTests.NoPublicPlayerIdIncludingHennets_GrantsPlatformAuthority`, `.PublicProjection_LeaksNoRoleCapabilitySecurityVersionOrEntitlementData`, `.IdentityContracts_ContainNoHardCodedPublicPlayerIdOrNamePrivilege`; `IdentityCapabilityPolicyTests` | none |
| 8 | Account/Character/public-identity and capability boundaries represented/tested | **PASS** (Present) | `IdentityArchitectureTests`, `PublicPlayerIdentityTests` (15 methods), `PostgresPlayerIdentityIntegrationTests` (9 methods incl. DB-enforced immutability and one-character-per-account) | none |
| 9 | Command identity/execution-lane/idempotency boundaries represented/tested | **PASS** (Present) | `CommandReceiptTests` (10), `CommandCommitPlanTests`, `ConcurrencyExecutionTests`, `PostgresCommandRecoveryIntegrationTests` (10) | none |
| 10 | One atomic multi-owner vertical scenario passes, including rollback-on-failure | **PASS** (Present) | `PostgresUnequipItemMultiOwnerIntegrationTests`: atomic commit, independent stale-Inventory and stale-Equipment rollback, repeated CommandId, concurrent winner, double-spend refusal, restricted release | requires a PostgreSQL instance; skips as Inconclusive without `NEXIS_TEST_POSTGRES_CONNECTION` |
| 11 | Event/audit/history primitives have stable contracts | **PASS** (Present) | `AuditArchitectureTests`, `EventingArchitectureTests`, `HistoryArchitectureTests`, `PlayerLogProjectionTests`, `L3HistoryPlayerLogResolutionTests` | none |
| 12 | Persistence/concurrency isolated behind adapters | **PASS** (Present) | All Npgsql use confined to `Nexis.Persistence.Postgres`; `ExecutionArchitectureTests` pins the contract assembly's reference set; `EquipItemVerticalTests.DomainContracts_AreInfrastructureNeutral`; `ClaudeOvernightLockOrderTests` | none |
| 13 | Scheduler and CIEL bypass protections are testable | **PASS** (Present) | `AutomationArchitectureTests` (6 methods), `ClaudeContinuationAutomationGuardTests` (3 non-vacuity methods), `ClaudeAfternoonSystemAuthorityMintingTests` | the guards are enforceable; no Scheduler or CIEL runtime exists yet to guard, which is deliberate |

**Part A result: 13 of 13 satisfied.** The named stop conditions no longer block the next slice. That is not the same as saying broad gameplay fan-out is now advisable; see Part D.

## Part B - required architecture tests

| Required property | Status | Evidence |
| --- | --- | --- |
| `Nexis.Kernel` depends on no other Nexis project | PASS | `CoreArchitectureTests.Kernel_DoesNotReferenceOtherNexisAssemblies` |
| Contract packages do not depend on implementations | PASS | `CoreArchitectureTests`, `IdentityArchitectureTests`, `ExecutionArchitectureTests`, `AuditArchitectureTests`, `EventingArchitectureTests`, `HistoryArchitectureTests` |
| Surrounding systems do not reference concrete Core | PASS | `AutomationArchitectureTests.OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies` |
| Concrete Core does not reference private persistence | PASS | `CoreArchitectureTests.ConcreteCore_DependsOnlyOnKernelAndStableContractAssemblies` |
| Replacement/fake Core composable without consumer change | PASS | `CoreArchitectureTests.ReplacementCore_CanSatisfyStableContract`, `CoreConformanceTests.CompatibleReplacementCore_MatchesReferenceCore` |
| Replacement/fake owner satisfies its contract | PASS | `MReserveUnequipVerticalTests`, `EquipItemVerticalTests` evaluate against in-memory owners; `PostgresUnequipItemMultiOwnerIntegrationTests` against the real owner |
| Public contracts contain no EF/Npgsql/HTTP/frontend types | PASS | `CoreArchitectureTests.CoreContracts_AreInfrastructureNeutral`, `EventingArchitectureTests.EventingContracts_AreInfrastructureNeutral`, `EquipItemVerticalTests.DomainContracts_AreInfrastructureNeutral` |
| API/Application is composition/transport only, no gameplay formulas | **NA (no surface)** | `Nexis.Host.Api/Program.cs` is a 20-line health/status host with no command surface. Becomes required the moment a transport slice lands. |
| Application/Host cannot write owner-private tables | PASS | Host references only `Nexis.Core`, `Nexis.Modules.Audit`, `Nexis.Modules.Identity` under the reviewed allow-list; all owner SQL is inside `Nexis.Persistence.Postgres` appliers |
| Core evaluates from typed snapshots without owner databases | PASS | `CoreArchitectureTests.ConcreteCore_DependsOnlyOnKernelAndStableContractAssemblies`; `CoreConformanceTests`; `EquipItemVerticalTests.EquipSuccess_ReevaluationIsDeterministic` |
| No global `PlayerState`/`RuntimeState`/qualities/counters write model | **PASS (new)** | `ClaudeC5GlobalStateBlobGuardTests` - was **Absent** before this audit; see Part C.1 |
| Inventory is the sole item-ownership writer | PASS | `MReserveUnequipVerticalTests.UnequipTransitions_NeverCreateOrDestroyItemPossession`, `EquipItemVerticalTests.EquipTransitions_NeverCreateOrDestroyItemPossession`, `PostgresUnequipItemMultiOwnerIntegrationTests.InventoryOwner_ReservesAndReleasesWithoutChangingPossession` |
| Economy is the sole currency-balance writer | **NA (owner not implemented)** | No Economy contract or owner exists. Design-gated, not a defect. |
| Travel is the sole location/journey writer | **NA (owner not implemented)** | No Travel contract or owner exists. |
| Resources is the sole resource-bar writer | **NA (owner not implemented)** | No Resources contract or owner exists. |
| Equipment cannot create/delete item ownership | PASS | `EquipItemVerticalTests.EquipTransitions_NeverCreateOrDestroyItemPossession`; Equipment applier writes only Equipment tables |
| Marketplace/Guilds/Consortiums cannot edit Economy/Inventory | **NA (owners not implemented)**, guard pre-armed | The general `OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies` allow-list fails any new project referencing a mutation boundary, so these become enforced automatically when introduced |
| Combat cannot own base stats/HP/equipment | PARTIAL | `Nexis.Combat.Contracts` exposes only `CombatParticipationSnapshot`, a read-side prerequisite carrying no stats, resources or equipment. No Combat owner or writer exists to constrain further. |
| Hospital cannot own Life/cooldowns | **NA (owner not implemented)** | No Recovery/Hospital contract or owner exists. |
| Scheduler/background workers cannot update gameplay tables | PASS (pre-armed) | `AutomationArchitectureTests`, `ClaudeContinuationAutomationGuardTests` |
| CIEL cannot mutate gameplay owner state | PASS (pre-armed) | same guards; `IAutomatedCommandGateway` accepts an intent but cannot carry transitions or a decision (`AutomatedRequestCarriesIntentAndSystemIdentityButNoMutationResult`) |
| Projections cannot mutate authoritative owner state | PASS | `HistoryArchitectureTests.PlayerLogProjectionInterfaces_CannotReturnAuthoritativeMutationContracts`, `.HistoryProjection_DoesNotReferencePersistenceConcreteCoreOrExecutionImplementation` |
| Client DTOs not reused as persistence/trusted command state | **NA (no client surface)** | No client DTO layer exists yet. Becomes required with the transport slice. |
| No privilege from character name, title or client role state | PASS | `PublicPlayerIdentityTests` (4 relevant methods), `IdentityCapabilityPolicyTests`, `ClaudeOvernightAdversarialTests.NoCoreRuleReadsActorCapabilitiesEntitlementsOrSecurityVersion` |
| Platform capabilities, domain roles and entitlements stay separate | PASS | `IdentityCapabilityPolicyTests`, `IdentityArchitectureTests.TrustedActorContextDoesNotCarryOrdinalAccountRole` |
| Multi-owner command proves atomic rollback | PASS | `PostgresUnequipItemMultiOwnerIntegrationTests` stale-Inventory and stale-Equipment cases |
| Owner snapshots carry revision/version metadata | PASS | `InventorySnapshot`/`EquipmentSnapshot` revisions; `MReserveUnequipVerticalTests.InventoryTransitions_RejectNegativeRevisionsAndEmptyIdentities` |

`COMMAND-EXECUTION.md`'s eighteen required tests map onto the same evidence; its item 17 (no global writable player blob) was the one genuine hole and is closed in Part C.1.

## Part C - findings

### C.1 Missing global-state-blob guard - FIXED in this audit

**Was:** Absent. The prohibition on a global `PlayerState`/`RuntimeState`/`CharacterState`/qualities/counters write model is named in `AGENT-HANDOFF.md`, in `STATE-OWNERSHIP.md` required architecture test 5 and in `COMMAND-EXECUTION.md` required test 17, and it is the single failure mode `STATE-OWNERSHIP.md` was written to prevent. No executable test enforced it. The invariant held only because reviewers remembered it.

**Now:** `ClaudeC5GlobalStateBlobGuardTests` enforces three prohibitions with two complementary scans:

1. no declared type is a prohibited global state container;
2. no public contract member is a generic string-keyed bag (`string` -> `object`/`JsonElement`/`JsonNode`/`JsonDocument`);
3. no `IOwnerTransition` is a generic path/value patch.

Reflection covers real member types across every Nexis assembly the test project references; a source scan covers every project under `src/`, including `Nexis.Persistence.Postgres` and `Nexis.Host.Api`, which the test project deliberately does not reference. Four non-vacuity tests prove each scan detects a real violation, so a scan that finds nothing is distinguishable from a scan that cannot find anything.

The guard was green on its first real run against the codebase, which is the correct outcome for a guard asserting an invariant that already held. Its value is prospective: the next slice that reintroduces the V1 shape now fails.

**Classification:** code-solvable, done.

### C.2 Operational producer wiring - FIXED immediately before this audit

Commit `61f4064` wired the last operational-signal producers (retry exhaustion, execution invariant violation, projection failure, unexpected concurrency failure, replay rejection versus corruption). `OPERATIONAL-OBSERVABILITY.md` previously recorded these as pending; that text is now reconciled. **Classification:** code-solvable, done.

### C.3 Owner coverage is narrow by design - DESIGN-GATED

Economy, Travel, Resources, Cooldowns, Effects, Marketplace, Recovery, Justice and the rest have no contracts or owners, so their sole-writer tests cannot exist. This is `STATE-OWNERSHIP.md`'s own instruction ("Do not build all forty systems at once") and `IMPLEMENTATION-STATUS.md`'s standing rule that owner contracts appear only when the corresponding gameplay design is settled. Creating placeholder contracts to make the matrix look complete would produce exactly the generic state bags the architecture prohibits.

**Classification:** human/design-gated. Not code-solvable now, and should not be.

### C.4 No transport or client surface - DESIGN-GATED

`Nexis.Host.Api` is a health/status stub. The API/Application-purity and client-DTO stop conditions have nothing to constrain. They must be satisfied within the transport slice itself, not retrofitted afterwards.

**Classification:** human/design-gated. Recorded so the transport slice inherits them as acceptance criteria rather than discovering them later.

### C.5 Migration and reconciliation tooling - MIGRATION-GATED

No V1-to-V2 migration harness exists. `IMPLEMENTATION-STATUS.md` records this as gated on unresolved human decisions, and `claude-consolidated-human-decision-packet.md` holds them. No live source access, no reconciliation run and no field mapping was performed or attempted by this audit.

**Classification:** human/migration-gated. Explicitly out of scope.

### C.6 Untestable-by-construction guard - ACCEPTED AND DOCUMENTED

`FileReplayCorpusStore`'s scenario-collision branch is reachable only if retained bytes hash to the requested scenario ID while differing from the submitted JSON, which requires a SHA-256 collision. It emits a corruption signal and is deliberately not claimed as covered. Recorded in `OPERATIONAL-OBSERVABILITY.md`.

**Classification:** accepted; no action.

### C.7 Database-dependent evidence skips silently - OBSERVATION

Every PostgreSQL integration class calls `Assert.Inconclusive` when `NEXIS_TEST_POSTGRES_CONNECTION` is absent. That is the right behaviour for a developer machine, but it means stop conditions 10 and 12 can appear satisfied on a host that never ran them. Prior checkpoints have recorded this honestly each time. No code change is proposed: making the skip fail would break local development, and the real control is the release gate, which requires a provisioned production-like environment.

**Classification:** process observation for the release gate, not a code defect.

## Part D - what this audit does not claim

- It does not claim a whole-suite green run. Only the classes listed under "Verification observed" were executed.
- It does not authorize broad gameplay fan-out. The stop conditions are the *floor*. `CANON-AND-LORE.md` constraints, per-domain design decisions and the human decision packet remain independently binding.
- It does not authorize deployment, merge, PR promotion or any production or V1 action. PR #4 remains draft.
- It changes no architecture, ownership, canon or public contract semantics.

## Part E - recommended next slices

In dependency order, and each still subject to its own Work Order:

1. the transport/Application slice, inheriting C.4's stop conditions as acceptance criteria up front;
2. the next real owner contract, only where its gameplay design is settled, each arriving with its own sole-writer test;
3. migration harness foundation, once the human decision packet is resolved.
