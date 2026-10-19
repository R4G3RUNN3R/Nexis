# Nexis Core Replay Corpus Boundary

_Status: foundation implementation record, 2026-08-27. Subordinate to `CORE-ARCHITECTURE.md`, `CORE-RELEASE-GATE.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `ENGINEERING-MANUAL.md`._

## Purpose

`Nexis.History.Replay` turns privacy-reviewed historical Core evaluations into immutable, versioned regression artifacts. It is internal History/Replay evidence, not current gameplay truth, operational telemetry, Admin Audit or Player Log.

The V1 boundary is intentionally narrow. It supports the existing typed `EquipItem` vertical and establishes the extension pattern for later rule contracts without adding gameplay rules or a second execution model.

## Extraction boundary

A capture consumes existing authoritative objects:

- `CoreEvaluationRequest` with typed intent, owner snapshots, content, authoritative UTC time, rule/content versions and controlled RNG factory;
- `CoreDecision` with typed result, owner transitions and semantic events;
- `CommandCommitPlan` with CommandId identity, canonical payload fingerprint, original CorrelationId, Core implementation/contract version, terminal outcome and committed event metadata;
- typed replay provenance, scenario tags, persistence disposition, evaluation duration and an opaque restricted-RNG reference.

Before encoding, the extractor verifies that the request, decision and command trace agree. Unknown intent contracts fail closed before their contents are inspected.

Each intent schema requires an explicit privacy-reviewed `IReplayScenarioCodec`. There is no reflection serializer, runtime CLR type metadata, raw JSON fallback, generic object bag or arbitrary metadata field.

## Normalization and versioning

A V1 artifact contains a deterministic canonical JSON envelope and a SHA-256 content-addressed `ReplayScenarioId`. Collection order that is not gameplay meaning is normalized before encoding.

The envelope retains:

- replay corpus and typed contract schema versions;
- CommandId, original CorrelationId, EventId and event causation;
- canonical command payload fingerprint, but not raw command JSON;
- Core implementation/contract, rule and content versions;
- authoritative evaluation/completion/event times;
- rule-relevant typed intent, snapshots, content, decision, transitions and events;
- terminal and persistence outcomes;
- evaluation duration;
- provenance fingerprint and typed provenance kind;
- ordinary, known-bug, exploit, concurrency and high-value tags;
- an opaque reference for restricted deterministic RNG resolution.

The retained command-payload fingerprint is opaque corroborating metadata. Because the privacy boundary deliberately excludes raw command JSON, the artifact cannot independently recompute or authenticate that fingerprint against the original payload.

The replay runner reconstructs the same typed `CoreEvaluationRequest`, resolves RNG through `IRestrictedReplayRandomResolver`, invokes any compatible `ICoreRulesEngine`, and compares the candidate decision with the retained semantic fingerprint. It never commits owner state or emits authoritative effects.

## Privacy and security

The V1 Equip Item codec uses keyed pseudonymization for AccountId, CharacterId and ItemInstanceId while preserving equality relationships required by the rule.

The corpus cannot retain the following merely for completeness:

- passwords, credentials, authentication/session tokens, API keys or private keys;
- raw canonical command JSON;
- actor capabilities, entitlements or security-version state not required by the Equip Item rule;
- raw RNG seeds, stream state or future random outcomes;
- unrestricted security, anti-cheat, Admin Audit or infrastructure metadata;
- arbitrary extra JSON fields or unregistered typed contracts.

The pseudonymization key and restricted RNG material are not part of the artifact. Restricted RNG storage and access control remain an operations/security responsibility; the corpus contains only an opaque lookup reference.

Strict JSON deserialization rejects unknown fields at every typed envelope level. Retention accepts only integrity-valid artifacts produced through the reviewed boundary.

## Retention


`ProvenanceKind` and `SourceFingerprint` are operator-supplied provenance metadata, not cryptographic attestation of origin. The codec validates their reviewed shape and internal consistency only. Any offline production export/selection writer must therefore be access-controlled outside this component; a future forensic-evidence use case requires an explicit trusted attestation boundary.
`FileReplayCorpusStore` is an immutable, content-addressed retention adapter suitable for checked-in or separately archived internal corpus packs:

- creates one `<sha256>.replay.v1.json` artifact;
- never overwrites an existing scenario;
- treats an identical duplicate as already present;
- detects filename/content mismatch, collision and tampering;
- exposes no PostgreSQL, HTTP, frontend, concrete Core or Player Log dependency.

No production source was accessed and no real production artifact was harvested in this slice. Authorized offline export/selection can now feed this boundary without granting the tool live-database or production-write access.

## Current coverage and extension rule

Executable coverage proves normalization, version/provenance/tag retention, keyed pseudonymization, secret/RNG exclusion, strict-schema rejection, cross-field ingest consistency, canonical value spellings, bounded reviewed token vocabularies, deterministic replay, input-order and byte canonicalization, immutable retention, tamper detection and architecture isolation.

Only `EquipItem` schema V1 is registered. A later command schema must add a focused typed codec and adversarial privacy/determinism tests. It must not weaken the fail-closed registry, introduce a generic payload serializer or expose restricted data to make corpus ingestion convenient.

Equip Item events are direct command outcomes and therefore retain no event causation parent. A future codec for a legitimately chained event must validate the explicit parent identity and ordering; it must not copy Equip Item's blanket null-causation rule.
