CREATE SCHEMA IF NOT EXISTS nexis_v2;

CREATE TABLE IF NOT EXISTS nexis_v2.command_receipts (
    command_id uuid PRIMARY KEY,
    lane integer NOT NULL CHECK (lane BETWEEN 0 AND 3),
    actor_account_id uuid NULL,
    actor_character_id uuid NULL,
    intent_name text NOT NULL,
    intent_schema_version integer NOT NULL CHECK (intent_schema_version > 0),
    payload_fingerprint char(64) NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
    original_correlation_id uuid NOT NULL,
    execution_token uuid NOT NULL,
    received_at_utc timestamptz NOT NULL,
    terminal_status integer NULL CHECK (terminal_status BETWEEN 0 AND 5),
    terminal_reason text NULL,
    completed_at_utc timestamptz NULL,
    core_implementation_name text NULL,
    core_implementation_version text NULL,
    core_contract_version integer NULL,
    rule_version text NULL,
    content_version text NULL,
    evaluated_at_utc timestamptz NULL,
    CONSTRAINT ck_command_actor_shape CHECK (
        (lane IN (0, 3) AND actor_account_id IS NOT NULL AND actor_character_id IS NOT NULL)
        OR (lane = 1 AND actor_account_id IS NOT NULL AND actor_character_id IS NULL)
        OR (lane = 2 AND actor_account_id IS NULL AND actor_character_id IS NULL)
    ),
    CONSTRAINT ck_command_terminal_shape CHECK (
        (terminal_status IS NULL AND terminal_reason IS NULL AND completed_at_utc IS NULL
            AND core_implementation_name IS NULL AND core_implementation_version IS NULL
            AND core_contract_version IS NULL AND rule_version IS NULL
            AND content_version IS NULL AND evaluated_at_utc IS NULL)
        OR
        (terminal_status IS NOT NULL AND completed_at_utc IS NOT NULL
            AND core_implementation_name IS NOT NULL AND core_implementation_version IS NOT NULL
            AND core_contract_version IS NOT NULL AND core_contract_version > 0
            AND rule_version IS NOT NULL AND content_version IS NOT NULL
            AND evaluated_at_utc IS NOT NULL
            AND ((terminal_status = 0 AND terminal_reason IS NULL)
                OR (terminal_status <> 0 AND terminal_reason IS NOT NULL)))
    )
);

CREATE TABLE IF NOT EXISTS nexis_v2.authoritative_events (
    event_id uuid PRIMARY KEY,
    command_id uuid NOT NULL REFERENCES nexis_v2.command_receipts(command_id),
    correlation_id uuid NOT NULL,
    occurred_at_utc timestamptz NOT NULL,
    causation_event_id uuid NULL,
    contract_name text NOT NULL,
    contract_schema_version integer NOT NULL CHECK (contract_schema_version > 0),
    payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_authoritative_events_command
    ON nexis_v2.authoritative_events(command_id);
CREATE INDEX IF NOT EXISTS ix_authoritative_events_correlation
    ON nexis_v2.authoritative_events(correlation_id);

CREATE TABLE IF NOT EXISTS nexis_v2.outbox (
    event_id uuid PRIMARY KEY REFERENCES nexis_v2.authoritative_events(event_id),
    command_id uuid NOT NULL REFERENCES nexis_v2.command_receipts(command_id),
    correlation_id uuid NOT NULL,
    occurred_at_utc timestamptz NOT NULL,
    contract_name text NOT NULL,
    contract_schema_version integer NOT NULL CHECK (contract_schema_version > 0),
    payload jsonb NOT NULL,
    created_at_utc timestamptz NOT NULL DEFAULT now(),
    published_at_utc timestamptz NULL,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS ix_outbox_pending
    ON nexis_v2.outbox(created_at_utc, event_id)
    WHERE published_at_utc IS NULL;

CREATE TABLE IF NOT EXISTS nexis_v2.admin_audit (
    audit_id uuid PRIMARY KEY,
    command_id uuid NULL REFERENCES nexis_v2.command_receipts(command_id),
    acting_account_id uuid NOT NULL,
    target_account_id uuid NULL,
    action_kind integer NOT NULL,
    visibility integer NOT NULL,
    occurred_at_utc timestamptz NOT NULL,
    action text NOT NULL,
    outcome text NOT NULL,
    safe_player_reason text NULL,
    case_reference text NULL,
    correlation_id uuid NOT NULL,
    causation_event_id uuid NULL
);

CREATE INDEX IF NOT EXISTS ix_admin_audit_actor_time
    ON nexis_v2.admin_audit(acting_account_id, occurred_at_utc);
CREATE INDEX IF NOT EXISTS ix_admin_audit_correlation
    ON nexis_v2.admin_audit(correlation_id);
