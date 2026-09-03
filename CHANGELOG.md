# Changelog
## 2026-09-03

### Visual Theatre Task 2 review hardening
- **M1, accepted; recursive discovery fixed initially**: replaced the non-recursive, regex-based `theatre-pixi` purity check with a recursive AST policy (`test/support/pixi-purity-policy.ts`); source discovery walks nested directories and throws instead of passing vacuously on an empty publish root, so Task 3's `src/actors/**` files are covered automatically. Independent follow-up review found the initial AST binding analysis remained bypassable and required the fix round below
- **M1 fix round 1**: replaced file-wide declaration collection with lexical scopes and tracked binding values, closing assignment and destructuring aliases, bindings that leave scope, constant-computed global access, and computed `.constructor` dynamic-code access. Positive canaries preserve legitimate shadowed/local identifiers, local computed presentation data, and approved browser capability aliases instead of imposing a keyword ban
- the policy still permits exactly what this package legitimately needs: the lazy `await import('pixi.js')` boundary, `globalThis.document`, `globalThis.ResizeObserver`, `globalThis.devicePixelRatio` and canvas event listeners; a *static* `pixi.js` import, React/JSX, or any other external package is rejected
- **L1, accepted and fixed**: `mount` now evaluates cancellation before the creation outcome, so a `create` call that resolves `unavailable` (or rejects) after `dispose` returns `rejected`/`mountCancelled` instead of a late `fallbackRequired` that would push a disposed host into fallback rendering
- **L2, accepted and adapted**: the renderer now retains the typed `StageLayers` it creates and exposes `stageLayer(name)` returning the narrow `PixiContainerHandle` contract; handles are released on dispose and reissued fresh on remount, giving Task 3 typed layer access without leaking Pixi internals or adding gameplay authority
- **L3, deferred with rationale**: `webglcontextrestored` re-initialization and background-tab idle/throttling are not Task 3 requirements and are recorded for the later lifecycle/integration tranche rather than implemented as unrelated scope now
- **L4, accepted with no change**: mounting at 1x1 when the host reports zero size is correct, because the ResizeObserver corrects dimensions on the first observation and no gameplay value depends on the transient size
- TDD evidence — RED: `npx vitest run` reported 3 failed files / 4 failed tests; both purity suites failed with `Cannot find module './support/pixi-purity-policy.ts'`, cancellation returned `{ kind: 'fallbackRequired' }` where `{ kind: 'rejected', reason: 'mountCancelled' }` was required, and `renderer.stageLayer is not a function`. GREEN: `npx vitest run` 7 files / 58 tests passed, `npm run test:core` 7 files / 71 tests passed, `npm run typecheck` clean for all four projects, `git diff --check` clean
- M1 fix-round TDD evidence — RED: focused `npx vitest run test/purity-policy.test.ts` reported 4 failed / 41 passed because every confirmed alias/scope/computed-constructor bypass returned no violation. GREEN after the lexical data-flow fix and closely related scope/constructor canaries: focused policy 51/51 and complete `npm run test:pixi` 72/72

## 2026-09-02

### Visual Theatre Task 2 Pixi lifecycle foundation
- added the presentation-only `@nexis/theatre-pixi` package with an SSR-safe, client-invoked Pixi application factory; Pixi is dynamically imported only during `mount`, is initialized with explicit WebGL preference, and returns typed host-controlled fallback results when the browser capability or initialization is unavailable
- added the replaceable `ITheatreRenderer` lifecycle (`mount`, `render`, `present`, `resize`, `dispose`) without actor rendering or gameplay behavior; duplicate/concurrent and invalid mounts fail closed, failed mounts retain no mounted state, and dispose removes the owned canvas, context-loss listener and resize observer before stopping/destroying the application and its owned stage/GPU resources
- created the exact ordered stage containers for far background, environment, ground, actors, transient effects/projectiles, floating feedback and overlays; actor/effect population remains reserved for later approved tasks
- pinned `pixi.js` exactly to `8.20.1`; official npm metadata reports MIT and the upstream `pixijs/pixijs` repository, so it satisfies the approved free/open-source commercial-use requirement while the exact pin and lockfile preserve reproducibility
- TDD evidence: the first `npm run test:pixi` failed because all four Task 2 suites referenced the absent `src/index.ts`/API; a self-review regression then failed 1/4 focused fallback tests until partial mount setup rolled back its observer and listener; after implementation, 4 files / 13 tests passed, workspace strict typecheck passed for both theatre packages, and both full-tree and production-only `npm audit` reported 0 vulnerabilities

### Visual Theatre Task 1 presentation-contract hardening
- versioned the snapshot, event and intent V1 wire contracts and added strict field-by-field decoders that reject unsupported versions, unknown variants/fields, invalid references and internal-looking actor identifiers
- made presentation event application encounter-bound and cursor-strict, with explicit typed resync results for wrong, duplicate/stale, reversed, gapped or unaddressable events
- blocked stale legal-target interaction after defeat, turn and encounter-end events until an authoritative replacement snapshot arrives, without deriving gameplay legality in the client
- deep-cloned and froze retained presentation data, replaced actor strings with opaque encounter-local selectors, and replaced substring purity checks with an AST/dependency/global guard over every publishable source extension
- separated production source typechecking from Node/Vitest ambient test types; no gameplay authority, network, storage, persistence, identity or V1 implementation was added

### Visual Theatre Task 1 review-fix round 2
- **caller-owned alias safety**: `applyPresentationEvent` now rebuilds the incoming snapshot and any retained event status through explicit typed reconstruction before evaluating, so the public boundary no longer deep-freezes or aliases objects the caller still owns; accepted and resync results remain deeply frozen and are unaffected by later caller mutation, and no JSON round-trip cloning was introduced
- **stale interaction projection**: extended interaction blocking from defeat/turn/encounter-end to every retained-state change (`damageApplied`, `healingApplied`, `resourceChanged`, `statusApplied`, `statusRemoved`), since each can invalidate the offered action/target projection; presentation-only cues (`actorMoved`, `skillActivated`, `attackResolved`, `itemUsed`, `combatMessage`) remain non-blocking
- **intent safety gate**: `canSubmitTheatreIntent` now takes the actual `TheatreIntent` and additionally requires a matching contract version and encounter binding and refuses any target-bearing intent whose target is not currently offered as a legal, undefeated target; this remains a local safety/UX gate only and the authority still revalidates every submitted intent
- **purity gate bypasses**: the AST guard now inspects computed string-literal member access and flags variable/assignment aliasing of a forbidden global, closing `globalThis['fetch'](…)`, `new globalThis['WebSocket'](…)`, `globalThis['localStorage']` and `const F = Function; new F(…)`; it stays a static test guard with no runtime code and no new dependency
- verification: `npm run test:core` 7 files / 71 tests passed; `npm run typecheck` passed for both the production-source and test-tooling projects; `git diff --check` clean

## 2026-09-01

### Nexis 2.0 L3 History and Player Log resolution
- resolved all three long-standing L3 REDs without renaming, skipping or weakening them; their original assertions in `ClaudeFoundationThreatModelTests` remain byte-identical and now pass
- **TM-02, intra-command event order**: every event of one command was stamped with the same evaluation instant and a null causation, and the events table had no ordering column, so a multi-event command had no recoverable order at all
- gave `EventMetadata` and `CommittedEventMessage` a durable zero-based `IntraCommandSequence` assigned from Core's emission order, persisted by migration `0010` in both `authoritative_events` and `outbox`, protected by `UNIQUE (command_id, intra_command_sequence)` so one command structurally cannot commit two events claiming the same position, and carried through outbox claim ordering
- additionally chained each event's `CausationId` to its predecessor within the command, so the authoritative order is reconstructible two independent ways from durable metadata rather than from equal timestamps, list identity or database row order
- **TM-03, poisoned audit projection**: `SafePlayerReason` was unbounded free text while the Player Log plain-text boundary rejects anything over its bound, so an append-only immutable audit row could be committed that throws on every later projection attempt
- validated player-disclosable audit reason text at construction using the same normalization and bound as `PlayerLogPlainText`, rejecting rather than truncating so a staff-written justification for a privileged action is never silently altered; validation applies whenever a reason is supplied, since the field is player-disclosable by definition and the row is immutable once written
- pinned the two boundaries to identical decisions on adversarial input (length, control characters, collapsing whitespace, values that normalize away) because `Nexis.Audit.Contracts` cannot reference `Nexis.History.Contracts` without a dependency cycle, so drift now fails the suite instead of silently reopening the finding
- **TM-04, silent player-history loss**: the projection registry keyed on contract name *and* schema version and returned empty for anything unregistered, so bumping a projected event's schema version silently stopped producing player history, which is indistinguishable from data loss
- distinguished the two cases: an unregistered contract *name* remains deliberately internal and stays invisible, while a registered name arriving at an unregistered schema version now fails loudly as a misconfiguration; the diagnostic names only the offending contract and version and never enumerates the rest of the registry, and fail-closed malformed-payload behaviour is unchanged
- fixed a real migration defect surfaced by the new order tests: because `EnsureCreatedAsync` re-executes every migration file, an unguarded backfill re-derived sequences for rows that already carried authoritative values, overwriting real emission order and colliding with the uniqueness constraint; the add-and-backfill is now strictly one-time, with a regression test pinning that re-running migrations never renumbers committed events
- verification: Release build of `Nexis.slnx` 0 warnings/0 errors; architecture suite 248 total, 248 passed, 0 failed, 0 skipped; disposable PostgreSQL integration suite on a fresh database 81 total, 81 passed, 0 failed, 0 skipped; no previously green test regressed and no protective assertion was removed

### Nexis 2.0 account-scoped stable public player identity
- implemented the `PublicPlayerId` boundary required by `IDENTITY-AUTHORIZATION.md`: one normal account is one player is one playable character, with no slots, alts or campaign characters, and `AccountId`, `CharacterId`, `PublicPlayerId` and display name kept as four permanently distinct concepts
- made `PublicPlayerId` deliberately non-GUID-shaped, so an accidental cast, reinterpretation or copy-paste between an internal identifier and the public one cannot compile rather than merely violating a naming convention
- preserved V1's observable public player-number semantics without reusing, moving or modifying any V1 code or data: ordinal floor `1000000`, a reserved block of 20 never allocated to an ordinary player, first allocatable `P1000020`, rendered as `P` plus seven zero-padded digits
- added migration `0009` with the Identity owner's private `player_identities` table; `account_id` is the primary key so an account cannot hold a second playable character, `character_id` is unique so a character cannot be controlled by a second account, and `public_player_ordinal` is unique so no race can mint a duplicate public identity
- allocated public ordinals from a sequence rather than `max() + 1`, so concurrent provisioning cannot allocate the same ordinal twice; a race of eight provisioners for one account converges on exactly one identity and one row
- made provisioning idempotent so a retried sign-in returns the original identity instead of minting a second public identifier, and raised a typed `PlayerIdentityConflictException` when a request contradicts a stored mapping rather than silently returning a different identity
- enforced public-identifier immutability in three independent places: no setter on `PlayerIdentity`, a `refuse_player_identity_reassignment` database trigger rejecting any `UPDATE` that would change `account_id`, `character_id` or `public_player_ordinal`, and the uniqueness constraints; renaming is the only permitted mutation and changes no identifier
- pinned the public projection to exactly two facts, `PublicPlayerId` and `DisplayName`, with tests asserting it exposes no `AccountId`, `CharacterId`, `AccountRole`, capability, security-version or entitlement member and no role/capability/entitlement-shaped member name; this enforces the Hennet boundary structurally rather than by reviewer vigilance
- proved `PublicPlayerId` grants zero authority: it exposes no member returning an internal identifier or `TrustedActorContext`, no `TrustedActorContext` factory accepts one, `IPlatformAuthorizationPolicy` accepts neither it nor a display name, and Hennet's player actor receives no capability even under a policy granting that capability to every staff bundle
- treated a client-supplied public identifier as a hostile assertion: control is resolved from the server-derived actor and a forged identifier yields no `CharacterId` at all, so it cannot authorize another character
- corrected stale factual metadata in `AGENT-HANDOFF.md` and `IMPLEMENTATION-STATUS.md`, which still named the superseded `feature/nexis-v2-foundation-skeleton` working branch; no binding architecture was changed
- verification: Release build of `Nexis.slnx` 0 warnings/0 errors; architecture suite 233 total, 230 passed, 3 failed, 0 skipped; disposable PostgreSQL integration suite on a fresh database 75 total, 75 passed, 0 failed, 0 skipped; the three architecture failures remain the open L3 History/Player Log findings, untouched by this slice

## 2026-08-31

### Nexis 2.0 M-reserve item availability and the C3 real multi-owner gameplay proof
- adopted the approved **M-reserve** availability model: Inventory owns possession *and* the single authoritative answer to whether an item instance is available; Equipment owns slot bindings only, and equipping never removes the item from Inventory as the superseded V1 `removeInventory`/`addInventory` mechanism did
- added the typed availability vocabulary `InventoryItemReservation(ItemInstanceId, OwnerKey holdingOwner, ItemReleaseRestriction?)` and the `ReserveInventoryItemTransition` / `ReleaseInventoryItemReservationTransition` owner transitions; `InventorySnapshot` gains `Reservations` and moves to contract schema 2
- made Equip a genuine two-owner command (Inventory reserves, Equipment binds) and added the inverse `UnequipItem` Core rule, typed contracts and canonical command codec; the availability check is ordered after the already-equipped check so re-equipping worn gear reports `equipment.item.already_equipped` rather than misattributing it to `equipment.item.reserved_elsewhere`
- classified Equipment/Inventory disagreement about the same item (missing or foreign-held reservation) as TechnicalFailure rather than an in-world rejection, since neither is something the player did
- added the real Inventory PostgreSQL owner and migration `0008`; `UNIQUE (item_instance_id)` on `inventory_item_reservations` is the structural no-double-spend guarantee enforced by the database rather than only by a C# check, and the release statement carries `restriction_declaring_owner IS NULL AND holding_owner = @o` so a restricted or foreign-held reservation is not releasable even if Core were bypassed or stale
- delivered the C3 proof: `UnequipItem` clears the Equipment binding and releases the same Inventory reservation in one atomic, exactly-once, double-spend-proof command, proven against real PostgreSQL for the happy path, independent stale-Inventory and stale-Equipment rollback, repeated CommandId, concurrent unequips, an opposing stale reservation, and removal-restriction denial committing neither owner
- fixed a latent single-owner assumption exposed rather than caused by this slice: `ReplayCorpusExtractor.ValidateTrace` compared plan and decision transitions with the order-sensitive `SequenceEqual` while `CommandCommitPlanBuilder` deliberately canonicalizes transition order, so any genuine multi-owner command would have tripped it; the comparison is now an order-insensitive multiset with added-, dropped-, substituted- and duplicated-transition cases still rejected
- advanced the replay corpus to V2 so the rule-relevant Inventory availability input is retained; a V1 artifact now fails closed rather than reporting false semantic equivalence during Core-vNext comparison
- added `MReserveFreedomRuleTests` guarding the approved freedom rule mechanically: stats, skills and knowledge are not equip or unequip gates, Nexis.Core takes no compile-time dependency on a capability owner, and neither equipment rule declares a capability-shaped rejection reason
- reconciled the `STATE-OWNERSHIP.md` §8 self-contradiction (reference-only versus multi-owner equip) and the `COMMAND-EXECUTION.md` "Inventory precondition" equip example under M-reserve, and recorded the boundary plus the future curse integration seam in `ITEM-AVAILABILITY-RESERVATION.md`
- no Curse owner, curse state, effect persistence, questline, purification path or balance value was created; the only curse-adjacent artefact is the typed `ItemReleaseRestriction(OwnerKey declaringOwner)` seam, deliberately empty of curse semantics
- no protective test was weakened: the superseded single-owner equip assertions and the corpus V1 expectation were each replaced by strictly stronger assertions in the same file
- verification: Release build of `Nexis.slnx` 0 warnings/0 errors; architecture suite 218 total, 215 passed, 3 failed, 0 skipped; disposable PostgreSQL integration suite on a fresh database 66 total, 66 passed, 0 failed, 0 skipped; the three architecture failures remain the open L3 History/Player Log findings

## 2026-08-29

### Nexis 2.0 privileged-entry attribution and decision freshness
- attributed denied privileged command entry: `PrivilegedCommandEntryDecision` gains an always-populated `AttemptedByAccountId` while `ActingAccountId` deliberately stays null on refusal, so a denied actor is never presentable as acting authority yet the attempt is no longer anonymous
- emitted a bounded `PrivilegedEntryDenied` operational signal on refusal, distinguishing missing capability from explicit deny, stale security context, actor mismatch and staff-actor-required; a denial never reaches a commit plan, so without this a privilege-escalation burst left no trace anywhere
- kept raw identity out of the signal: attribution travels on the decision, while the signal carries only a SHA-256 actor discriminator, deliberately stable per actor rather than salted per attempt so repeated denied attempts are countable
- recorded `EvaluatedSecurityVersion` and `EvaluatedAtUtc` on every privileged entry decision, authorized and denied, so a consumer can refuse a decision evaluated before a capability or password change; closed before any BFF consumes the boundary
- public contract change: `PrivilegedCommandEntryDecision.Authorized`/`Denied` now require the evaluated security version and evaluation time, and `PrivilegedCommandEntryAuthorizer` takes an optional operational signal sink and `TimeProvider`
- deliberate dependency widening: `Nexis.Execution` now references `Nexis.Operations.Contracts`, a stable non-authoritative leaf depending only on `Nexis.Kernel`; the architecture guard was updated explicitly rather than relaxed
- verification: Release build of `Nexis.slnx` 0 warnings/0 errors; architecture suite 194 total, 191 passed, 3 failed, 0 skipped; disposable PostgreSQL integration suite 55 total, 55 passed, 0 failed, 0 skipped; the three failures are the open L3 History/Player Log findings

### Nexis 2.0 automated-ingress identity and command-integrity observability
- added a non-empty, case-normalized closed `SystemActorKey` registry contract for the first real automated-command gateway while preserving construction of retired historical keys for recovery and replay
- removed the zero-argument `TrustedActorContext.CreateSystem()` authority factory; every System actor construction now supplies an explicit key, guarded across public constructors and static factories in both Identity.Contracts and Execution.Contracts
- replaced the vacuous CIEL/Scheduling prefix scan with a non-empty whole-source dependency scan and exact trusted-composition allowlist; a negative control proves an arbitrarily named future worker cannot reference mutation boundaries
- fixed a residual vacuity in that same scan found under review: ProjectReference `Include` attributes use Windows separators, and on Linux `Path.GetFileNameWithoutExtension` does not split on `\`, so every reference parsed with its directory prefix attached, matched no mutation boundary, and left all allowlist entries as unreachable dead configuration; the scan is now bounded from below by tests asserting it parses bare assembly names, classifies a non-empty set, and observes exactly the reviewed eight references
- reviewed and explicitly allowlisted two mutation-boundary references that the repaired scan made visible for the first time, `Nexis.Execution` and `Nexis.History.Replay` onto `Nexis.Execution.Contracts`; both are contracts-only and hold no mutation capability
- recorded a RED architecture test for stale privileged-decision protection: `PrivilegedCommandEntryDecision` carries no evaluation time and no security version, so a future BFF could not refuse a decision evaluated before a capability or password change
- made every non-terminal non-recoverable receipt operator-enumerable, including `canonical_payload IS NULL`, and routed it through the same explicit execution-token/state-fenced terminal TechnicalFailure resolution without automatic resurrection
- pinned migration `0006`'s persisted `terminal_status = 5` assumption to `CommandTerminalStatus.TechnicalFailure` with an executable embedded-migration invariant so enum drift fails the suite
- intentionally changed `IAutomatedCommandGateway.SubmitAsync` from `ValueTask` to `ValueTask<AutomatedCommandSubmissionResult>` before any implementation or caller exists, making unregistered-authority rejection an explicit public contract result
- documented the five exact disposable-PostgreSQL behavioural acceptance tests the first real gateway must pass; runtime M6 enforcement remains a readiness condition because no real gateway exists, and no fake gameplay gateway was introduced
- added durable append-only PostgreSQL operational signals for CommandId actor, intent-contract and canonical-payload integrity violations; signals link original and attempt correlations and carry only a SHA-256 actor discriminator rather than raw identity or payload
- verification at this checkpoint: Release build of `Nexis.slnx` 0 warnings/0 errors; architecture suite 187 total, 183 passed, 4 failed, 0 skipped; disposable PostgreSQL integration suite 55 total, 55 passed, 0 failed, 0 skipped; the four architecture failures are the three open L3 History/Player Log findings and the deliberate O-4 RED above

### Nexis 2.0 terminal-effect and recovery-authority contracts
- reject owner transitions and authoritative events at the commit-plan boundary for Rejected, Conflict, Cancelled and TechnicalFailure outcomes while preserving both effects for DomainFailed
- remove the public RecoveredCommandExecution overload that inferred Platform for a System-lane command; every recovery construction now supplies the historically persisted SystemActorKey explicitly
- retain reflection guards against reintroducing any recovery constructor that accepts a lane without the corresponding SystemActorKey
- public contract change: the 11-argument actor-substituting RecoveredCommandExecution constructor was deleted

### Nexis 2.0 receipt-aware bounded command retry
- compose receipt acquisition and retry at one Application boundary: acquire CommandId exactly once, then rebuild/revalidate/re-evaluate/commit each retry with the same fenced token instead of re-acquiring as DuplicateInProgress
- renew the held lease between retryable attempts and abandon immediately when renewal is refused; PostgreSQL emits a bounded payload-free lease-fencing signal with CommandId and original CorrelationId
- terminalize exhausted retryable failures as TechnicalFailure with zero owner transitions and zero authoritative events
- real disposable-PostgreSQL evidence forces SQLSTATE 40001 inside attempt 1 and proves exactly one terminal outcome, owner mutation, history row and outbox row; also proves fence rotation blocks commit and exhaustion consumes no resources
- verification: Release build 0 warnings/0 errors; focused H2 PostgreSQL 3/3 and complete PostgreSQL suite 47/47 before documentation reconciliation

### Nexis 2.0 global canonical PostgreSQL resource locking
- acquire every adapter-resolved authoritative resource in one global canonical transaction advisory-lock sweep before any owner transition applier executes; interleaved same-owner key sets can no longer regress to transition-local `a,c,b` acquisition
- preserve adapter-side key resolution and Core replacement boundaries; lock identities remain private PostgreSQL infrastructure and use stable SHA-256-derived 64-bit advisory keys
- add a real Equipment H1-C conformance guard that compares declared aggregate/binding/slot keys with the actual SQL write order captured by PostgreSQL triggers
- RED/GREEN evidence: Claude's disposable-PostgreSQL interleaving probe failed at 42/43 with `a,c,b`, then the complete suite passed 44/44 after the global sweep and Equipment guard; Release build passed with 0 warnings/0 errors

### Nexis 2.0 recovery, quarantine and outbox failure hardening
- separated total outbox delivery attempts from event-specific poison attempts; unclassified and systemic transport failures now back off without consuming the poison ceiling, while explicit event-specific permanent failures alone can dead-letter an event
- added capability-gated, payload-free operational quarantine listings plus fenced, atomically audited dead-letter requeue and command-recovery resolution paths; recovery quarantine now rotates the execution fence and can terminate as TechnicalFailure without becoming a permanent `DuplicateInProgress` trapdoor
- added adapter-side authoritative resource-key resolution and deterministic transition ordering without leaking PostgreSQL locking vocabulary into Core contracts; a later slice must complete the global acquisition sweep for interleaved same-owner resources
- documented the public `CommittedEventTransportException` classification contract and the controlled recovery/quarantine lifecycle
- verification on the exact reviewed dirty slice: .NET SDK 10.0.111; Release build 0 warnings/0 errors; disposable PostgreSQL 17 suite 41/41; Architecture/Core/security/replay suite 159/162 with only the three pre-existing deliberate L3 RED tests still failing
- no production/V1 access, deployment, push, merge, DNS/Caddy change or gameplay/canon value change occurred

## 2026-08-28

### Nexis 2.0 operational observability foundation
- added stable `Nexis.Operations.Contracts` and a platform-neutral `Nexis.Operations` health reporter without introducing a monitoring product or authoritative gameplay state
- represent command recovery, fencing, outbox delivery/poison, retry exhaustion, invariant, projection, replay rejection/corruption and unexpected concurrency conditions through bounded typed signals
- expose thread-safe bounded health summaries with exact counts, highest severity and monotonic latest occurrence; exclude raw exceptions, arbitrary payloads, credentials and personal data from the contract
- strict TDD RED evidence: the focused suite failed because the Operations projects/types did not exist; GREEN passed 5/5 after the minimum contracts and reporter implementation
- verification: solution restore passed; Release build passed with 0 warnings/0 errors; complete Architecture/Core/execution/security/replay/operations executable passed 158/158
- added `v2/docs/OPERATIONAL-OBSERVABILITY.md`; validated C7 fixes remain responsible for wiring producers while implementing quarantine, dead-letter, retry and failure-classification behavior


### Nexis 2.0 privileged command-entry authorization boundary
- added a stable Identity authorization-policy interface and reusable Execution entry authorizer for future real Admin commands without introducing fake admin gameplay
- bind successful privileged entry to the trusted acting staff AccountId separately from the target AccountId so downstream atomic Admin Audit cannot substitute the target as actor
- reject role-ordinal inference, commercial entitlement or actor-carried capability claims, Character identity, stale security state, target-security substitution, implicit grants and explicit-deny bypass at the command-entry boundary
- strict TDD RED evidence: the focused boundary test project failed because the privileged entry authorizer/contracts did not exist; GREEN passed 7/7 after the minimum implementation
- verification: Release build passed with 0 warnings/0 errors; complete Architecture/Core/execution/security/replay executable passed 153/153
- C3 remains design-blocked: Equip Item legitimately writes Equipment only, and no second real owner mutation is specified without inventing an unapproved cost, reward, reservation or duplicate ownership fact

## 2026-08-27

### Nexis 2.0 replay corpus independent-review repair
- reject successful replay execution evidence that also carries a contradictory terminal failure reason, with a RED-then-GREEN regression
- document that retained provenance and command-payload fingerprints are corroborating metadata rather than origin attestation, and scope Equip Item's null-causation invariant to its direct-command event shape
- hardened untrusted Equip Item replay ingestion so execution/committed-event identities, decision versus committed evidence, output intent identities, and successful owner/content prerequisites are re-established before artifacts are retained or replayed
- reject normalization-changing source fingerprints, UTC timestamp spellings, definition IDs, placements and slots so semantically identical values cannot acquire different content-addressed scenario IDs
- apply the reviewed identifier vocabulary and length limits to retained Core/rule/content versions, reasons, definition IDs, placements, slots and contract names; Equip Item artifacts now allow only the registered equippable-definition and item-equipped contracts
- added adversarial parse and fail-closed file-store regressions plus encode -> parse -> decode/re-encode byte-stability coverage under strict TDD RED -> GREEN
- verification: Release build passed with 0 warnings/0 errors; replay tests passed 14/14; complete Architecture executable passed 140/140; PostgreSQL integration executable reported 28/28 skipped because `NEXIS_TEST_POSTGRES_CONNECTION` is absent
- no production access, deployment, push, merge, v1, migration, Education or Web changes were performed

### Nexis 2.0 production-derived replay corpus boundary
- added `Nexis.History.Replay` as an internal, replaceable replay extraction/execution/retention assembly that consumes existing typed Core request/decision and authoritative command trace/event contracts without introducing a second gameplay execution model
- added versioned canonical JSON artifacts with SHA-256 content-addressed scenario identity, production/human/automated/synthetic provenance, ordinary/known-bug/exploit/concurrency/high-value tags, persistence outcome and evaluation timing
- retained existing CommandId, original CorrelationId, EventId/causation, canonical payload fingerprint, Core implementation/contract, rule/content versions and authoritative UTC times
- added the first explicit privacy-reviewed codec for Equip Item V1; private AccountId/CharacterId/ItemInstanceId values are keyed-pseudonymized while raw command JSON, capabilities, entitlements, security version, credentials, arbitrary metadata and unrestricted RNG material are structurally excluded
- represented deterministic RNG only through an opaque restricted reference resolved at replay time; replay invokes compatible `ICoreRulesEngine` implementations without owner persistence or authoritative event emission
- added immutable filesystem retention with duplicate recognition plus content/filename/collision/tamper detection; strict typed deserialization rejects unknown fields at every envelope level
- kept replay corpus independent of Player Log, Admin Audit, PostgreSQL, HTTP/frontend types, concrete Core and production infrastructure
- strict TDD RED evidence: the initial focused run failed because the replay project/types did not exist; a later self-review RED run failed both missing payload-fingerprint retention and acceptance of an injected credential field before the parser was hardened
- verification from `v2/`: .NET SDK 10.0.111; restore passed; Release build passed with 0 warnings/0 errors; focused architecture/Core/security/replay suite passed 134/134; full solution passed 162 total, 134 succeeded, 28 skipped, 0 failed
- all 28 skips are the existing PostgreSQL integration tests because `NEXIS_TEST_POSTGRES_CONNECTION` is absent; no credentials were invented and no database, production source, live state, deployment, push or merge was used
- added `v2/docs/CORE-REPLAY-CORPUS.md` and reconciled conformance/status truth; only Equip Item V1 is registered, and authorized offline production export/selection can now populate permanent corpus packs
- player impact: none; this is isolated V2 Core/Foundation regression evidence infrastructure
- remaining foundation work includes migration/reconciliation tooling, a real multi-owner gameplay write proof, operational observability, Staff/Admin policy integration and final threat-model/stop-condition review


## 2026-08-26

### Nexis 2.0 Player Log / history projection boundary
- added stable `Nexis.History.Contracts` and replaceable `Nexis.History.Projection` projects for rebuildable player-facing history without creating authoritative state or persistence
- enforced exact, mutually exclusive Account/Character audiences; exact event-contract/schema registration; authoritative EventId/CorrelationId/time provenance; bounded plain-text values; and canonical value-equal arguments
- kept projection fail closed: unregistered events, internal Admin Audit, unknown visibility and malformed disclosure inputs produce no entry or an explicit failure, with no raw payload fallback
- projected Player-material Admin effects only to the exact target Account using the explicit safe reason; acting staff identity, internal action/outcome, case reference, capabilities, security/anti-cheat data and raw audit records remain internal
- projected Item Equipped only to the exact Character and exposed only its normalized placement; item-instance identity, occupied slots and raw event payload remain internal
- audit found and fixed one typed-event defect: an incomplete Item Equipped payload could previously project after only Character/placement parsing; a red-before/green-after regression now requires reconstruction of the complete V1 `ItemEquippedEvent`
- added architecture and adversarial tests covering dependency isolation, no mutation contracts, fail-closed registration, forged provenance, disclosure boundaries, canonical ordering and malformed typed payloads
- added `v2/docs/PLAYER-LOG-BOUNDARY.md`; reconciled Foundation, Audit and implementation-status truth; nominated the already-approved production replay-corpus extraction/retention boundary next without adding gameplay or canon
- verification from `v2/`: .NET SDK 10.0.111; restore passed; Debug build passed with 0 warnings and 0 errors; full solution passed 154 total, 126 passed, 28 skipped, 0 failed
- limitation: all 28 skips are PostgreSQL integration tests because `NEXIS_TEST_POSTGRES_CONNECTION` is absent; no database was created or used, and the prior disposable-PostgreSQL evidence remains the latest database-backed run
- player impact: no live impact or deployment; this V2-only slice establishes safe future Player Log entries for equipped-item events and material Admin effects
- risk level: low to moderate; contracts and in-memory projection behavior are covered, while Player Log persistence, runtime consumer wiring, query authorization, localization and knowledge-dependent projector inputs remain unimplemented

### Nexis 2.0 executable Identity capability policy
- added immutable current-security snapshots and typed authorization outcomes for server-side Staff/Admin capability evaluation
- added exact role-to-capability bundles without numeric or ordinal role comparisons; explicit grants are additive and explicit denies always win
- reject stale security versions, mismatched accounts, non-staff actors and missing exact capabilities before privileged execution
- kept commercial entitlements entirely outside platform authorization, including adversarial coverage for same-string entitlement/capability confusion
- added seven security tests covering ordinal bypass, revocation, stale facts, account binding, entitlement isolation and actor-lane isolation
- verified on `new-voidsmith`: restore passed, build completed with 0 warnings/0 errors, architecture suite passed 112/112, and the full solution reported 112 passed, 28 PostgreSQL tests skipped, 0 failed because the isolated PostgreSQL test connection is not configured on that host
- corrected the work-order test command for the .NET 10 Microsoft Testing Platform runner and ignored generated .NET `bin/obj` outputs
- player impact: none; this is isolated Nexis 2.0 authorization infrastructure and no live deployment or v1 mutation occurred
- risk level: low to moderate; concrete Staff/Admin command entrypoints must use this policy when introduced, and database-backed integration remains to be rerun on the new host

### Nexis 2.0 automated authority and scheduler/CIEL bypass boundary
- introduced stable `SystemActorKey` identity for trusted automated authorities so scheduler, CIEL and future system services no longer collapse into one anonymous `SYSTEM` actor while still remaining completely separate from Account/Character identity
- bound the System principal into CommandId idempotency identity, durable PostgreSQL command receipts, atomic receipt verification and crash recovery so an automated command retains the same source authority across retries, restarts and recovery workers
- added additive migration `0005_system_actor_identity.sql`, backfilling pre-release System receipts to `nexis.system` and tightening the persisted actor-shape constraint so Player/Realtime, Admin and System identities cannot be mixed
- added the intentionally narrow `Nexis.Automation.Contracts` boundary with `AutomatedCommandRequest` and `IAutomatedCommandGateway`; automated components may submit only System identity, CommandId, CorrelationId and a typed Core intent, never owner transitions, persistence handles or precomputed gameplay outcomes
- added executable architecture guards for future `Nexis.Ciel*` and `Nexis.Scheduling*` projects; those projects fail the architecture suite if they directly reference concrete Core, concrete Execution, Execution internals, PostgreSQL or owner implementation modules instead of using the approved automated-command boundary
- preserved the approved rule that schedulers own due-work mechanics rather than gameplay outcomes and that CIEL remains advisory/interpretive rather than an authoritative state owner
- CI caught and rejected one nullable-flow defect in the new project-reference scan; the test was corrected without suppressing nullable analysis
- checkpoint `4de3b830c19c5659c042aa342d86e3361a0c05a7` passed the complete V2 workflow: Release build **0 warnings / 0 errors**, architecture/Core/execution/security suite **105 passed / 0 failed / 0 skipped**, PostgreSQL integration suite **28 passed / 0 failed / 0 skipped**
- no scheduler business logic, CIEL runtime, V1/live mutation, production database change, deployment or PR merge was introduced; PR #4 remains draft
- player impact: none yet; this hardens automated authority and future mutation ingress before those runtime components exist
- risk level: low to moderate; the cross-cutting System identity migration and automation boundary are green, while remaining Identity policy and history/projection stop conditions still block broad gameplay fan-out

### Nexis 2.0 first real gameplay vertical, recovery and durable delivery foundation
- completed the missing default Core composition for the first real rule by registering `EquipItemRuleEvaluator` in `Nexis.Core.Reference`; unsupported intents still fail closed, while the reference engine now actually executes the approved Equipment vertical
- added stable Items, Inventory, Equipment and Combat contract boundaries plus exact-version Content Registry contracts/implementation without introducing generic mutable state or content blobs
- implemented `EquipItem` as a deterministic Core rule using trusted actor identity, Inventory possession, Equipment state, Combat participation and exact typed item content; Core emits only an Equipment-owner transition plus semantic event
- added real PostgreSQL Equipment-owner persistence with optimistic revision enforcement, authoritative history/outbox integration and multi-slot binding support
- added canonical value-equal `EquipmentSlotSet` semantics across Equipment placement/state/output contracts so replay/conformance compares domain values rather than backing collection object identity
- implemented durable command execution leases, stale-claim recovery, lease renewal/fencing and ambiguous commit reconciliation while preserving the original CommandId/receipt authority
- implemented leased at-least-once PostgreSQL outbox delivery with multi-worker `SKIP LOCKED` claiming, expiring leases, stable EventId redelivery identity, publication acknowledgement, failure-delay release and idempotent PostgreSQL projection checkpoints
- corrected a nondeterministic outbox seam where `available_at_utc` relied on PostgreSQL wall-clock `now()`; normal atomic command commits now persist the authoritative command completion time explicitly as initial delivery availability
- V2 CI caught two genuine integration defects during this pass: the real EquipItem evaluator was not registered in the default Core, and replay-equal Equipment outputs compared unequal because `ReadOnlyCollection` uses reference equality; both were fixed at the responsible boundaries rather than weakening tests
- after the fixes, checkpoint `e1eaf9fe2e2afe9629cc2633ddb7dcf2e7ad767c` passed the complete workflow: Release build **0 warnings / 0 errors**, architecture/Core/execution/security suite **101 passed / 0 failed / 0 skipped**, PostgreSQL integration suite **28 passed / 0 failed / 0 skipped**
- the PostgreSQL suite now proves the real EquipItem end-to-end commit, stale Equipment revision rollback, multi-slot persistence, command crash recovery, lease fencing, ambiguous reconciliation, independent outbox worker claiming, lease recovery/redelivery and atomic idempotent projection handling
- refreshed `v2/docs/IMPLEMENTATION-STATUS.md` so Claude/Codex no longer treat already-completed outbox/recovery/first-owner work as pending; the next safe foundation boundary is scheduler/CIEL mutation-bypass prevention
- bumped the reference Core implementation identifier to `0.5.0-foundation`; stable Core contract remains V1
- no live/V1 code, production database, deployment or PR merge was performed; PR #4 remains draft
- player impact: none yet; this is isolated Nexis 2.0 architecture, persistence and first-owner gameplay proof
- risk level: moderate but contained; the first real gameplay vertical is green, while broad gameplay fan-out remains blocked by the remaining foundation stop conditions

### Nexis 2.0 command lifecycle, atomic execution and audit foundation
- added separate `Nexis.Execution.Contracts` and `Nexis.Execution` boundaries for authoritative command receipt/idempotency and Application-layer execution coordination without introducing persistence types into Core or stable gameplay contracts
- bound each CommandId to a stable trusted actor identity, typed intent contract and server-derived SHA-256 payload fingerprint; retries with changed actor/type/payload are explicit integrity violations, while capability/entitlement/security-version changes remain current facts to revalidate rather than changing command identity
- preserved the first accepted CorrelationId across transport retries and added duplicate-in-progress / duplicate-completed behavior so a completed retry returns the stored terminal outcome instead of running gameplay again
- added `CommandExecutionTrace` and an all-or-nothing `CommandCommitPlan` carrying exact Core implementation/contract/rule/content provenance, typed owner transitions, proposed terminal command outcome and authoritative event envelopes; Core `Succeeded` is explicitly not durable success until the atomic committer reports `Committed`
- deliberately kept command-receipt completion out of the standalone receipt repository so owner state, terminal outcome, history/events, state-changing Admin audit and durable outbox cannot be committed through independent convenience calls
- added canonical multi-resource lock ordering by owner/type/id using ordinal comparison and a bounded whole-command retry executor that retries only infrastructure-classified transient failures, reruns the complete attempt from fresh state, respects the configured bound and never converts caller cancellation into a retry
- split the previous raw-Guid Audit placeholder into stable `Nexis.Audit.Contracts` plus replaceable `Nexis.Modules.Audit`; audit records now use typed AccountId/CorrelationId/EventId primitives and preserve append-only correction/reversal semantics
- integrated every Admin command attempt, including rejected attempts, with at least one audit entry in the same atomic command plan; the audit actor must match the trusted Admin Account and the audit correlation must match the original command correlation
- added `COMMAND-LIFECYCLE-CONTRACTS.md`, `ATOMIC-COMMAND-COMMIT.md`, `CONCURRENCY-EXECUTION.md` and `AUDIT-BOUNDARY.md`; updated rolling implementation status to distinguish completed seams from the still-missing production persistence/owner proof
- CI caught one deliberately strict dependency allow-list mismatch while the new execution assembly legitimately referenced Kernel; the allow-list was corrected narrowly rather than weakening the dependency guard
- the command receipt/idempotency, atomic commit, lock/retry, Audit split and atomic Admin-audit slices have all passed the V2 restore/build/test workflow after their latest fixes with Release warnings treated as errors
- no PostgreSQL/Npgsql adapter, owner-specific gameplay persistence, live database mutation, V1 change or deployment was introduced; PR #4 remains draft
- player impact: none; this is isolated Nexis 2.0 authoritative execution/history/security infrastructure
- risk level: low to moderate; the contracts are test-covered, but production persistence and the required multi-owner rollback proof remain blocking foundation work

### Nexis 2.0 Identity contracts and trusted Core actor boundary
- split `AccountId`, `CharacterId` and `AccountRole` out of the placeholder Identity implementation into the stable `Nexis.Identity.Contracts` assembly, preserving permanent Account/Character type separation before other systems can couple to the implementation project
- kept `AccountRole` as a named account/staff classification only; Core actor authority is represented by current server-derived capability keys rather than ordinal role comparisons
- added universal Player/Admin/System/Realtime mutation-lane vocabulary to `Nexis.Kernel`; read-only query work remains outside mutation-lane semantics
- added immutable server-created `TrustedActorContext` with distinct Player, Staff and System shapes, current security version, effective platform capabilities and separate commercial entitlements
- Player/Realtime actor context carries AccountId + CharacterId; Staff/Admin context carries the acting Account but deliberately no Character impersonation identity; System context carries no account/character identity
- integrated trusted actor context into every `CoreEvaluationContext` and internal rule-dispatch execution context so rules receive authoritative actor facts alongside time, versions, snapshots/content and deterministic RNG
- updated dependency guards so concrete Core may consume `Nexis.Kernel` and stable `*.Contracts` packages while continuing to reject feature implementation/Host/persistence dependencies
- CI caught and rejected tautological enum-value assertions through MSTest analyzer MSTEST0032; the ceremonial assertions were removed rather than suppressing the analyzer
- Identity split and trusted actor changes are restore/build/test verified by the V2 CI workflow after their latest fixes; no v1/live code, database or deployment path was touched
- added `v2/docs/IMPLEMENTATION-STATUS.md` and wired both `v2/AGENTS.md` and `v2/CLAUDE.md` to read it so Claude/Codex see current implementation progress without turning a status file into a competing architecture rulebook
- player impact: none; this is isolated Nexis 2.0 authority/contract infrastructure
- risk level: low to moderate; the boundary is pre-gameplay and test-covered, while the remaining foundation gates still block broad system implementation and PR #4 remains draft

### Nexis 2.0 Core CI verification and internal rule dispatch
- added a V2-only GitHub Actions verification workflow that restores, builds and tests the isolated `v2/` solution without touching the current/live application
- corrected CI so commands run from `v2/`, ensuring `v2/global.json` is discovered; the configured `latestFeature` roll-forward currently resolves .NET SDK 10.0.400 while preserving the approved .NET 10 line
- enabled the .NET 10 Microsoft.Testing.Platform runner in `global.json` and changed CI to the MTP `dotnet test --project` form with a minimum-test-count guard
- CI caught obsolete MSTest 4 `Assert.ThrowsException` calls before merge; tests were corrected to `Assert.ThrowsExactly`
- observed green baseline at commit `d5b83b1799691e9aa38266eb52279d74b0fea0bc`: restore succeeded, Release build completed with 0 warnings/0 errors, and all 25 architecture/Core conformance tests passed with 0 failures/skips
- added explicit internal Core rule dispatch keyed by typed intent contract name + schema version; duplicate registrations are rejected and unregistered intents remain mutation-free TechnicalFailure outcomes
- kept `CoreRuleExecutionContext` and `ICoreRuleEvaluator` internal to the concrete Core, with friend access only for architecture tests, so surrounding systems still depend exclusively on `ICoreRulesEngine`/stable contract assemblies
- each dispatched evaluation receives exactly one fresh deterministic RNG stream; evaluator exceptions/null results are treated as implementation defects rather than converted into fake in-world outcomes
- concrete `Nexis.Core` may directly reference the tiny `Nexis.Kernel` substrate and stable `*.Contracts` assemblies required by typed rule inputs; it still has no feature-module, persistence, network or UI dependencies
- dispatch commit `f316738197e54588310087c8b390d9facdff7c5c` passed the V2 restore/build/test workflow
- player impact: none; these changes are isolated Nexis 2.0 Core architecture/verification infrastructure
- risk level: low to moderate; broad gameplay implementation remains blocked by the larger foundation stop conditions and PR #4 remains draft

### Nexis 2.0 deterministic Core arithmetic
- added `Nexis.Core.Numerics.DeterministicIntegerMath` as the reference Core's exact integer/rational calculation primitive for authoritative ratios, percentages and multipliers without default floating-point semantics
- added explicit rounding modes for toward-zero, away-from-zero, floor, ceiling, nearest-even and nearest-away-from-zero behavior so each versioned gameplay formula must choose its rounding semantics deliberately
- used `Int128` multiplication intermediates with checked narrowing back to `long`, preventing valid wide-intermediate calculations from overflowing early while also preventing final authoritative values from silently wrapping
- invalid rounding modes and zero denominators now fail explicitly; overflow remains a technical/configuration error rather than being converted into an in-world result
- added tests for positive/negative midpoint behavior, negative-denominator normalization, wide intermediates, checked overflow, invalid rounding configuration and exact ratio calculations
- added `v2/docs/CORE-NUMERIC-DETERMINISM.md` defining the cross-runtime numeric contract, floating-point restrictions, overflow policy and formula-version implications without choosing any gameplay balance values
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this establishes deterministic Core arithmetic infrastructure only and does not implement or change any live gameplay formula
- risk level: low to moderate; this deliberately fixes numeric semantics before domain rules depend on them

### Nexis 2.0 Core conformance and deterministic replay seam
- replaced the raw mutable RNG cursor in `CoreEvaluationContext` with an `IDeterministicRandomFactory`, so each Core evaluation receives a fresh deterministic stream from the same retained authoritative RNG inputs instead of silently advancing an earlier speculative evaluation
- added explicit typed `ICoreContentInput` support to `CoreEvaluationRequest`, keeping versioned Content Registry definitions outside the concrete Core while still supplying the exact definitions required for one rule evaluation
- hardened `CoreContractVersion`/`CoreImplementationDescriptor` validity checks and bumped the reference Core implementation descriptor to `0.2.0-foundation` without changing the public Core contract version
- added a reusable golden-scenario conformance harness that can run one implementation against expected semantics or compare baseline and candidate Core implementations using fresh equivalent requests
- added tests proving compatible replacement equivalence, deliberate divergence detection, repeatable RNG-backed results on re-evaluation, immutable snapshot/content request capture and invalid default contract-version rejection
- added `v2/docs/CORE-CONFORMANCE-HARNESS.md` documenting scenario construction, semantic comparison, replay-safe RNG requirements, Content Registry inputs and the ordered next Core slices
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this is isolated Nexis 2.0 architecture/test infrastructure and does not alter the current/live game
- risk level: low to moderate; the changes deliberately tighten a pre-release contract before gameplay systems depend on it

### Nexis 2.0 replaceable Core implementation foundation
- introduced a separate `Nexis.Core.Contracts` assembly so surrounding systems can target a stable engine-facing boundary without compiling against the concrete `Nexis.Core` implementation
- added universal `CommandId` and deterministic RNG abstractions to `Nexis.Kernel`, complementing the existing authoritative game-clock and event/correlation primitives
- added versioned typed Core contracts for intents, authoritative owner snapshots, owner-addressed transitions, semantic event descriptors and typed result payloads without introducing a universal mutable PlayerState/RuntimeState contract
- added authoritative Core evaluation context carrying CommandId, CorrelationId, UTC evaluation time, gameplay rule version, content version and a controlled deterministic RNG source
- added the initial `ICoreRulesEngine` replacement seam and a reference `CoreRulesEngine` shell which rejects unsupported contract/intent work as TechnicalFailure without producing state transitions
- concrete `Nexis.Core` initially depended only on `Nexis.Core.Contracts`; later foundation work deliberately added `Nexis.Kernel` and stable Identity contracts while preserving the prohibition on feature implementation/persistence dependencies
- converted `Nexis.Architecture.Tests` from a placeholder project to `MSTest.Sdk/4.3.3` and added initial dependency-direction, infrastructure-leak, fake/replacement-Core and Core-decision behaviour tests
- updated `v2/Nexis.slnx` and `v2/docs/FOUNDATION.md` to reflect the new contract boundary and explicitly preserve the no-global-player-state rule
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this is isolated Nexis 2.0 foundation code and does not alter the current/live game
- risk level: low to moderate; architecture is isolated and intentionally minimal

### Nexis 2.0 gameplay-mode clarification
- corrected the v2 design record so **Adventures** preserve their original instant-resolution role, closest in interaction pattern to Torn Crimes: choose an action and receive an immediate server-authoritative result
- moved the recently discussed timed expedition model to its intended home under **Excursions**, including preparation, supplies, standing orders, asynchronous encounters, discoveries, injuries and return/resolution
- kept **DMOS One-Shots / Scenarios** as a third distinct player-facing mode for curated scene-by-scene interactive narrative
- explicitly allowed these modes to share lower-level Core components such as combat, checks, rewards, encounters and history while prohibiting them from being collapsed into one undifferentiated Adventure engine
- clarified that deeper exploration and rare world discovery belong primarily to Excursions/world content rather than redefining Adventures as long-duration expeditions
- player impact: none yet; this corrects the Nexis 2.0 design record before implementation
- risk level: low; documentation-only change on the isolated v2 branch

## 2026-08-25

### Nexis 2.0 foundation skeleton
- created an isolated `v2/` implementation root so the live/current Nexis code remains untouched during the parallel rebuild
- established a .NET 10 solution with `Nexis.Kernel`, `Nexis.Core`, initial Identity and Audit modules, an API composition host, and an architecture-test project placeholder
- added authoritative game-clock and immutable domain-event metadata contracts with event ID, UTC occurrence time, correlation, causation and schema version
- established server-side account/character identity and role vocabulary without name-based authority
- established the approved administrator audit visibility boundary: all meaningful privileged activity remains internally auditable, while only material player-state effects are eligible for player-facing projection
- documented strict dependency direction, persistence separation, migration isolation and pre-gameplay testing gates in `v2/docs/FOUNDATION.md`
- added `v2/docs/CORE-ARCHITECTURE.md`, defining `Nexis.Core` as the authoritative rules/logic/calculation machine while keeping its concrete implementation replaceable behind stable versioned contracts; surrounding systems retain persistent state/data/interfaces, Core returns authoritative decisions/transitions, and Core replacements require conformance/golden-scenario plus shadow-cutover safeguards
- extended the Core architecture with a production-derived replay corpus requirement: detailed authoritative traces must preserve/reconstruct the state, intent, rule/content versions, controlled time/RNG inputs, outputs, events and performance data needed to replay real historical scenarios against future Core versions; known bugs, edge cases, exploit attempts and high-value operations become permanent regression/adversarial packs
- added `v2/docs/CORE-RELEASE-GATE.md`, requiring every candidate Core to complete a minimum 30-day isolated soak on a fresh production-like VPS with no production write path, using deterministic replay, diverse AI adversarial testing and independent Voidsmith staff manual testing in parallel with cross-reproduction and human release sign-off
- added `v2/docs/COMPONENT-RELEASE-GATE.md`, generalizing the same discipline to every material Nexis component replacement/version upgrade. Never treat Core as the only moving part requiring proof. Emergency hotfixes/ordinary low-risk maintenance are a separate release class, not a loophole for calling an upgrade a patch.
- explicitly prohibited AI-only testing or AI-only release approval for material Nexis upgrades; human-only and automated-only testing are also insufficient by themselves for major replacements
- added `v2/docs/COMMAND-EXECUTION.md`, defining the researched authoritative mutation model: specialized player/admin/system/realtime execution lanes, a separate query path, stable CommandId/idempotency, server-derived actor context, authoritative-time revalidation, hybrid optimistic/selective-lock concurrency, canonical multi-resource lock ordering, atomic state/event/outbox commits and bounded whole-transaction retries
- added `v2/docs/IDENTITY-AUTHORIZATION.md`, defining permanent Account/Character separation, one playable character per normal account initially, immutable public player identity, external-provider-to-Account mappings, capability/policy-based staff authority, entitlement/domain-role separation, audited admin support behavior and the Hennet public/private authority boundary
- added `v2/docs/STATE-OWNERSHIP.md`, defining one authoritative write owner per persistent state concept; rejecting a global mutable PlayerState/runtime/qualities/counters model; separating Progression, Resources, Cooldowns, Inventory, Equipment, Effects, Economy, Marketplace, World, Travel, Hospital, Justice, Combat, Education, Skills, Magic, Spirits, Guilds, Consortiums, Knowledge, Recognition and other bounded contexts; and defining typed snapshot/transition contracts plus explicit atomic multi-owner orchestration for cross-system operations
- reconciled `v2/docs/COMMAND-EXECUTION.md`, `v2/docs/CORE-ARCHITECTURE.md` and `v2/docs/AGENT-HANDOFF.md` with the approved Core and State Ownership model: Application gathers current owner snapshots and coordinates transactions, Core alone owns gameplay rule/calculation evaluation, Content Registry owns versioned static definitions, and authoritative systems persist only typed transitions addressed to the state they own
- added `v2/docs/ENGINEERING-MANUAL.md` as the canonical instruction manual shared by Claude Code, Codex, ChatGPT/OpenAI agents, Gemini, future model families and human engineers; it fixes one common architecture/quality/security/testing/Definition-of-Done standard, explicitly prevents rogue rewrites or agent-specific architecture, and requires every spawned sub-agent to inherit the same constraints
- added `v2/docs/WORK-ORDER-TEMPLATE.md` so substantial tasks can be given to all agents with the same objective, scope, owners, contracts, acceptance criteria, verification and rollback requirements
- added `v2/AGENTS.md` as the short Codex/general-agent entrypoint and `v2/CLAUDE.md` as the Claude Code adapter importing the same canonical docs; model-specific entry files are intentionally not alternative rulebooks
- added repository-root `AGENTS.md` and `CLAUDE.md` guards so agents launched from the repository root are directed into the same v2 manual before making v2 changes and are explicitly prevented from treating the current application outside `v2/` as free foundation-work scope
- added `v2/docs/CANON-AND-LORE.md` to preserve current approved Nexis world identity independently of legacy implementation data: Silverbough is the magic/Mana/item-infusion academy; Ironhall is the dwarven/gnomish crafting, engineering and building centre; Akai Tetsu Dojo is the Edo-Japan-inspired combat/tactics academy; the Sacred Grove is the island directly south of Nexis City teaching Druidic/Shamanic healing and gifted resurrection magic; and Blackharbor/Highcourt are one shared city/academy whose first three lessons branch into mutually exclusive Light bounty-hunter/capture and Shadow headhunter/assassin kill-or-capture specializations with costly, cooldown-gated, escalating path switching while retaining previously completed training
- clarified canon provenance from the recovered early Nexis snapshot and human design history: Akai Tetsu predates Ironhall; Ironhall was explicitly conceived later as a new additional dwarven/tinkering/crafting city; the 17 May city-normalization work incorrectly replaced Akai Tetsu with Ironhall rather than expanding the world; new world elements are therefore additive by default and implementation limits such as fixed compass slots/enums may never silently delete, merge or alias existing canon
- marked conflicting v1 city/academy aliases and academy-role data as preservation/migration evidence rather than current canon, and required both Codex/general agents and Claude to read the canon manifest for world/gameplay/content/migration work
- updated the Claude Code/Codex handoff so agents must preserve Core replaceability, state ownership, command execution and identity/authorization contracts and prove dependency/ownership boundaries, multi-owner rollback, scheduler/CIEL bypass prevention, duplicate-execution, stale-state, concurrency and privilege protections before broad gameplay systems begin
- player impact: none yet; this is parallel Nexis 2.0 engineering infrastructure and does not alter the live game
- risk level: low because the new tree is isolated from the current application and no live schema or runtime path is changed

## 2026-04-19

### Ashen Crown page-enrichment and shell pass
- standardized major player-facing pages around page flavor text plus a dedicated CIEL guidance panel
- upgraded Home, City, Travel, Academies, Education, Adventure, Inventory, Market, Guilds, Consortiums, Estate Office, Black Market, Hospital, Bank, Contacts, Skills, Achievements, and Profile to use the same voice and structure
- introduced shared CIEL page copy, city copy, empty-state microcopy, and rotating quote data for broader reuse
- polished the shell by wiring public top-bar navigation, aligning sidebar branding with Ashen Crown as the world brand and Nexis as the shard/capital context, and adding a sidebar CIEL quote strip
- added a route-transition CIEL quote overlay so navigation now has a brief in-game loading feel instead of snapping coldly between pages
- removed an orphaned `src/pages/Contacts.tsx` stub after routing consolidated on the public `Contact.tsx` page
- player impact: the game now reads more like a coherent browser RPG instead of a collection of disconnected placeholder panels
- risk level: low to moderate, because the pass is mostly UI and copy integration but touches shared shell components
- follow-up: run a clean GitHub-backed build verification, resolve any remaining stale metadata such as package-lock naming, and deploy only from the AshenCrown repository
