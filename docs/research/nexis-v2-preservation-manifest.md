# Nexis v2 Preservation Manifest

> **Status:** Preservation baseline for the `voidsmith-source-of-truth` rebuild branch.  
> **Captured:** 2026-08-24  
> **Live source server:** `old-nexis` / `/srv/nexis/source/NexisGame`  
> **Live source commit:** `88b5f8c5ea8fa3f967d1eb1ab8b22eec7f0cc6c6` (`main`, clean at preservation scan)  
> **Preserved copy root:** `/srv/voidsmith/nexis/legacy/` on `new-voidsmith`

## 1. Preservation rule

The old Nexis installation remains intact and live as a reference/rollback source. Nexis v2 is built separately on the new Voidsmith server.

Every current asset is classified as one of:

- **KEEP** — preserve semantics/data substantially as-is.
- **TRANSFORM** — preserve data/content/behavior, redesign its model or UX.
- **RETIRE** — remove from active progression, preserving history where appropriate.
- **ARCHIVE** — keep as evidence/reference, do not place in the active v2 runtime.

The migration may redesign storage, but it must not silently discard legitimate player-owned state or historical records.

---

## 2. Physical preservation completed

The following source material has already been copied and SHA-256 verified on `new-voidsmith`:

| Preserved area | New-server location | Disposition |
|---|---|---|
| Exact live source tree, including Git history | `/srv/voidsmith/nexis/legacy/source/current` | KEEP as read-only reference |
| Exact production frontend build | `/srv/voidsmith/nexis/legacy/frontend/current` | ARCHIVE / visual reference |
| PostgreSQL custom dump | `/srv/voidsmith/nexis/legacy/database/nexis-db-20260824.dump` | KEEP |
| PostgreSQL schema-only dump | `/srv/voidsmith/nexis/legacy/database/nexis-db-20260824-schema.sql` | KEEP |
| Database row-count reconciliation | `/srv/voidsmith/nexis/legacy/database/nexis-db-20260824-rowcounts.txt` | KEEP |
| Persistent uploads/profile images/waitlist/canary evidence | `/srv/voidsmith/nexis/legacy/persistent` | KEEP |
| World-map and Game Master reference material | `/srv/voidsmith/nexis/legacy/reference` | KEEP / ARCHIVE |
| Historical verification screenshots/reports | `/srv/voidsmith/nexis/legacy/artifacts` | ARCHIVE, selectively reuse |
| Historical deployment/incident/security backups | `/srv/voidsmith/nexis/legacy/backups/history` | ARCHIVE |
| Unique uncommitted files salvaged from old worktrees | `/srv/voidsmith/nexis/legacy/worktree-salvage` | ARCHIVE / review selectively |
| nginx/systemd/log operational evidence | `/srv/voidsmith/nexis/legacy/operations` | ARCHIVE / operational reference |
| Runtime secrets | `/srv/voidsmith/shared/secrets/nexis` | KEEP securely; never commit |

The old 7.3 GB worktree tree was **not** copied wholesale because most of it consisted of duplicate repositories and `node_modules`. Unique modified/untracked source files were salvaged separately.

---

## 3. Database preservation contract

### 3.1 Live row counts at preservation capture

| Table | Rows | v2 disposition |
|---|---:|---|
| `users` | 136 | **KEEP** identity/account authority |
| `player_state` | 136 | **TRANSFORM** into v2 player/domain storage |
| `auth_sessions` | 195 | ARCHIVE; session migration requires deliberate cutover policy |
| `public_id_allocators` | 3 | **KEEP** IDs/allocator continuity |
| `user_auth_identities` | 0 | KEEP schema/concept |
| `google_pending_registrations` | 0 | KEEP concept if Google auth retained |
| `password_reset_tokens` | 0 | RETIRE live rows; keep mechanism |
| `email_change_tokens` | 0 | RETIRE live rows; keep mechanism |
| `organizations` | 4 | **KEEP** identities and ownership |
| `organization_members` | 4 | **KEEP** |
| `organization_roles` | 12 | **KEEP / TRANSFORM** into v2 permission model |
| `organization_logs` | 70 | **KEEP** historical record |
| `organization_bases` | 2 | **KEEP / TRANSFORM** |
| `organization_base_events` | 251 | **KEEP** historical record |
| `organization_base_payments` | 6 | **KEEP** economic history |
| `organization_base_storage` | 0 | KEEP schema concept if retained |
| `organization_base_auctions` | 0 | TRANSFORM with organization/base redesign |
| `marketplace_listings` | 1 | **KEEP** ownership/history; migrate transactionally |
| `city_market_stock` | 0 | TRANSFORM into v2 world/economy state |
| `city_events` | 1 | TRANSFORM into v2 world event engine |
| `admin_action_logs` | 39 | **KEEP** audit history |
| `admin_one_shot_token_grants` | 2 | **KEEP** idempotent grant history |
| `one_shot_completions` | 1 | **KEEP** completion history |
| `player_entitlement_consumptions` | 0 | KEEP schema pattern / history if rows appear before cutover |
| `incident_backup_player_state_orgsnap_20260429_143837` | 1 | ARCHIVE as incident evidence, not active schema |

### 3.2 `player_state` columns

The current player-state row stores relational scalar columns plus multiple JSONB domains:

- `level`
- `gold`
- `stats`
- `working_stats`
- `battle_stats`
- `current_job`
- `player_snapshot`
- `jobs_state`
- `education_state`
- `arena_state`
- `timer_state`
- `guild_state`
- `consortium_state`
- `travel_state`
- `civic_state`
- `legacy_state`

The old schema itself records the important lesson that blindly overwritten JSONB cannot safely enforce uniqueness under concurrency. V2 must preserve flexible JSON only where appropriate and move money, transfers, uniqueness, multiplayer ownership, history and cross-player query surfaces into normalized transactional tables.

### 3.3 Observed JSONB state that must be accounted for

The live database contains the following meaningful keys. Absence for some players means the feature was introduced after account creation or was never used, not permission to silently drop it.

**`stats`**
- health/maxHealth
- energy/maxEnergy
- stamina/maxStamina
- comfort/maxComfort
- nerve/maxNerve
- chain/maxChain
- mana/maxMana (present on newer/qualified records)

**`working_stats`**
- manualLabor
- intelligence
- endurance

**`battle_stats`**
- strength
- defense
- speed
- dexterity

**`player_snapshot`** includes current or historical state for:
- identity/display fields, rank, title, age label, days played
- currencies/gold
- inventory/equipment/loadouts/visual equipment
- item buffs/enhancements/maintenance/use history
- property
- city standing, city academy, city contracts and city specials
- skills, crafting and combat XP
- duels and arena combat
- notifications/preferences/UI
- prestige/progression events/records
- rare manual eligibility
- shadow resource/state
- world discovery/world events/world loops/city diaries
- excursions and loot pity
- PvP profile/qualities/world-event profile
- Life Path historical state
- DMOS one-shots
- titles/equipped title
- portrait

**`education_state`**
- activeCourse
- activeUnlocks
- completedCourses
- passiveBonuses
- systemUnlocks
- legacy `completed`
- completedAtByCourse
- discoveries
- history

**`jobs_state`**
- categoryProgress
- subJobStats

**`timer_state`**
- resources

**`consortium_state`**
- membership
- progressByType
- activeEffectsByType

**`travel_state`**
- status/mode/currentCityId/originCityId/destinationCityId
- departureAt/arrivalAt/durationMs/routeType
- arrivalNotice/encounterNotice
- cargo/escort

**`civic_state`**
- activeTrackId
- trackProgress

**`legacy_state`**
- achievements/perks/points
- awards
- chronicleHistory/visibleEntries/hiddenTags
- donorTier/monthly/activeRun

**`arena_state`**
- selectedArenaId
- unlockedArenaIds
- logs
- totalEnergySpent

`guild_state` is effectively empty in current live records because authoritative organization membership has moved into relational organization tables. This is useful precedent for v2.

---

## 4. Account and identity data

### KEEP

- internal account IDs
- public numeric IDs
- usernames
- email identities
- first/last names
- account creation dates
- entity type
- privilege role
- account deactivation state/name-change timestamp where present
- password hashes for account continuity, handled only through secure migration paths
- linked auth identities if present by cutover

### TRANSFORM

- authorization into an explicit v2 account/role/privilege model
- Hennet Uthellien into one account with two server-generated profile projections:
  - public ordinary-player projection for everyone else
  - private true/Admin projection visible only to the authenticated primary owner session

### Non-negotiable security invariant

No v2 admin authority may derive from character name, title, lore identity, client state, Chronicle, or profile presentation.

---

## 5. Game content/data to preserve

All current authoritative data definitions have been copied. The following are considered useful seed content even where their mechanics will be redesigned.

### Server data definitions

- `adventureData.js` — KEEP/TRANSFORM adventure categories and reward/content concepts
- `chronicleData.js` — TRANSFORM into universal Chronicle
- `cityData.js` — KEEP city identity data
- `cityEconomyData.js` — KEEP/TRANSFORM city market identity and pricing/demand concepts
- `cityEventData.js` — TRANSFORM into branching world events
- `cityLoopData.js` — KEEP useful city gameplay content; normalize where needed
- `civicJobsData.js` — TRANSFORM profession content
- `combatData.js` — KEEP encounter/NPC seed data; combat math may change
- `consortiumLogistics.js` — KEEP route/logistics concepts
- `consortiumTypes.js` — KEEP/TRANSFORM organization profession identities
- `educationData.js` — KEEP course names/lore/prerequisite knowledge where valid; TRANSFORM structure
- `excursionData.js` — **KEEP strongly** as archaeology/discovery seed content
- `itemData.js` — **KEEP strongly** item identities, rarity, equipment slots, sets, materials
- `legacyAchievementsData.js` — TRANSFORM achievements/Legacy/Feats split
- `lifePathsData.js` — RETIRE active system; ARCHIVE as historical Feats-of-Strength source
- `liveWorldData.js` — KEEP/TRANSFORM city rhythms, threats, hidden sites, discovery pools
- `lootData.js` — KEEP loot families/pity concepts where balanced
- `nexisOneShotData.js` — KEEP/TRANSFORM DMOS one-shot content
- `organizationBaseData.js` — KEEP/TRANSFORM base/facility ideas
- `organizationOneShotData.js` — KEEP/TRANSFORM Guild/Consortium mission identities
- `pvpData.js` — KEEP fairness/eligibility/notoriety concepts; TRANSFORM bounty/capture
- `recipeData.js` — **KEEP strongly** recipes/prerequisites/discovery fragments
- `skillData.js` — TRANSFORM into practical mastery disciplines/techniques
- `titlesData.js` — KEEP earned-title content; transform title power/ownership model
- `transportData.js` — KEEP vehicles/routes/cargo concepts
- `travelData.js` — KEEP travel topology/timing concepts
- `worldProgressionData.js` — KEEP qualities/diaries/event concepts, consolidate into world-state/event engines

### Frontend content definitions

- `academyData.ts` — KEEP/TRANSFORM institutional presentation
- `cielData.ts`, `cielPageCopy.ts`, `cielTutorialData.ts` — KEEP useful voice/content only where consistent with new CIEL canon
- `cityData.ts`, `cityDistricts.ts`, `cityHubData.ts`, `cityBoardData.ts` — KEEP world presentation content
- `codexData.ts` — KEEP seed entries; TRANSFORM into Knowledge Graph
- `educationData.ts` — KEEP seed course content, not duplicated authority
- `excursionMapData.ts` — KEEP
- `hellenicRegionalPack.ts` — ARCHIVE/KEEP pending world-scope canon review
- `itemsData.ts` — KEEP only as frontend seed/reference; server becomes authority
- `jobsData.ts`, `civicJobsData.ts` — TRANSFORM
- `propertyData.ts` — KEEP/TRANSFORM functional housing
- `spiritData.ts` — preserve names/art/lore selectively; old 3/5/10% mechanics are RETIRED by approved Spirit design
- `wikiData.ts` — KEEP useful explanatory/lore content, regenerate from canonical systems where possible
- `worldAtlasPositions.ts`, `worldMapData.ts` — KEEP world topology/assets; resolve old naming debris

---

## 6. Persistent files and assets

### KEEP

- profile images linked to legitimate player records
- user uploads linked to game records
- current city/academy/world-map/register art worth retaining
- Spirit art as visual seed/reference
- item icon SVGs
- email wordmark/divider assets
- original and expanded world maps
- Nexis Game Master Plan PDF/reference material

### ARCHIVE

- old build hashes/bundles
- historical screenshots proving UI/regression state
- canary reports and incident evidence
- pre-deploy snapshots and rollback trees
- stale standalone HTML/CSS/JS prototypes after useful design/content is extracted
- compiled `dist` output once source fidelity is verified
- old `node_modules`

---

## 7. Proven engineering behavior to preserve

The implementation files themselves may be replaced, but these lessons are valuable:

- server-authoritative rewards and mutations
- account-bound privilege checks
- public/internal ID separation
- unique DB constraints for one-time grants/completions
- idempotency keys for retry-safe admin grants
- row locking/transactional purchase logic
- server-computed organization permissions
- soft deactivation instead of destructive user deletion
- audit records for privileged actions
- explicit owner/member role constraints
- separation of shared organization state from player-owned JSONB
- conditional atomic global counters such as city stock/event activation

---

## 8. Runtime/config preservation

Operational references are preserved, but v2 must not blindly reuse them:

- current `nexis-waitlist.service`
- current nginx Nexis site
- backend environment **structure**
- current port convention (`3001` on old live)
- upload path convention
- PostgreSQL local-service assumptions

Actual secrets stay outside Git in `/srv/voidsmith/shared/secrets/nexis` and should be reissued/rotated where appropriate during v2 activation rather than copied into source.

---

## 9. Migration reconciliation requirements

Before any cutover, a rehearsal report must reconcile at minimum:

1. user count and identity mapping;
2. every internal/public ID;
3. account privilege/deactivation state;
4. all currency balances;
5. inventory/equipment ownership and quantities;
6. completed/active Education and course timestamps;
7. skills/mastery conversion decisions;
8. titles/achievements/Chronicle/Feats history;
9. properties and important item-instance ownership;
10. city/travel state where still meaningful at cutover;
11. Guild/Consortium identities, founders, members, roles and treasury;
12. organization base ownership/payments/events;
13. marketplace ownership/listing status;
14. one-shot completion/grant ledgers;
15. admin audit history;
16. profile image/upload references;
17. anomalies that could not be mapped.

No unmapped row/value may be silently discarded. Anomalies must be named and reviewed.

---

## 10. Immediate v2 working rule

The active new-server development workspace is:

`/srv/voidsmith/nexis/worktrees/voidsmith-source-of-truth`

It tracks the GitHub branch:

`voidsmith-source-of-truth`

The preserved `/srv/voidsmith/nexis/legacy` tree is a reference/migration source, **not** the place to implement v2.