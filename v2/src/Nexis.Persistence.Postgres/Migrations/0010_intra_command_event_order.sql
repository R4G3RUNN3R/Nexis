-- Durable recoverable intra-command event order.
--
-- Events committed by one command share one authoritative evaluation instant, so occurred_at_utc
-- cannot order them and neither can physical row order. Each event therefore carries an explicit
-- zero-based sequence assigned from Core's emission order.
--
-- The UNIQUE (command_id, intra_command_sequence) constraint is the structural guarantee that the
-- order exists and is total: one command cannot commit two events claiming the same position.
--
-- The column addition and its backfill are guarded so they happen exactly once. This migration file
-- is re-executed on every EnsureCreatedAsync, and re-deriving sequences for rows that already carry
-- authoritative values would overwrite real emission order with an invented ordering and collide
-- with the uniqueness constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'nexis_v2'
          AND table_name = 'authoritative_events'
          AND column_name = 'intra_command_sequence'
    ) THEN
        ALTER TABLE nexis_v2.authoritative_events
            ADD COLUMN intra_command_sequence integer NOT NULL DEFAULT 0
                CHECK (intra_command_sequence >= 0);

        -- Rows written before this column existed get a deterministic order rather than all
        -- collapsing onto position 0, which would violate the uniqueness constraint below for any
        -- multi-event command.
        WITH ordered AS (
            SELECT event_id,
                   row_number() OVER (
                       PARTITION BY command_id
                       ORDER BY occurred_at_utc, event_id
                   ) - 1 AS sequence
            FROM nexis_v2.authoritative_events
        )
        UPDATE nexis_v2.authoritative_events AS e
        SET intra_command_sequence = o.sequence
        FROM ordered AS o
        WHERE e.event_id = o.event_id;

        ALTER TABLE nexis_v2.authoritative_events
            ALTER COLUMN intra_command_sequence DROP DEFAULT;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'nexis_v2'
          AND table_name = 'outbox'
          AND column_name = 'intra_command_sequence'
    ) THEN
        ALTER TABLE nexis_v2.outbox
            ADD COLUMN intra_command_sequence integer NOT NULL DEFAULT 0
                CHECK (intra_command_sequence >= 0);

        UPDATE nexis_v2.outbox AS o
        SET intra_command_sequence = e.intra_command_sequence
        FROM nexis_v2.authoritative_events AS e
        WHERE o.event_id = e.event_id;

        ALTER TABLE nexis_v2.outbox
            ALTER COLUMN intra_command_sequence DROP DEFAULT;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_authoritative_events_command_sequence'
    ) THEN
        ALTER TABLE nexis_v2.authoritative_events
            ADD CONSTRAINT uq_authoritative_events_command_sequence
            UNIQUE (command_id, intra_command_sequence);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_authoritative_events_command_sequence
    ON nexis_v2.authoritative_events(command_id, intra_command_sequence);
