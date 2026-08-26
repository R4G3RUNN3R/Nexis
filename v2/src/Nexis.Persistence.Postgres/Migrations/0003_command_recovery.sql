ALTER TABLE nexis_v2.command_receipts
    ADD COLUMN IF NOT EXISTS canonical_payload jsonb NULL,
    ADD COLUMN IF NOT EXISTS execution_owner text NULL,
    ADD COLUMN IF NOT EXISTS execution_lease_expires_at_utc timestamptz NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_command_execution_lease_shape'
          AND conrelid = 'nexis_v2.command_receipts'::regclass
    ) THEN
        ALTER TABLE nexis_v2.command_receipts
            ADD CONSTRAINT ck_command_execution_lease_shape CHECK (
                (terminal_status IS NULL AND (
                    (canonical_payload IS NULL
                        AND execution_owner IS NULL
                        AND execution_lease_expires_at_utc IS NULL)
                    OR
                    (canonical_payload IS NOT NULL
                        AND execution_owner IS NOT NULL
                        AND length(btrim(execution_owner)) > 0
                        AND execution_lease_expires_at_utc IS NOT NULL)))
                OR
                (terminal_status IS NOT NULL
                    AND execution_owner IS NULL
                    AND execution_lease_expires_at_utc IS NULL)
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_command_receipts_recovery_ready
    ON nexis_v2.command_receipts(execution_lease_expires_at_utc, received_at_utc, command_id)
    WHERE terminal_status IS NULL AND canonical_payload IS NOT NULL;
