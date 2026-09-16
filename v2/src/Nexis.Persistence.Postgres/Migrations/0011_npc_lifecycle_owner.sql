CREATE TABLE IF NOT EXISTS nexis_v2.npc_lifecycle_state (
    npc_id uuid PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 1),
    birth_instant_utc timestamptz NOT NULL,
    lifecycle_status smallint NOT NULL CHECK (lifecycle_status IN (0, 1))
);
