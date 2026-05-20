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
  entity_type TEXT NOT NULL DEFAULT 'player',
  privilege_role TEXT NOT NULL DEFAULT 'player',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility migrations for existing live shards that predate the new
-- authority split. Keep them explicit so rerunning schema.sql is safe.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'player';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privilege_role TEXT NOT NULL DEFAULT 'player';

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
  travel_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  civic_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedicated runtime branches are now persisted separately instead of being
-- blurred together in one generic client-owned blob.
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

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS travel_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS civic_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS legacy_state JSONB NOT NULL DEFAULT '{}'::jsonb;

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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_internal_id
  ON password_reset_tokens (user_internal_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS organizations (
  internal_id TEXT PRIMARY KEY,
  public_id BIGINT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('guild', 'consortium')),
  name TEXT NOT NULL,
  tag TEXT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_type_tag
  ON organizations (type, LOWER(tag))
  WHERE tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_founder
  ON organizations (founder_internal_id);

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

CREATE INDEX IF NOT EXISTS idx_organization_members_user
  ON organization_members (user_internal_id);

CREATE TABLE IF NOT EXISTS organization_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  actor_internal_id TEXT REFERENCES users(internal_id) ON DELETE SET NULL,
  actor_public_id BIGINT,
  action_type TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_logs_org
  ON organization_logs (organization_internal_id);

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

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor_internal_id
  ON admin_action_logs (actor_internal_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_internal_id
  ON admin_action_logs (target_internal_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at
  ON admin_action_logs (created_at DESC);

-- Phase 3 safety spine: organization base lifecycle persistence.
CREATE TABLE IF NOT EXISTS organization_bases (
  id BIGSERIAL PRIMARY KEY,
  organization_internal_id TEXT NOT NULL UNIQUE REFERENCES organizations(internal_id) ON DELETE CASCADE,
  ownership_mode TEXT NOT NULL CHECK (ownership_mode IN ('building_purchase', 'plot_construction')),
  property_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confiscated', 'auction', 'retired')),
  monthly_upkeep_gold INTEGER NOT NULL DEFAULT 0 CHECK (monthly_upkeep_gold >= 0),
  period_due_gold INTEGER NOT NULL DEFAULT 0 CHECK (period_due_gold >= 0),
  period_paid_gold INTEGER NOT NULL DEFAULT 0 CHECK (period_paid_gold >= 0),
  period_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confiscated_at TIMESTAMPTZ NULL,
  buyback_until TIMESTAMPTZ NULL,
  debt_gold_at_confiscation INTEGER NULL CHECK (debt_gold_at_confiscation IS NULL OR debt_gold_at_confiscation >= 0),
  leader_internal_id TEXT NULL REFERENCES users(internal_id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_bases_status_next_review
  ON organization_bases (status, next_review_at);

CREATE INDEX IF NOT EXISTS idx_organization_bases_buyback_until
  ON organization_bases (buyback_until)
  WHERE buyback_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_base_storage (
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_internal_id, item_id)
);

CREATE TABLE IF NOT EXISTS organization_base_events (
  id BIGSERIAL PRIMARY KEY,
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  base_id BIGINT NULL REFERENCES organization_bases(id) ON DELETE SET NULL,
  actor_internal_id TEXT NULL REFERENCES users(internal_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_base_events_org_created
  ON organization_base_events (organization_internal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_base_auctions (
  id BIGSERIAL PRIMARY KEY,
  base_id BIGINT NOT NULL REFERENCES organization_bases(id) ON DELETE CASCADE,
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  opening_bid_gold INTEGER NOT NULL DEFAULT 0 CHECK (opening_bid_gold >= 0),
  current_bid_gold INTEGER NOT NULL DEFAULT 0 CHECK (current_bid_gold >= 0),
  current_bidder_internal_id TEXT NULL REFERENCES users(internal_id) ON DELETE SET NULL,
  debt_gold_at_confiscation INTEGER NOT NULL DEFAULT 0 CHECK (debt_gold_at_confiscation >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_base_auctions_status_close
  ON organization_base_auctions (status, closes_at);

CREATE TABLE IF NOT EXISTS organization_base_payments (
  id BIGSERIAL PRIMARY KEY,
  base_id BIGINT NOT NULL REFERENCES organization_bases(id) ON DELETE CASCADE,
  organization_internal_id TEXT NOT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual', 'vault_autopay', 'buyback', 'recovery_adjustment')),
  amount_gold INTEGER NOT NULL CHECK (amount_gold >= 0),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_base_payments_base_created
  ON organization_base_payments (base_id, created_at DESC);


CREATE TABLE IF NOT EXISTS marketplace_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  seller_public_id BIGINT NOT NULL,
  seller_name TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  city_id TEXT NOT NULL DEFAULT 'nexis',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  buyer_internal_id TEXT NULL REFERENCES users(internal_id) ON DELETE SET NULL,
  buyer_public_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  sold_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_active
  ON marketplace_listings (status, expires_at, city_id, unit_price);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller
  ON marketplace_listings (seller_internal_id, status, created_at DESC);
