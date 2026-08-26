CREATE TABLE IF NOT EXISTS nexis_v2.equipment_state (
    character_id uuid PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 0)
);

CREATE TABLE IF NOT EXISTS nexis_v2.equipment_bindings (
    character_id uuid NOT NULL REFERENCES nexis_v2.equipment_state(character_id) ON DELETE CASCADE,
    item_instance_id uuid NOT NULL,
    placement_key text NOT NULL CHECK (
        length(btrim(placement_key)) > 0
        AND placement_key = lower(placement_key)
    ),
    PRIMARY KEY (character_id, item_instance_id)
);

CREATE TABLE IF NOT EXISTS nexis_v2.equipment_binding_slots (
    character_id uuid NOT NULL,
    item_instance_id uuid NOT NULL,
    slot_key text NOT NULL CHECK (
        length(btrim(slot_key)) > 0
        AND slot_key = lower(slot_key)
    ),
    PRIMARY KEY (character_id, slot_key),
    UNIQUE (character_id, item_instance_id, slot_key),
    FOREIGN KEY (character_id, item_instance_id)
        REFERENCES nexis_v2.equipment_bindings(character_id, item_instance_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_equipment_binding_slots_item
    ON nexis_v2.equipment_binding_slots(character_id, item_instance_id);
