CREATE TABLE IF NOT EXISTS public_id_allocators (
  entity_type TEXT PRIMARY KEY,
  next_numeric_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  internal_id TEXT PRIMARY KEY,
  public_id BIGINT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'player',
  privilege_role TEXT NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'player';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privilege_role TEXT NOT NULL DEFAULT 'player';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_entity_type_check;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_privilege_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_entity_type_check CHECK (entity_type IN ('player', 'npc', 'system', 'event'));

ALTER TABLE users
  ADD CONSTRAINT users_privilege_role_check CHECK (privilege_role IN ('player', 'staff', 'admin'));

UPDATE users SET entity_type = 'system', privilege_role = 'admin' WHERE public_id = 1000000;
UPDATE users SET entity_type = 'npc' WHERE public_id IN (1000001, 1000002, 1000003, 1000004, 1000005, 1000006);
UPDATE users SET entity_type = 'system' WHERE public_id IN (1000007, 1000010, 1000011, 1000012, 1000013);
UPDATE users SET entity_type = 'event' WHERE public_id IN (1000008, 1000009);
UPDATE users SET privilege_role = 'admin' WHERE public_id IN (1000010, 1000011, 1000012, 1000013);

CREATE TABLE IF NOT EXISTS player_state (
  user_internal_id TEXT PRIMARY KEY REFERENCES users(internal_id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 500,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  working_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  battle_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_job JSONB NOT NULL DEFAULT '{}'::jsonb,
  player_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  jobs_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  education_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  arena_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  timer_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  guild_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  consortium_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS player_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS jobs_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS education_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS arena_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS timer_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS guild_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS consortium_state JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_internal_id
  ON auth_sessions (user_internal_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON auth_sessions (expires_at);


CREATE TABLE IF NOT EXISTS admin_action_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  actor_public_id BIGINT NOT NULL,
  target_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  target_public_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor ON admin_action_logs (actor_internal_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target ON admin_action_logs (target_internal_id);

CREATE TABLE IF NOT EXISTS organizations (
  internal_id TEXT PRIMARY KEY,
  public_id BIGINT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('guild', 'consortium')),
  name TEXT NOT NULL,
  tag TEXT NOT NULL,
  founder_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  founder_public_id BIGINT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status_text TEXT NOT NULL DEFAULT '',
  consortium_type_key TEXT,
  consortium_type_name TEXT,
  passive_bonus_summary TEXT NOT NULL DEFAULT '',
  creation_cost INTEGER NOT NULL DEFAULT 0,
  treasury JSONB NOT NULL DEFAULT '{"copper":0,"silver":0,"gold":0,"platinum":0}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_type_tag ON organizations (type, LOWER(tag));
CREATE INDEX IF NOT EXISTS idx_organizations_founder ON organizations (founder_internal_id);

CREATE TABLE IF NOT EXISTS organization_roles (
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_internal_id, role_key)
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  user_public_id BIGINT NOT NULL,
  display_name TEXT NOT NULL,
  role_key TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_internal_id, user_internal_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members (user_internal_id);

CREATE TABLE IF NOT EXISTS organization_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  actor_internal_id TEXT REFERENCES users(internal_id) ON DELETE SET NULL,
  actor_public_id BIGINT,
  action_type TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_logs_org ON organization_logs (organization_internal_id);

ALTER TABLE organizations
  ALTER COLUMN tag DROP NOT NULL;

DROP INDEX IF EXISTS idx_organizations_type_tag;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_type_tag
  ON organizations (type, LOWER(tag))
  WHERE tag IS NOT NULL;
