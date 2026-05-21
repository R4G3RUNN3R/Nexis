import { getItemSummary } from "../data/itemData.js";
import { getPlayerRecords } from "../services/playerRecordsService.js";
import { getRareManualEligibility } from "../services/rareManualService.js";
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

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getMaxLifeForLevel(level) {
  return 100 + (Math.max(1, Math.floor(asNumber(level, 1))) - 1) * 50;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveCreatedAt(user, player) {
  const fromUser = asNumber(user?.createdAt, 0);
  const fromPlayer = asNumber(player?.createdAt, 0);
  const createdAt = fromUser > 0 ? fromUser : fromPlayer;
  return createdAt > 0 ? Math.floor(createdAt) : Date.now();
}

function calculateDaysPlayed(createdAt, now = Date.now()) {
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

function formatAgeLabel(createdAt) {
  const daysPlayed = calculateDaysPlayed(createdAt);
  if (daysPlayed <= 0) return "Today";
  if (daysPlayed === 1) return "1 day";
  return `${daysPlayed} days`;
}

function normalizeCondition(value) {
  const record = asRecord(value);
  const type = typeof record.type === "string" ? record.type : "normal";
  if (type === "hospitalized" || type === "jailed") {
    return {
      type,
      until: typeof record.until === "number" ? record.until : null,
      reason: typeof record.reason === "string" ? record.reason : null,
    };
  }
  return { type: "normal", until: null, reason: null };
}

function normalizeTravelState(value) {
  const record = asRecord(value);
  const status = record.status === "in_transit" ? "in_transit" : "idle";
  return {
    status,
    originCityId: typeof record.originCityId === "string" ? record.originCityId : "nexis",
    destinationCityId: typeof record.destinationCityId === "string" ? record.destinationCityId : null,
    routeType: typeof record.routeType === "string" ? record.routeType : "road",
    mode: typeof record.mode === "string" ? record.mode : "caravan",
    departureAt: typeof record.departureAt === "number" ? record.departureAt : null,
    arrivalAt: typeof record.arrivalAt === "number" ? record.arrivalAt : null,
    durationMs: typeof record.durationMs === "number" ? record.durationMs : null,
    currentCityId: typeof record.currentCityId === "string" ? record.currentCityId : "nexis",
    arrivalNotice:
      record.arrivalNotice && typeof record.arrivalNotice === "object"
        ? {
            destinationCityId:
              typeof record.arrivalNotice.destinationCityId === "string"
                ? record.arrivalNotice.destinationCityId
                : null,
            destinationName:
              typeof record.arrivalNotice.destinationName === "string"
                ? record.arrivalNotice.destinationName
                : null,
            arrivedAt:
              typeof record.arrivalNotice.arrivedAt === "number"
                ? record.arrivalNotice.arrivedAt
                : null,
          }
        : null,
    encounterNotice:
      record.encounterNotice && typeof record.encounterNotice === "object"
        ? record.encounterNotice
        : null,
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim()),
    ),
  );
}

function normalizeItemEnhancements(value) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([itemId, enhancements]) => [itemId, normalizeStringArray(enhancements)])
      .filter(([, enhancements]) => enhancements.length > 0),
  );
}

export function buildMutableRuntimeState(user, playerState) {
  const runtime = asRecord(playerState?.runtimeState);
  const player = asRecord(runtime.player);
  const current = asRecord(player.current);
  const travel = normalizeTravelState(runtime.travel ?? current.travel);
  const gold = Math.max(0, Math.floor(asNumber(player.gold, playerState?.gold ?? 500)));
  const currencies = {
    copper: Math.max(0, Math.floor(asNumber(player.currencies?.copper, 0))),
    silver: Math.max(0, Math.floor(asNumber(player.currencies?.silver, 0))),
    gold,
    platinum: Math.max(0, Math.floor(asNumber(player.currencies?.platinum, 0))),
  };
  const createdAt = resolveCreatedAt(user, player);
  const daysPlayed = calculateDaysPlayed(createdAt);

  return {
    player: {
      internalId: user.internalId,
      publicId: user.publicId,
      name: typeof player.name === "string" && player.name ? player.name : user.firstName,
      lastName:
        typeof player.lastName === "string" && player.lastName ? player.lastName : user.lastName,
      title: typeof player.title === "string" ? player.title : "",
      rank: typeof player.rank === "string" ? player.rank : null,
      ageLabel: formatAgeLabel(createdAt),
      createdAt,
      daysPlayed,
      experience: Math.max(0, Math.floor(asNumber(player.experience, 0))),
      level: Math.max(1, Math.floor(asNumber(player.level, playerState?.level ?? 1))),
      gold,
      currencies,
      isRegistered: true,
      inventory: asRecord(player.inventory),
      equipment: asRecord(player.equipment),
      visualEquipment: asRecord(player.visualEquipment),
      equipmentMaintenance: asRecord(player.equipmentMaintenance),
      equipmentLoadouts: asRecord(player.equipmentLoadouts),
      crafting: asRecord(player.crafting),
      itemBuffs: asRecord(player.itemBuffs),
      itemEnhancements: normalizeItemEnhancements(player.itemEnhancements),
      property: {
        current:
          typeof asRecord(player.property).current === "string"
            ? asRecord(player.property).current
            : "shack",
        comfortProvided: asNumber(asRecord(player.property).comfortProvided, 100),
        installedUpgrades: Array.isArray(asRecord(player.property).installedUpgrades)
          ? asRecord(player.property).installedUpgrades.filter((entry) => typeof entry === "string")
          : [],
      },
      stats: (() => {
        const merged = {
          ...DEFAULT_STATS,
          ...asRecord(playerState?.stats),
          ...asRecord(player.stats),
        };
        const expectedMaxHealth = getMaxLifeForLevel(Math.max(1, Math.floor(asNumber(player.level, playerState?.level ?? 1))));
        merged.maxHealth = Math.max(expectedMaxHealth, Math.floor(asNumber(merged.maxHealth, expectedMaxHealth)));
        merged.health = Math.max(1, Math.min(merged.maxHealth, Math.floor(asNumber(merged.health, merged.maxHealth))));
        return merged;
      })(),
      workingStats: {
        ...DEFAULT_WORKING_STATS,
        ...asRecord(playerState?.workingStats),
        ...asRecord(player.workingStats),
      },
      battleStats: {
        ...DEFAULT_BATTLE_STATS,
        ...asRecord(playerState?.battleStats),
        ...asRecord(player.battleStats),
      },
      current: {
        education: current.education ?? null,
        job:
          typeof current.job === "string"
            ? current.job
            : typeof asRecord(playerState?.currentJob).current === "string"
              ? asRecord(playerState.currentJob).current
              : null,
        travel,
        currentCityId:
          typeof current.currentCityId === "string"
            ? current.currentCityId
            : travel.currentCityId,
      },
      condition: normalizeCondition(player.condition),
      portrait: asRecord(player.portrait),
      bio: asRecord(player.bio),
      counters: asRecord(player.counters),
      cityContracts: asRecord(player.cityContracts),
      cityAcademy: asRecord(player.cityAcademy),
      cityStanding: asRecord(player.cityStanding),
      citySpecials: asRecord(player.citySpecials),
      skills: asRecord(player.skills),
      arenaCombat: asRecord(player.arenaCombat),
      duels: asRecord(player.duels),
      worldLoops: asRecord(player.worldLoops),
      notifications: asRecord(player.notifications),
      worldDiscovery: asRecord(player.worldDiscovery),
      worldEvents: asRecord(player.worldEvents),
      prestige: asRecord(player.prestige),
      shadow: asRecord(player.shadow),
      progressionEvents: asRecord(player.progressionEvents),
      records: asRecord(player.records),
      rareManualEligibility: asRecord(player.rareManualEligibility),
    },
    jobs: asRecord(runtime.jobs),
    education: asRecord(runtime.education),
    arena: asRecord(runtime.arena),
    timers: asRecord(runtime.timers),
    guild: asRecord(runtime.guild),
    consortium: asRecord(runtime.consortium),
    travel,
    civicEmployment: asRecord(runtime.civicEmployment),
    legacy: asRecord(runtime.legacy),
  };
}

function summarizeInventory(inventory) {
  return Object.entries(asRecord(inventory))
    .map(([itemId, quantity]) => ({
      itemId,
      quantity: Math.max(0, Math.floor(asNumber(quantity, 0))),
      item: getItemSummary(itemId),
    }))
    .filter((entry) => entry.quantity > 0)
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function summarizeEquipment(equipment) {
  return Object.entries(asRecord(equipment)).map(([slot, itemId]) => ({
    slot,
    itemId: typeof itemId === "string" ? itemId : null,
    item: typeof itemId === "string" ? getItemSummary(itemId) : null,
  }));
}

function summarizeLoadouts(loadouts) {
  return Object.entries(asRecord(loadouts)).map(([slot, value]) => ({ slot, ...(asRecord(value)) }));
}

function summarizeContracts(cityContracts) {
  const records = asRecord(asRecord(cityContracts).records);
  return Object.entries(records).map(([contractId, value]) => ({ contractId, ...asRecord(value) }));
}

function buildAdminDossier(user, runtimeState) {
  const player = runtimeState.player;
  const travel = runtimeState.travel ?? player.current?.travel ?? {};
  const activeEducation = asRecord(runtimeState.education).activeCourse ?? player.current?.education ?? null;
  const academyState = asRecord(player.cityAcademy);
  const activeAcademy = academyState.activeStudy ?? null;
  const skills = asRecord(player.skills);
  const guild = asRecord(runtimeState.guild);
  const consortium = asRecord(runtimeState.consortium);
  const records = getPlayerRecords(runtimeState, { limit: 160 });

  return {
    summary: {
      displayName: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
      publicId: user.publicId,
      entityType: user.entityType ?? "player",
      privilegeRole: user.privilegeRole ?? "player",
      location: player.current?.currentCityId ?? travel.currentCityId ?? "nexis",
      condition: player.condition,
      level: player.level,
      experience: player.experience,
      title: player.title,
      prestige: player.prestige,
      guild: guild.publicId ? guild : player.guild ?? null,
      consortium: consortium.publicId ? consortium : player.consortium ?? null,
      travel,
      activeContract: player.current?.job ?? null,
      activeEducation,
      activeAcademy,
    },
    inventory: summarizeInventory(player.inventory),
    equipment: summarizeEquipment(player.equipment),
    visualEquipment: summarizeEquipment(player.visualEquipment),
    equipmentMaintenance: player.equipmentMaintenance,
    loadouts: summarizeLoadouts(player.equipmentLoadouts),
    skills: {
      activeSlots: skills.activeSlots ?? [],
      passiveSlots: skills.passiveSlots ?? [],
      unlocked: skills.unlocked ?? [],
      learning: skills.learning ?? {},
      useCounts: skills.useCounts ?? {},
      evolutionChoices: skills.evolutionChoices ?? {},
      unlockHistory: skills.unlockHistory ?? [],
    },
    education: {
      activeCourse: activeEducation,
      completed: asRecord(runtimeState.education).completed ?? asRecord(runtimeState.education).completedCourses ?? {},
      history: asRecord(runtimeState.education).history ?? [],
      categoryProgress: asRecord(runtimeState.education).categoryProgress ?? {},
    },
    academy: {
      activeStudy: activeAcademy,
      completed: academyState.completed ?? {},
      history: academyState.history ?? [],
      paused: academyState.paused ?? null,
    },
    contractsTravelDiscovery: {
      activeContracts: summarizeContracts(player.cityContracts),
      travel,
      discoveries: player.worldDiscovery,
      hiddenSites: asRecord(player.worldDiscovery).hiddenSites ?? {},
    },
    organizations: {
      guild,
      consortium,
      cityStanding: player.cityStanding,
      civicEmployment: runtimeState.civicEmployment,
    },
    rareManualEligibility: getRareManualEligibility(runtimeState),
    records,
    auditNote: "Admin actions require reasons and are written to the server audit log.",
  };
}

export function buildAdminPlayerPayload(user, playerState) {
  const runtimeState = buildMutableRuntimeState(user, playerState);
  const player = runtimeState.player;
  const currentJob =
    typeof player.current?.job === "string" && player.current.job.trim()
      ? player.current.job
      : null;

  const dossier = buildAdminDossier(user, runtimeState);

  return {
    user: {
      internalId: user.internalId,
      publicId: user.publicId,
      username: user.username ?? null,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
      entityType: user.entityType ?? "player",
      privilegeRole: user.privilegeRole ?? "player",
    },
    player: {
      level: Number(player.level ?? 1),
      experience: Number(player.experience ?? 0),
      gold: Number(player.gold ?? 0),
      currencies: {
        copper: Number(player.currencies?.copper ?? 0),
        silver: Number(player.currencies?.silver ?? 0),
        gold: Number(player.currencies?.gold ?? player.gold ?? 0),
        platinum: Number(player.currencies?.platinum ?? 0),
      },
      stats: { ...player.stats },
      workingStats: { ...player.workingStats },
      battleStats: { ...player.battleStats },
      inventory: { ...player.inventory },
      itemEnhancements: { ...player.itemEnhancements },
      currentJob,
      condition: {
        type: player.condition?.type ?? "normal",
        until: typeof player.condition?.until === "number" ? player.condition.until : null,
        reason: typeof player.condition?.reason === "string" ? player.condition.reason : null,
      },
    },
    dossier,
  };
}
