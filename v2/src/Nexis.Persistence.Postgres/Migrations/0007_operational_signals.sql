CREATE TABLE IF NOT EXISTS nexis_v2.operational_signals (
    signal_id uuid PRIMARY KEY,
    condition_kind integer NOT NULL,
    severity integer NOT NULL,
    component text NOT NULL
        CHECK (component ~ '^[a-z0-9._-]{1,128}$'),
    reason text NOT NULL
        CHECK (reason ~ '^[a-z0-9._-]{1,128}$'),
    occurred_at_utc timestamptz NOT NULL,
    command_id uuid NULL,
    correlation_id uuid NULL,
    original_correlation_id uuid NULL,
    actor_discriminator char(64) NULL
        CHECK (actor_discriminator IS NULL OR actor_discriminator ~ '^[0-9a-f]{64}$'),
    event_id uuid NULL,
    attempt_count integer NULL
        CHECK (attempt_count IS NULL OR attempt_count > 0)
);

CREATE INDEX IF NOT EXISTS ix_operational_signals_command
    ON nexis_v2.operational_signals(command_id, occurred_at_utc);

CREATE INDEX IF NOT EXISTS ix_operational_signals_condition
    ON nexis_v2.operational_signals(condition_kind, occurred_at_utc);

CREATE OR REPLACE FUNCTION nexis_v2.reject_operational_signal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'operational signals are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_signals_append_only
    ON nexis_v2.operational_signals;

CREATE TRIGGER trg_operational_signals_append_only
BEFORE UPDATE OR DELETE ON nexis_v2.operational_signals
FOR EACH ROW
EXECUTE FUNCTION nexis_v2.reject_operational_signal_mutation();
