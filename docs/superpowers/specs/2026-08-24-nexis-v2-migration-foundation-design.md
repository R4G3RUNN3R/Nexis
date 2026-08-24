# Nexis v2 Migration Foundation Design

> **Status:** Approved architectural design for the migration foundation.  
> **Branch:** `voidsmith-source-of-truth`  
> **Date:** 2026-08-24

## 1. Purpose

The migration foundation provides a repeatable, destructive-safe way to transform the preserved Nexis v1 database into a clean Nexis v2 schema without ever using the old live Hetzner database as a development target.

The design exists to guarantee four things:

1. the old Nexis installation remains untouched during development;
2. every migration run begins from the same preserved source snapshot;
3. v2 schema evolution remains independent of v1 storage decisions;
4. unmapped or inconsistent data becomes an explicit anomaly rather than being silently discarded.

This subsystem is infrastructure for later migration mappings. It does not itself define the final v2 domain schema.

---

## 2. Core architecture

Each rehearsal uses two disposable PostgreSQL 16 containers:

```text
IMMUTABLE PRESERVED V1 DUMP
        |
        v
+--------------------+
| source-v1          |
| PostgreSQL 16      |
| restored v1 schema |
+--------------------+
        |
        | SELECT-only migration role
        v
+------------------------+
| migration runner       |
| repo-owned Node scripts|
+------------------------+
        |
        | controlled writes
        v
+--------------------+
| target-v2          |
| PostgreSQL 16      |
| clean v2 schema    |
+--------------------+
        |
        v
RECONCILIATION + ANOMALY REPORTS
```

The two databases are deliberately separate containers. A failed migration can destroy both containers and start again without risking either server's real data.

No migration rehearsal connects directly to the live Hetzner PostgreSQL service.

---

## 3. Source snapshot policy

The preserved v1 database dump is:

`/srv/voidsmith/nexis/legacy/database/nexis-db-20260824.dump`

Related evidence:

- `/srv/voidsmith/nexis/legacy/database/nexis-db-20260824-schema.sql`
- `/srv/voidsmith/nexis/legacy/database/nexis-db-20260824-rowcounts.txt`

These files are immutable migration inputs.

Migration scripts must never:

- overwrite them;
- edit them;
- restore into the old live database;
- treat a rehearsal database as authoritative production state.

At final migration rehearsal/cutover, a fresh read-only export from the live server may replace the development snapshot as the input for a new run. The same migration pipeline must process both snapshots without special-case manual edits.

---

## 4. Container lifecycle

Each run creates uniquely named disposable resources derived from a run ID, for example:

```text
nexis-migrate-20260824T190500Z-source-v1
nexis-migrate-20260824T190500Z-target-v2
```

The source container:

- runs PostgreSQL 16;
- receives only a restored copy of the preserved v1 dump;
- is never exposed publicly;
- is accessed by the migration runner through a read-only application role;
- is treated as immutable after restore.

The target container:

- runs PostgreSQL 16;
- starts empty;
- receives v2 schema migrations from `db/migrations/`;
- accepts writes only from the migration runner and schema tooling used for the rehearsal;
- is disposable until a future production database design explicitly promotes an equivalent schema.

Containers use a dedicated private Docker network for each run. No database port is published to the public interface.

---

## 5. Migration runner

Migration code lives under:

`scripts/nexis-v2-migration/`

The migration runner is implemented in Node.js so it can reuse the project's JavaScript/TypeScript ecosystem and PostgreSQL client conventions.

Its responsibilities are deliberately narrow:

1. validate input files/checksums;
2. verify source and target connection identity;
3. verify the source connection is read-only;
4. read v1 records;
5. transform records through explicit mapping modules;
6. write transformed records to target-v2;
7. record anomalies;
8. run reconciliation checks;
9. write machine-readable run artifacts;
10. exit non-zero when required reconciliation fails.

The runner must not modify Docker/network infrastructure itself. A separate orchestration script controls the run lifecycle so migration logic and infrastructure logic can be tested independently.

---

## 6. Repository layout

The migration foundation introduces this structure:

```text
db/
  migrations/
    ...versioned v2 SQL migrations...

scripts/
  nexis-v2-migration/
    README.md
    run-rehearsal.sh
    lib/
      config.js
      source.js
      target.js
      checksums.js
      anomalies.js
      reconciliation.js
    mappings/
      ...one mapping module per migrated domain...
    reports/
      ...report serializers/schemas...
```

No v2 migration code is stored under `/srv/voidsmith/nexis/legacy`.

The active new-server checkout remains:

`/srv/voidsmith/nexis/worktrees/voidsmith-source-of-truth`

---

## 7. Per-run artifact layout

Every rehearsal creates:

```text
/srv/voidsmith/nexis/migration/runs/<run-id>/
  manifest.json
  input-checksums.txt
  source-rowcounts.json
  target-rowcounts.json
  reconciliation.json
  anomalies.json
  logs/
    restore-source.log
    schema-target.log
    migration.log
    reconciliation.log
```

### `manifest.json`

Records at minimum:

- run ID;
- started/completed timestamps;
- Git commit SHA of migration code;
- input dump path;
- input dump SHA-256;
- PostgreSQL image/version;
- source/target container identifiers;
- schema migration version applied;
- overall status.

### `anomalies.json`

Every anomaly records:

- migration domain;
- source table/record identifier where possible;
- stable anomaly code;
- human-readable explanation;
- severity;
- whether the run can continue;
- any source value needed for investigation, excluding secrets/password hashes from logs.

### `reconciliation.json`

Contains named checks with:

- expected value;
- actual value;
- pass/fail status;
- discrepancy count;
- optional anomaly references.

---

## 8. Source database access model

After the v1 dump is restored, the orchestration layer creates a dedicated read-only role for migration extraction.

The migration runner must connect with that role, not the PostgreSQL superuser.

The role receives only the permissions required to inspect preserved v1 data.

Before extraction begins, the runner performs a deliberate write probe inside a transaction that must fail because the source role is read-only. If the write probe unexpectedly succeeds, the run aborts immediately.

The migration runner never stores source database credentials in Git. Run-specific credentials are generated or passed through process environment and are removed with the disposable containers/run environment.

---

## 9. Target database access model

The target database is disposable rehearsal state.

Schema migrations execute before domain migration begins.

The migration runner receives only the target permissions needed by the migration process.

Later production database roles may be stricter and separated into application/runtime/admin roles, but that production security design is outside this subsystem.

---

## 10. ID continuity

Unless a domain-specific migration design explicitly says otherwise:

- `users.internal_id` remains unchanged;
- user public numeric IDs remain unchanged;
- organization internal/public IDs remain unchanged;
- important historical external references remain traceable to original IDs.

If the v2 schema introduces new surrogate IDs, it must also preserve the old stable identity through explicit migration keys or mapping records.

No migration may renumber players merely because a new schema would make sequential IDs prettier.

---

## 11. Mapping architecture

Migration mappings are domain-specific and composable.

Examples of future mapping modules:

```text
mappings/accounts.js
mappings/player-core.js
mappings/education.js
mappings/inventory.js
mappings/organizations.js
mappings/chronicle.js
mappings/marketplace.js
```

Each mapping module has three responsibilities:

1. **extract** only the source data it owns;
2. **transform** it according to an approved v2 domain specification;
3. **load** it into target tables through explicit target interfaces.

Mapping modules do not silently depend on ordering side effects. Dependencies must be declared by orchestration order, for example accounts before inventory ownership.

The migration foundation can ship before most mappings exist. Unimplemented domains remain explicitly listed as unmapped and prevent production cutover until their preservation decision is complete.

---

## 12. Anomaly policy

Anomalies are a normal migration output, not an excuse to guess.

Examples:

- player references a missing item definition;
- organization member references a missing user;
- malformed JSONB branch;
- duplicate identity that violates a v2 invariant;
- unknown old city identifier;
- active course cannot be mapped to a v2 course;
- inventory quantity is invalid;
- historical record references retired content without a defined archival mapping.

Severity levels:

- **info** — preserved but noteworthy;
- **warning** — migration can continue, human review required before cutover;
- **error** — affected record/domain failed to migrate correctly;
- **fatal** — run cannot be considered valid and stops.

No migration code may replace an unknown value with a convenient default unless that fallback is explicitly documented in the relevant domain migration design.

---

## 13. Reconciliation contract

The foundation supports reconciliation checks from the beginning. Domain plans add their own checks as mappings are implemented.

The eventual production-cutover reconciliation set must include at least:

1. accounts/user counts;
2. every internal/public ID;
3. account privilege/deactivation state;
4. currency balances;
5. inventory/equipment ownership and quantities;
6. active/completed Education and timestamps;
7. skill/mastery conversion results;
8. titles/Achievements/Chronicle/Feats history;
9. properties and important item instances;
10. travel state where meaningful at cutover;
11. Guild/Consortium identities, founders, members, roles and treasury;
12. organization base ownership/payments/events;
13. marketplace ownership/status;
14. one-shot completion/grant/entitlement ledgers;
15. admin audit history;
16. upload/profile-image references;
17. all unresolved anomalies.

A run reports success only when every required check for that stage passes and no fatal anomalies exist.

During early development, checks for not-yet-designed domains are marked `unmapped`, never falsely reported as passing.

---

## 14. Failure handling

### Restore failure

- capture restore log;
- mark run failed;
- destroy only run-specific containers/network/volumes;
- leave preserved dump untouched.

### Schema migration failure

- capture target schema log;
- stop before domain migration;
- destroy disposable run infrastructure.

### Mapping failure

- transaction rollback at the narrowest safe domain/batch boundary;
- record anomaly/error context;
- mark required check failed;
- do not mutate source-v1.

### Reconciliation failure

- retain run reports/logs for diagnosis;
- target database may be retained temporarily for debugging when explicitly requested, otherwise destroyed after artifacts are captured;
- never promote the target as valid state.

### Unexpected source write capability

- abort before migration;
- classify as fatal infrastructure misconfiguration.

---

## 15. Secrets and logging

Never commit or print:

- old/new database passwords;
- password hashes in reports;
- session tokens;
- reset/email-change tokens;
- SMTP/API secrets;
- OAuth client secrets;
- private SSH keys.

The migration logs may record stable internal/public IDs where required for diagnosis, but reports should avoid unnecessary personal account data.

Secrets for the final environment remain under the Voidsmith secrets hierarchy outside Git.

---

## 16. Testing strategy

The migration foundation requires tests at several levels.

### Unit tests

Test pure helpers for:

- checksum verification;
- run-manifest construction;
- anomaly serialization;
- reconciliation comparisons;
- mapping transforms as each domain is added.

### Infrastructure smoke test

A rehearsal with the preserved v1 dump must prove:

1. PostgreSQL 16 source container starts;
2. dump restores successfully;
3. source table counts match captured preservation evidence;
4. read-only migration role can read;
5. write probe through that role fails;
6. target container starts empty;
7. target schema migrations apply cleanly;
8. runner produces all required artifact files;
9. containers/network can be destroyed without deleting run reports.

### Determinism test

Two runs using:

- the same Git commit;
- the same dump checksum;
- the same schema version;

must produce equivalent migrated domain data and reconciliation results, excluding run IDs/timestamps/random ephemeral credentials.

### Negative tests

Explicitly test:

- bad dump checksum;
- missing dump;
- restore failure;
- source connection accidentally writable;
- malformed source record;
- target constraint failure;
- reconciliation mismatch;
- unknown/unmapped source value.

---

## 17. Development and production boundaries

Development/rehearsal:

- always uses preserved dump files;
- always uses disposable source/target databases;
- may run repeatedly;
- never requires old-server database access.

Pre-cutover/final rehearsal:

- produces a fresh read-only dump from old live;
- verifies its checksum;
- runs the identical pipeline;
- compares reconciliation/anomalies with earlier runs.

Cutover itself is a separate operational plan. This design does not authorize DNS changes, service shutdown, old-server mutation, or production database promotion.

---

## 18. Non-goals

This subsystem does not yet decide:

- the full v2 domain schema;
- production PostgreSQL hosting topology;
- Caddy/nginx cutover;
- frontend deployment;
- live DNS switch;
- account session-preservation policy at final cutover;
- final mana/combat/economy balancing;
- exact old-to-new Education/item/mastery mappings.

Those belong to later approved subsystem specifications.

---

## 19. Acceptance criteria

The migration foundation is ready for domain-mapping work when all of the following are true:

- `voidsmith-source-of-truth` contains the orchestration and migration-runner foundation;
- a preserved v1 dump restores into a disposable PostgreSQL 16 source container;
- the migration runner accesses source-v1 only through a verified read-only role;
- a separate disposable PostgreSQL 16 target starts from clean v2 migrations;
- run artifacts are written under `/srv/voidsmith/nexis/migration/runs/<run-id>/`;
- source row counts are captured and compared to preservation evidence;
- anomaly and reconciliation outputs are machine-readable;
- failure destroys only disposable run infrastructure;
- repeated runs do not modify `/srv/voidsmith/nexis/legacy`;
- old Hetzner Nexis remains untouched and live;
- no secrets are committed or emitted into migration reports.

Only after these acceptance criteria pass do later subsystem plans begin adding real account, Education, inventory, organization and other v1→v2 mappings.