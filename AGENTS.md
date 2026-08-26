# Nexis Repository Agent Guard

For any task involving Nexis 2.0 or files under `v2/`, the canonical engineering instructions are in:

- `v2/docs/ENGINEERING-MANUAL.md`
- `v2/docs/WORK-ORDER-TEMPLATE.md`
- `v2/docs/CORE-ARCHITECTURE.md`
- `v2/docs/STATE-OWNERSHIP.md`
- `v2/docs/COMMAND-EXECUTION.md`
- `v2/docs/IDENTITY-AUTHORIZATION.md`
- `v2/docs/AGENT-HANDOFF.md`

Read them before non-trivial v2 edits. `v2/AGENTS.md` provides the scoped v2 summary.

The existing/current Nexis application outside `v2/` is reference/migration source during the v2 foundation effort and must not be modified merely because an agent started at repository root. Only change it when the human task explicitly authorizes that scope.

Do not create an alternative v2 app at repository root, silently replace the approved architecture, deploy production, or merge production refs unless explicitly instructed.
