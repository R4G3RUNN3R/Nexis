const DEFAULT_STATS = {
  energy: 100,
  maxEnergy: 100,
  health: 100,
  maxHealth: 100,
  stamina: 10,
  maxStamina: 10,
  comfort: 100,
  maxComfort: 100,
  nerve: 16,
  maxNerve: 84,
  chain: 0,
  maxChain: 10,
};

const DEFAULT_WORKING_STATS = {
  manualLabor: 10,
  intelligence: 10,
  endurance: 10,
};

const DEFAULT_BATTLE_STATS = {
  strength: 10,
  defense: 10,
  speed: 10,
  dexterity: 10,
};

const MAX_PLAYER_LEVEL = 100;

function getExperienceToNextLevel(level) {
  return Math.max(50, level * 50);
}

function normalizeExperience(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function getLevelFromExperience(experience) {
  let level = 1;
  let remainingXp = normalizeExperience(experience);
  let xpToNextLevel = getExperienceToNextLevel(level);

  while (remainingXp >= xpToNextLevel && level < MAX_PLAYER_LEVEL) {
    remainingXp -= xpToNextLevel;
    level += 1;
    xpToNextLevel = getExperienceToNextLevel(level);
  }

  return level;
}

function normalizeLevel(value, experience) {
  const derived = getLevelFromExperience(experience);
  if (derived > 1 || experience > 0) return derived;
  return 1;
}

function normalizeStatRecord(stats, defaults) {
  const merged = { ...defaults, ...(stats ?? {}) };
  const allBaselineMissing = Object.values(merged).every((value) => Number(value ?? 0) <= 0);
  return allBaselineMissing ? { ...defaults } : merged;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mapPlayerStateRow(row) {
  if (!row) return null;

  const playerSnapshot = row.player_snapshot ?? {};
  const experience = normalizeExperience(playerSnapshot.experience);

  return {
    level: normalizeLevel(row.level, experience),
    gold: Number(row.gold ?? 0),
    stats: row.stats ?? DEFAULT_STATS,
    workingStats: normalizeStatRecord(row.working_stats, DEFAULT_WORKING_STATS),
    battleStats: normalizeStatRecord(row.battle_stats, DEFAULT_BATTLE_STATS),
    currentJob: row.current_job ?? { current: null },
    runtimeState: {
      player: { ...playerSnapshot, experience, level: normalizeLevel(row.level, experience) },
      jobs: row.jobs_state ?? {},
      education: row.education_state ?? {},
      arena: row.arena_state ?? {},
      timers: row.timer_state ?? {},
      guild: row.guild_state ?? {},
      consortium: row.consortium_state ?? {},
      travel: row.travel_state ?? {},
      civicEmployment: row.civic_state ?? {},
      legacy: row.legacy_state ?? {},
    },
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function createDefaultPlayerState(client, userInternalId) {
  const defaultPlayerSnapshot = {
    experience: 0,
    level: 1,
  };
  const emptyState = JSON.stringify({});
  await client.query(
    `
      INSERT INTO player_state (
        user_internal_id,
        level,
        gold,
        stats,
        working_stats,
        battle_stats,
        current_job,
        player_snapshot,
        jobs_state,
        education_state,
        arena_state,
        timer_state,
        guild_state,
        consortium_state,
        travel_state,
        civic_state,
        legacy_state
      )
      VALUES ($1, 1, 500, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb)
      ON CONFLICT (user_internal_id) DO NOTHING
    `,
    [
      userInternalId,
      JSON.stringify(DEFAULT_STATS),
      JSON.stringify(DEFAULT_WORKING_STATS),
      JSON.stringify(DEFAULT_BATTLE_STATS),
      JSON.stringify({ current: null }),
      JSON.stringify(defaultPlayerSnapshot),
      emptyState,
      emptyState,
      emptyState,
      emptyState,
      emptyState,
      emptyState,
      emptyState,
      emptyState,
      emptyState,
    ],
  );
}

export async function findPlayerStateByUserInternalId(client, userInternalId) {
  const result = await client.query(
    `
      SELECT
        level,
        gold,
        stats,
        working_stats,
        battle_stats,
        current_job,
        player_snapshot,
        jobs_state,
        education_state,
        arena_state,
        timer_state,
        guild_state,
        consortium_state,
        travel_state,
        civic_state,
        legacy_state,
        created_at,
        updated_at
      FROM player_state
      WHERE user_internal_id = $1
    `,
    [userInternalId],
  );

  return mapPlayerStateRow(result.rows[0]);
}

export async function upsertPlayerRuntimeState(client, userInternalId, runtimeState = {}) {
  const playerSnapshot = asRecord(runtimeState.player);
  const experience = normalizeExperience(playerSnapshot.experience);
  const normalizedLevel = normalizeLevel(asNumber(playerSnapshot.level, 1), experience);
  const stats = asRecord(playerSnapshot.stats);
  const workingStats = asRecord(playerSnapshot.workingStats);
  const battleStats = asRecord(playerSnapshot.battleStats);
  const current = asRecord(playerSnapshot.current);
  const normalizedPlayerSnapshot = {
    ...playerSnapshot,
    experience,
    level: normalizedLevel,
  };

  await client.query(
    `
      INSERT INTO player_state (
        user_internal_id,
        level,
        gold,
        stats,
        working_stats,
        battle_stats,
        current_job,
        player_snapshot,
        jobs_state,
        education_state,
        arena_state,
        timer_state,
        guild_state,
        consortium_state,
        travel_state,
        civic_state,
        legacy_state,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9::jsonb,
        $10::jsonb,
        $11::jsonb,
        $12::jsonb,
        $13::jsonb,
        $14::jsonb,
        $15::jsonb,
        $16::jsonb,
        $17::jsonb,
        NOW()
      )
      ON CONFLICT (user_internal_id) DO UPDATE SET
        level = EXCLUDED.level,
        gold = EXCLUDED.gold,
        stats = EXCLUDED.stats,
        working_stats = EXCLUDED.working_stats,
        battle_stats = EXCLUDED.battle_stats,
        current_job = EXCLUDED.current_job,
        player_snapshot = (EXCLUDED.player_snapshot - 'portrait')
          || CASE
            WHEN jsonb_typeof(EXCLUDED.player_snapshot->'portrait') = 'object'
              AND COALESCE(EXCLUDED.player_snapshot->'portrait'->>'imageKey', '') <> ''
              THEN jsonb_build_object('portrait', EXCLUDED.player_snapshot->'portrait')
            WHEN jsonb_typeof(player_state.player_snapshot->'portrait') = 'object'
              AND player_state.player_snapshot->'portrait' <> '{}'::jsonb
              THEN jsonb_build_object('portrait', player_state.player_snapshot->'portrait')
            WHEN jsonb_typeof(EXCLUDED.player_snapshot->'portrait') = 'object'
              AND EXCLUDED.player_snapshot->'portrait' <> '{}'::jsonb
              THEN jsonb_build_object('portrait', EXCLUDED.player_snapshot->'portrait')
            ELSE '{}'::jsonb
          END,
        jobs_state = EXCLUDED.jobs_state,
        education_state = EXCLUDED.education_state,
        arena_state = EXCLUDED.arena_state,
        timer_state = EXCLUDED.timer_state,
        guild_state = EXCLUDED.guild_state,
        consortium_state = EXCLUDED.consortium_state,
        travel_state = EXCLUDED.travel_state,
        civic_state = EXCLUDED.civic_state,
        legacy_state = EXCLUDED.legacy_state,
        updated_at = NOW()
    `,
    [
      userInternalId,
      normalizedLevel,
      Math.max(0, Math.floor(asNumber(playerSnapshot.gold, 500))),
      JSON.stringify(Object.keys(stats).length ? stats : DEFAULT_STATS),
      JSON.stringify(Object.keys(workingStats).length ? workingStats : DEFAULT_WORKING_STATS),
      JSON.stringify(Object.keys(battleStats).length ? battleStats : DEFAULT_BATTLE_STATS),
      JSON.stringify({ current: current.job ?? null }),
      JSON.stringify(normalizedPlayerSnapshot),
      JSON.stringify(asRecord(runtimeState.jobs)),
      JSON.stringify(asRecord(runtimeState.education)),
      JSON.stringify(asRecord(runtimeState.arena)),
      JSON.stringify(asRecord(runtimeState.timers)),
      JSON.stringify(asRecord(runtimeState.guild)),
      JSON.stringify(asRecord(runtimeState.consortium)),
      JSON.stringify(asRecord(runtimeState.travel)),
      JSON.stringify(asRecord(runtimeState.civicEmployment)),
      JSON.stringify(asRecord(runtimeState.legacy)),
    ],
  );

  return findPlayerStateByUserInternalId(client, userInternalId);
}
