# Nexis 2.0 Typed Content Registry Boundary

_Status: foundation implementation slice, 2026-08-26._

## Purpose

Content Registry owns versioned static definitions. Core owns rules/calculation. Authoritative gameplay systems own persistent facts.

The registry exists so Application can gather the exact immutable definitions required for one Core evaluation without Core reaching into a database, filesystem, cache, HTTP service or generic JSON store.

## Stable identity

One content definition is identified by:

- typed definition contract name;
- definition contract schema version;
- stable `ContentDefinitionId`.

The same textual definition ID under two different typed contracts is intentionally distinct.

A content definition key is **not** a gameplay-state path. It cannot address or mutate player state.

## Exact version rule

Every resolution request names an explicit authoritative `ContentVersion`.

There is no implicit `latest`, nearest-version, older-version or fallback behavior. If the requested definition does not exist under the exact requested version, resolution fails explicitly with `ContentDefinitionNotFoundException`.

This rule is critical for:

- deterministic replay;
- Core candidate comparison;
- historical command recovery;
- migrations;
- balance/content rollbacks;
- explaining exactly which definitions produced an authoritative result.

A future deployment may decide which ContentVersion is active for new commands, but once a Core evaluation is assembled the exact version is already fixed in `CoreEvaluationContext`.

## Typed definitions only

`IVersionedContentDefinition` extends the existing `ICoreContentInput` seam and requires a stable definition ID.

The stable contract deliberately does not expose:

- `Dictionary<string, object>`;
- mutable JSON nodes;
- generic property paths;
- arbitrary key/value mutation;
- database entities;
- EF/Npgsql/cache/network types.

Each domain defines real typed records for the content Core needs, such as a future weapon definition, Academy lesson definition, Adventure definition or spell definition.

## Resolution integrity

`ContentResolutionRequest`:

- freezes caller-supplied keys;
- rejects null keys;
- rejects duplicate keys;
- retains request ordering.

`ContentResolution`:

- requires exactly one definition per requested key;
- requires each returned definition key to match the request at the same index;
- freezes the resolved set;
- exposes a read-only `ICoreContentInput` view for Core request assembly.

This prevents a registry implementation from quietly returning an extra/missing/wrong definition while still claiming the requested content version.

## Reference registry

`Nexis.Content.Registry.ImmutableContentRegistry` is a small replaceable reference implementation for tests/composition/static packs.

It stores definitions by exact `(ContentVersion, ContentDefinitionKey)` and:

- rejects duplicate definitions for the same version/key;
- resolves only exact versions;
- preserves requested order;
- never falls back to another version.

It is not a mandate that production content must live in memory. A later PostgreSQL/file/pack/cached implementation can satisfy the same `IContentRegistryReader` boundary.

## Dependency direction

- `Nexis.Content.Contracts` depends only on `Nexis.Core.Contracts`;
- `Nexis.Content.Registry` depends only on stable Core/Content contract assemblies;
- `Nexis.Core.Contracts` does **not** depend on the Content Registry;
- concrete Core continues to receive only `ICoreContentInput` values in its evaluation request.

Replacing the registry therefore does not replace or recompile the Core contract.

## Content schema evolution

Content version and definition schema are separate dimensions:

- `ContentVersion` identifies the authoritative registry snapshot/release used by an evaluation;
- each `ContractDescriptor.SchemaVersion` identifies the structural schema of one definition type.

Changing balance values can produce a new ContentVersion without necessarily changing the definition schema. Changing the definition shape requires an explicit schema-version decision and compatible codecs/migration/replay handling.

No schema/version should be silently coerced.

## Verification

Architecture/behavior tests cover:

- infrastructure-neutral Content contracts;
- no reverse Core-contract dependency on Content Registry assemblies;
- exact-version resolution;
- no latest/other-version fallback;
- duplicate registry entry rejection;
- duplicate request-key rejection;
- frozen request collections;
- strict result key/order matching;
- same definition ID remaining distinct under different typed contracts;
- reference-registry dependency restrictions.

## Next use

The first real gameplay Core vertical proof should define only the specific typed content records it actually requires, then resolve those records through this boundary.

Do not pre-build a universal item/spell/Academy/world mega-schema. Domain content types should emerge from approved gameplay contracts, remain independently versionable, and feed Core through the same stable input seam.
