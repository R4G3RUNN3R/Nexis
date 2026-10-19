ALTER TABLE nexis_v2.command_receipts
    ADD COLUMN IF NOT EXISTS recovery_abandoned_at_utc timestamptz NULL,
    ADD COLUMN IF NOT EXISTS recovery_abandon_reason text NULL;

ALTER TABLE nexis_v2.command_receipts
    DROP CONSTRAINT IF EXISTS ck_command_recovery_abandon_shape;

ALTER TABLE nexis_v2.command_receipts
    ADD CONSTRAINT ck_command_recovery_abandon_shape CHECK (
        (recovery_abandoned_at_utc IS NULL AND recovery_abandon_reason IS NULL)
        OR
        (canonical_payload IS NOT NULL
            AND recovery_abandoned_at_utc IS NOT NULL
            AND recovery_abandon_reason IS NOT NULL
            AND length(btrim(recovery_abandon_reason)) BETWEEN 1 AND 128
            AND recovery_abandon_reason ~ '^[a-z0-9._-]+$'
            AND (terminal_status IS NULL OR terminal_status = 5))
    );

CREATE INDEX IF NOT EXISTS ix_command_receipts_recovery_active
    ON nexis_v2.command_receipts(execution_lease_expires_at_utc, received_at_utc, command_id)
    WHERE terminal_status IS NULL
      AND canonical_payload IS NOT NULL
      AND recovery_abandoned_at_utc IS NULL;

ALTER TABLE nexis_v2.outbox
    ADD COLUMN IF NOT EXISTS poison_attempt_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dead_lettered_at_utc timestamptz NULL,
    ADD COLUMN IF NOT EXISTS dead_letter_reason text NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_outbox_poison_attempt_count_nonnegative'
          AND conrelid = 'nexis_v2.outbox'::regclass
    ) THEN
        ALTER TABLE nexis_v2.outbox
            ADD CONSTRAINT ck_outbox_poison_attempt_count_nonnegative CHECK (
                poison_attempt_count >= 0
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_outbox_dead_letter_shape'
          AND conrelid = 'nexis_v2.outbox'::regclass
    ) THEN
        ALTER TABLE nexis_v2.outbox
            ADD CONSTRAINT ck_outbox_dead_letter_shape CHECK (
                (dead_lettered_at_utc IS NULL AND dead_letter_reason IS NULL)
                OR
                (published_at_utc IS NULL
                    AND lease_token IS NULL
                    AND lease_owner IS NULL
                    AND lease_expires_at_utc IS NULL
                    AND dead_lettered_at_utc IS NOT NULL
                    AND dead_letter_reason IS NOT NULL
                    AND length(btrim(dead_letter_reason)) BETWEEN 1 AND 128
                    AND dead_letter_reason ~ '^[a-z0-9._-]+$')
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_outbox_delivery_active
    ON nexis_v2.outbox(available_at_utc, created_at_utc, event_id)
    WHERE published_at_utc IS NULL
      AND dead_lettered_at_utc IS NULL;
