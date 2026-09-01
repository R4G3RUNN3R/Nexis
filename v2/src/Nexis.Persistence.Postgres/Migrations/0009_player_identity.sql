-- Identity owner private schema for the account-scoped stable public player identity.
--
-- One normal account is one player is one playable character. That is enforced structurally, not
-- by convention: account_id is the primary key, so an account cannot hold a second character, and
-- character_id is unique, so a character cannot be controlled by a second account.
--
-- public_player_ordinal is allocated from a sequence rather than from max()+1, so concurrent
-- provisioning cannot mint the same ordinal twice. The reserved low range is never allocated.
CREATE TABLE IF NOT EXISTS nexis_v2.player_identities (
    account_id uuid PRIMARY KEY,
    character_id uuid NOT NULL UNIQUE,
    public_player_ordinal bigint NOT NULL UNIQUE
        CHECK (public_player_ordinal >= 1000020),
    display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 20)
);

CREATE SEQUENCE IF NOT EXISTS nexis_v2.public_player_ordinal_seq
    AS bigint
    START WITH 1000020
    MINVALUE 1000020
    NO MAXVALUE
    NO CYCLE
    OWNED BY nexis_v2.player_identities.public_player_ordinal;

-- A public player identity is immutable for the life of the player. Renaming is the only permitted
-- mutation; reassigning an account, a character or an assigned public ordinal is refused by the
-- database itself, so a bypassed or buggy caller cannot rewrite an identity that the world has
-- already seen.
CREATE OR REPLACE FUNCTION nexis_v2.refuse_player_identity_reassignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
        RAISE EXCEPTION 'Player identity account_id is immutable.';
    END IF;

    IF NEW.character_id IS DISTINCT FROM OLD.character_id THEN
        RAISE EXCEPTION 'Player identity character_id is immutable.';
    END IF;

    IF NEW.public_player_ordinal IS DISTINCT FROM OLD.public_player_ordinal THEN
        RAISE EXCEPTION 'Public player identifiers are immutable for the life of the player identity.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refuse_player_identity_reassignment ON nexis_v2.player_identities;

CREATE TRIGGER refuse_player_identity_reassignment
    BEFORE UPDATE ON nexis_v2.player_identities
    FOR EACH ROW
    EXECUTE FUNCTION nexis_v2.refuse_player_identity_reassignment();
