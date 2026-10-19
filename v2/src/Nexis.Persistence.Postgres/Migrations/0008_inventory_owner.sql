CREATE TABLE IF NOT EXISTS nexis_v2.inventory_state (
    character_id uuid PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 0)
);

CREATE TABLE IF NOT EXISTS nexis_v2.inventory_items (
    character_id uuid NOT NULL REFERENCES nexis_v2.inventory_state(character_id) ON DELETE CASCADE,
    item_instance_id uuid NOT NULL,
    definition_contract_name text NOT NULL CHECK (length(btrim(definition_contract_name)) > 0),
    definition_schema_version integer NOT NULL CHECK (definition_schema_version > 0),
    definition_id text NOT NULL CHECK (length(btrim(definition_id)) > 0),
    PRIMARY KEY (character_id, item_instance_id),
    UNIQUE (item_instance_id)
);

-- M-reserve: at most one authoritative reservation may exist for an item instance at a time.
-- The UNIQUE constraint is the structural double-spend guard; it does not rely on C# checks.
-- restriction_declaring_owner names the authority that declared the item non-removable through
-- the ordinary release path. It is the integration seam for a future approved curse/effect owner;
-- no curse, effect, questline or purification state is modelled here.
CREATE TABLE IF NOT EXISTS nexis_v2.inventory_item_reservations (
    character_id uuid NOT NULL,
    item_instance_id uuid NOT NULL,
    holding_owner text NOT NULL CHECK (length(btrim(holding_owner)) > 0),
    restriction_declaring_owner text NULL CHECK (
        restriction_declaring_owner IS NULL
        OR length(btrim(restriction_declaring_owner)) > 0
    ),
    PRIMARY KEY (character_id, item_instance_id),
    UNIQUE (item_instance_id),
    FOREIGN KEY (character_id, item_instance_id)
        REFERENCES nexis_v2.inventory_items(character_id, item_instance_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_inventory_items_character
    ON nexis_v2.inventory_items(character_id);
