ALTER TABLE nexis_v2.outbox
    ADD COLUMN IF NOT EXISTS available_at_utc timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS lease_token uuid NULL,
    ADD COLUMN IF NOT EXISTS lease_owner text NULL,
    ADD COLUMN IF NOT EXISTS lease_expires_at_utc timestamptz NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_outbox_lease_shape'
          AND conrelid = 'nexis_v2.outbox'::regclass
    ) THEN
        ALTER TABLE nexis_v2.outbox
            ADD CONSTRAINT ck_outbox_lease_shape CHECK (
                (lease_token IS NULL AND lease_owner IS NULL AND lease_expires_at_utc IS NULL)
                OR
                (published_at_utc IS NULL
                    AND lease_token IS NOT NULL
                    AND lease_owner IS NOT NULL
                    AND length(btrim(lease_owner)) > 0
                    AND lease_expires_at_utc IS NOT NULL)
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_outbox_delivery_ready
    ON nexis_v2.outbox(available_at_utc, created_at_utc, event_id)
    WHERE published_at_utc IS NULL;

CREATE TABLE IF NOT EXISTS nexis_v2.event_consumer_checkpoints (
    consumer_name text NOT NULL CHECK (length(btrim(consumer_name)) > 0),
    event_id uuid NOT NULL REFERENCES nexis_v2.authoritative_events(event_id),
    processed_at_utc timestamptz NOT NULL,
    PRIMARY KEY (consumer_name, event_id)
);

CREATE INDEX IF NOT EXISTS ix_event_consumer_checkpoints_event
    ON nexis_v2.event_consumer_checkpoints(event_id);
