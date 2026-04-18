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

const DEFAULT_PROPERTY = {
  current: "shack",
  comfortProvided: 100,
  installedUpgrades: [],
};

const DEFAULT_CONDITION = {
  type: "normal",
  until: null,
  reason: null,
};

const DEFAULT_CURRENCIES = {
  copper: 0,
  silver: 0,
  gold: 500,
  platinum: 0,
};

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeInventory(value) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([itemId, qty]) => [itemId, asWholeNumber(qty, 0)])
      .filter(([, qty]) => qty > 0),
  );
}

function normalizeEnhancements(value) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([itemId, enhancements]) => [
        itemId,
        Array.isArray(enhancements)
          ? Array.from(new Set(enhancements.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())))
          : [],
      ])
      .filter(([, enhancements]) => enhancements.length > 0),
  );
}

function normalizeCurrencies(value, fallbackGold = 500) {
  const record = asRecord(value);
  return {
    copper: asWholeNumber(record.copper, DEFAULT_CURRENCIES.copper),
    silver: asWholeNumber(record.silver, DEFAULT_CURRENCIES.silver),
    gold: asWholeNumber(record.gold, fallbackGold),
    platinum: asWholeNumber(record.platinum, DEFAULT_CURRENCIES.platinum),
  };
}

function normalizeCurrentEducation(value) {
  const record = asRecord(value);
  if (!record.id || !record.name) return null;
  return {
    id: String(record.id),
    name: String(record.name),
    startedAt: asWholeNumber(record.startedAt, Date.now()),
    durationMs: asWholeNumber(record.durationMs, 0),
  };
}

function normalizeCurrent(value, currentJob) {
  const record = asRecord(value);
  return {
    education: normalizeCurrentEducation(record.education),
    job: typeof currentJob === "string" && currentJob ? currentJob : null,
    travel: typeof record.travel === "string" && record.travel ? record.travel : null,
  };
}

function normalizeProperty(value) {
  const record = asRecord(value);
  const installedUpgrades = Array.isArray(record.installedUpgrades)
    ? record.installedUpgrades.filter((entry) => typeof entry === "string" && entry)
    : [];

  return {
    current: typeof record.current === "string" && record.current ? record.current : DEFAULT_PROPERTY.current,
    comfortProvided: asWholeNumber(record.comfortProvided, DEFAULT_PROPERTY.comfortProvided),
    installedUpgrades,
  };
}

function normalizeCondition(value) {
  const record = asRecord(value);
  const type = typeof record.type === "string" ? record.type : DEFAULT_CONDITION.type;
  if (type !== "hospitalized" && type !== "jailed") {
    return { ...DEFAULT_CONDITION };
  }

  return {
    type,
    until: record.until == null ? null : asWholeNumber(record.until, Date.now()),
    reason: typeof record.reason === "string" && record.reason ? record.reason : null,
  };
}

function resolveCurrentJob(currentJob) {
  if (typeof currentJob === "string") return currentJob;
  const record = asRecord(currentJob);
  return typeof record.current === "string" && record.current ? record.current : null;
}

export function buildMutableRuntimeState(user, playerState) {
  const runtimeState = asRecord(playerState?.runtimeState);
  const playerSnapshot = asRecord(runtimeState.player);
  const rowGold = asWholeNumber(playerState?.gold, 500);
  const gold = asWholeNumber(playerSnapshot.gold, rowGold);
  const currencies = normalizeCurrencies(playerSnapshot.currencies, gold);
  const currentJob = resolveCurrentJob(playerState?.currentJob);

  return {
    ...runtimeState,
    player: {
      ...playerSnapshot,
      internalId: user.internalId,
      publicId: user.publicId,
      name: typeof playerSnapshot.name === "string" && playerSnapshot.name ? playerSnapshot.name : user.firstName,
      lastName: typeof playerSnapshot.lastName === "string" && playerSnapshot.lastName ? playerSnapshot.lastName : user.lastName,
      title: typeof playerSnapshot.title === "string" ? playerSnapshot.title : "",
      experience: asWholeNumber(playerSnapshot.experience, 0),
      level: asWholeNumber(playerState?.level, 1),
      rank: typeof playerSnapshot.rank === "string" ? playerSnapshot.rank : "0",
      daysPlayed: asWholeNumber(playerSnapshot.daysPlayed, 0),
      gold: currencies.gold,
      currencies,
      isRegistered: true,
      inventory: normalizeInventory(playerSnapshot.inventory),
      itemEnhancements: normalizeEnhancements(playerSnapshot.itemEnhancements),
      stats: {
        ...DEFAULT_STATS,
        ...asRecord(playerSnapshot.stats),
        ...asRecord(playerState?.stats),
      },
      workingStats: {
        ...DEFAULT_WORKING_STATS,
        ...asRecord(playerSnapshot.workingStats),
        ...asRecord(playerState?.workingStats),
      },
      battleStats: {
        ...DEFAULT_BATTLE_STATS,
        ...asRecord(playerSnapshot.battleStats),
        ...asRecord(playerState?.battleStats),
      },
      property: normalizeProperty(playerSnapshot.property),
      current: normalizeCurrent(playerSnapshot.current, currentJob),
      condition: normalizeCondition(playerSnapshot.condition),
    },
  };
}

export function buildAdminPlayerPayload(user, playerState) {
  const runtimeState = buildMutableRuntimeState(user, playerState);
  return {
    user: {
      internalId: user.internalId,
      publicId: user.publicId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
      entityType: user.entityType,
      privilegeRole: user.privilegeRole,
    },
    player: {
      level: playerState.level,
      experience: runtimeState.player.experience,
      gold: playerState.gold,
      currencies: runtimeState.player.currencies,
      stats: runtimeState.player.stats,
      workingStats: runtimeState.player.workingStats,
      battleStats: runtimeState.player.battleStats,
      inventory: runtimeState.player.inventory,
      itemEnhancements: runtimeState.player.itemEnhancements,
      currentJob: runtimeState.player.current.job,
      condition: runtimeState.player.condition,
    },
  };
}
