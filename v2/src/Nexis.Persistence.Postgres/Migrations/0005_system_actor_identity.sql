ALTER TABLE nexis_v2.command_receipts
    ADD COLUMN IF NOT EXISTS actor_system_key text NULL;

UPDATE nexis_v2.command_receipts
SET actor_system_key = 'nexis.system'
WHERE lane = 2
  AND actor_system_key IS NULL;

ALTER TABLE nexis_v2.command_receipts
    DROP CONSTRAINT IF EXISTS ck_command_actor_shape;

ALTER TABLE nexis_v2.command_receipts
    ADD CONSTRAINT ck_command_actor_shape CHECK (
        (lane IN (0, 3)
            AND actor_account_id IS NOT NULL
            AND actor_character_id IS NOT NULL
            AND actor_system_key IS NULL)
        OR
        (lane = 1
            AND actor_account_id IS NOT NULL
            AND actor_character_id IS NULL
            AND actor_system_key IS NULL)
        OR
        (lane = 2
            AND actor_account_id IS NULL
            AND actor_character_id IS NULL
            AND actor_system_key IS NOT NULL
            AND length(btrim(actor_system_key)) > 0
            AND length(actor_system_key) <= 128)
    );
