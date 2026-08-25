# Nexis 2.0 Engineering Work Order Template

_Status: canonical task-packet template, 2026-08-25._

Use this template for substantial Claude Code, Codex, ChatGPT/OpenAI agent, Gemini, human-engineer or sub-agent implementation tasks.

The purpose is to give every implementer the same facts, boundaries and acceptance criteria. The task may omit sections that genuinely do not apply, but it must not omit information whose ambiguity could change architecture, security, state ownership or public behaviour.

---

## Work Order

### 1. Identity

**Task ID / title:**

**Repository:** `R4G3RUNN3R/Nexis`

**Branch / worktree:**

**Target area:** `v2/`

**Requested by:**

### 2. Objective

State the required outcome in plain language.

What must exist/work when this task is complete?

### 3. Player / operator behaviour

Describe externally observable behaviour:

- what the player/operator does;
- what Nexis should do;
- what success looks like;
- expected rejection/failure behaviour;
- what must remain unchanged.

Do not substitute implementation detail for product behaviour.

### 4. In scope

List the exact systems/features/files/contracts the task may change.

### 5. Explicitly out of scope

List adjacent systems/features that must not be redesigned or "cleaned up" during this task.

Default unless explicitly changed:

- no live production deployment;
- no merge to production/main;
- no v1/current-app mutation outside approved migration/reference work;
- no runtime/framework replacement;
- no microservice extraction;
- no architecture/state-owner reassignment;
- no unrelated refactor.

### 6. Binding instructions

Mandatory:

- `docs/ENGINEERING-MANUAL.md`
- `docs/CORE-ARCHITECTURE.md`
- `docs/STATE-OWNERSHIP.md`
- `docs/COMMAND-EXECUTION.md`
- `docs/IDENTITY-AUTHORIZATION.md`
- `docs/AGENT-HANDOFF.md`

Add any task-specific specification/research documents here.

### 7. Authoritative state owners involved

For each persistent fact touched, state the sole authoritative owner.

| State/fact | Authoritative owner | Read/write in this task? |
| --- | --- | --- |
|  |  |  |

If a persistent fact has no clear owner, stop and resolve ownership before implementation. Do not create a miscellaneous state bucket.

### 8. Core responsibility

State which gameplay rules/calculations Core must evaluate for this task.

State which parts are merely persistence/orchestration/projection and therefore must stay outside Core.

### 9. Contracts

**Existing contracts to use:**

**New contracts allowed:** yes / no / only with explicit review

**Breaking contract changes allowed:** yes / no

**Contract version impact:**

No implementer may expose implementation/persistence internals merely to make integration convenient.

### 10. Persistence / migration

**Schema/storage changes allowed:** yes / no

**Migration required:** yes / no

**Live v1 database access:** read-only / none / explicitly authorized write

**Data invariants:**

State concurrency/revision/uniqueness/ownership requirements.

### 11. Cross-owner transaction

**Single owner / atomic multi-owner / long-running workflow / post-commit projection:**

If multi-owner, list every participating owner and what must roll back together.

Define lock/revision/reservation requirements where known.

### 12. Security / abuse cases

List relevant threats, for example:

- forged CharacterId/role/authority;
- stale client state;
- duplicate CommandId;
- double-spend/duplicate item;
- race/concurrency;
- IDOR/hidden information leak;
- privilege escalation;
- replay/automation abuse;
- admin/CIEL/scheduler bypass.

### 13. Acceptance criteria

Use testable statements.

- [ ]
- [ ]
- [ ]

Acceptance criteria define completion. An agent may not silently replace them with a different interpretation.

### 14. Required tests

At minimum identify:

- unit/rule tests;
- architecture/ownership tests;
- integration/persistence tests;
- rejection/conflict tests;
- idempotency tests;
- concurrency/atomic rollback tests where relevant;
- security/adversarial tests where relevant;
- replay/determinism tests for Core logic;
- regression test if fixing a bug.

### 15. Verification commands

Default from repository root where available:

```text
dotnet --info
dotnet restore v2/Nexis.slnx
dotnet build v2/Nexis.slnx --no-restore
dotnet test v2/Nexis.slnx --no-build
```

Add task-specific checks here.

Never claim a command passed unless it was actually run and the result observed.

### 16. Documentation / changelog

List documents that must change if implementation changes their truth.

`CHANGELOG.md` update required for direct repository implementation changes: yes / no

### 17. Deployment authority

Choose exactly one:

- **NONE** - repository work only; do not deploy.
- **TEST ONLY** - deploy only to explicitly named isolated test environment.
- **PRODUCTION AUTHORIZED** - only when the human explicitly authorizes a named production action.

Default is **NONE**.

### 18. Parallel-agent plan

If delegating:

| Agent/work unit | Exact scope | Files/contracts | Depends on | Must not touch |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Shared public contracts/central files have one designated integrator.

Every child receives the canonical Engineering Manual plus this Work Order or a narrower child Work Order that preserves all parent constraints.

### 19. Definition of Done

The task is done only when:

- all acceptance criteria are met;
- architecture/ownership/security rules are preserved;
- required tests/checks pass where the environment supports them;
- failures/unrun checks are disclosed;
- changelog/docs are updated where required;
- no unauthorized deployment/merge occurred;
- final handoff follows `ENGINEERING-MANUAL.md`.

### 20. Final handoff evidence

The implementer returns:

- summary;
- changed areas;
- exact verification performed/results;
- player/operator impact;
- real residual risk/blocker only.

---

## Rule for identical tasking across agents

When two or more independent agents are asked to implement/review the same Nexis task, provide the same parent Work Order and the same binding documents.

Do not give Claude architectural freedoms that Codex did not receive, or vice versa. Model-specific prompt wording may explain tool mechanics, but it must not change requirements, scope, authority, Definition of Done or architecture.
