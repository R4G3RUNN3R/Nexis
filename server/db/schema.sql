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
  -- Nullable: Google-only accounts (see user_auth_identities) have no
  -- password at all rather than a fake generated one. Every reader of this
  -- column was audited before this changed (server/services/authService.js
  -- registerUser/createMigratedPlayerAccount/loginUser/resetPassword and
  -- server/repositories/usersRepository.js) - loginUser explicitly rejects
  -- a null hash with GOOGLE_LOGIN_REQUIRED before ever reaching bcrypt.
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility migrations for existing live shards that predate the new
-- authority split. Keep them explicit so rerunning schema.sql is safe.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'player';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privilege_role TEXT NOT NULL DEFAULT 'player';

-- Existing live shards created this column as NOT NULL before Google-only
-- accounts existed. Safe to rerun: a no-op once already dropped.
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- One row per (provider, external account) a Nexis user has linked. Google
-- is the only provider today but the shape is provider-generic on purpose.
-- provider_subject is Google's immutable "sub" claim, never the email -
-- emails can change on Google's side, sub never does.
CREATE TABLE IF NOT EXISTS user_auth_identities (
  id BIGSERIAL PRIMARY KEY,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  provider_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  -- A given external identity can never be linked to more than one Nexis
  -- account (prevents one Google identity claiming two accounts).
  UNIQUE (provider, provider_subject),
  -- A given Nexis account can never acquire two rows for the same provider
  -- (prevents duplicate/competing Google links on one account).
  UNIQUE (user_internal_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_identities_user
  ON user_auth_identities(user_internal_id);

-- Short-lived holding record for a brand-new Google sign-up between the
-- initial verified-credential exchange and the player confirming their
-- Nexis character's first/last name. provider_subject/provider_email here
-- come only from a verified Google token (see googleAuthService.js) - never
-- re-suppliable by the client on the completion step.
CREATE TABLE IF NOT EXISTS google_pending_registrations (
  token_hash TEXT PRIMARY KEY,
  provider_subject TEXT NOT NULL,
  provider_email TEXT NOT NULL,
  provider_email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  suggested_first_name TEXT NOT NULL DEFAULT '',
  suggested_last_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS player_state (
  user_internal_id TEXT PRIMARY KEY REFERENCES users(internal_id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 500,
  -- Recovery-bar resource pools (energy/health/stamina/comfort, and now
  -- mana) are NOT individual columns — they are keys inside this `stats`
  -- JSONB blob, backfilled by DEFAULT_STATS in server/lib/runtimePlayerState.js
  -- so new resources never require a migration. Mana defaults to 0/0
  -- (locked) until the Silverbough Argent Bough Lyceum "primer" academy
  -- stage is completed server-side (see applyReward() in cityService.js),
  -- which permanently sets mana/maxMana to 50/50.
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

-- Ticket 5 hardening: role_key was previously unconstrained TEXT, relying
-- entirely on every write path using only server-computed values from the
-- fixed guild/consortium role set (verified true for every caller at audit
-- time). This makes that invariant DB-enforced too. Idempotent because
-- schema.sql re-runs on every startup - re-adding an existing constraint
-- would otherwise error.
DO $$
BEGIN
  ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_key_check
    CHECK (role_key IN ('guildmaster', 'officer', 'member', 'director', 'specialist', 'employee'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

-- Ticket A: periodic entitlement consumption ledger (e.g. "one eligible
-- personal one-shot completion per donor entitlement period"). A real row
-- with a unique constraint, not a JSONB flag inside player_state - a
-- duplicate consumption attempt is rejected by the database itself even
-- under genuine concurrent requests, since player_state's own JSONB
-- columns are blind-overwritten on every write (see Ticket A audit) and
-- cannot be trusted alone to enforce "at most once per period".
-- period_key is caller-computed and opaque here (e.g. "2026-07" for a
-- calendar-month period) - this table doesn't need to know what a period
-- means, only that (user, entitlement, period) can happen at most once.
CREATE TABLE IF NOT EXISTS player_entitlement_consumptions (
  id BIGSERIAL PRIMARY KEY,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_internal_id, entitlement_key, period_key),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_player_entitlement_consumptions_user
  ON player_entitlement_consumptions (user_internal_id, entitlement_key);

-- Ticket A: one-shot completion ledger, personal and organization/group.
-- Real rows with unique constraints instead of a JSONB array inside
-- player_state.legacy_state/organizations.metadata, so a concurrent or
-- retried completion request cannot grant a reward twice - the database
-- rejects the second attempt outright rather than relying on an
-- application-level check against a blindly-overwritten blob.
-- organization_internal_id is NULL for personal one-shots. Two partial
-- unique indexes (not one multi-column UNIQUE) because Postgres treats
-- NULL as distinct from NULL in a UNIQUE constraint - a plain
-- UNIQUE(user_internal_id, campaign_id, organization_internal_id) would
-- never actually block two personal completions of the same campaign,
-- since both rows would have organization_internal_id = NULL.
CREATE TABLE IF NOT EXISTS one_shot_completions (
  id BIGSERIAL PRIMARY KEY,
  user_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  organization_internal_id TEXT NULL REFERENCES organizations(internal_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  outcome_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (session_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_shot_completions_personal
  ON one_shot_completions (user_internal_id, campaign_id)
  WHERE organization_internal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_shot_completions_org
  ON one_shot_completions (organization_internal_id, campaign_id)
  WHERE organization_internal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_one_shot_completions_user
  ON one_shot_completions (user_internal_id, completed_at DESC);

-- Admin hotfix: idempotency ledger for staff-granted personal one-shot
-- tokens (tradeable and donor). idempotency_key is client-generated once
-- per confirmed grant attempt and resent on retry - a repeated submission
-- with the same key returns the original result instead of granting
-- again. operation_id is always server-generated, the permanent
-- identifier for the grant regardless of how the client tracked retries.
-- token_type is 'tradeable' | 'donor', matching the existing
-- dmosOneShots.tokens.sealed / .patronBound counters in player_state -
-- this table records grants, it does not hold a parallel balance.
CREATE TABLE IF NOT EXISTS admin_one_shot_token_grants (
  id BIGSERIAL PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  actor_public_id BIGINT NOT NULL,
  target_internal_id TEXT NOT NULL REFERENCES users(internal_id) ON DELETE CASCADE,
  target_public_id BIGINT NOT NULL,
  token_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  before_balance INTEGER NOT NULL,
  after_balance INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_one_shot_token_grants_target
  ON admin_one_shot_token_grants (target_internal_id, created_at DESC);
