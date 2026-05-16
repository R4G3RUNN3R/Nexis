import { findOrganizationBaseByOrganizationInternalId } from "../repositories/organizationBaseRepository.js";

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const asNum = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const GUILD_BUILDING_EFFECTS = {
  guild_chapter_house: { questPowerPct: 2.0, dungeonPowerFlat: 4, renownDailyPct: 2.0 },
  guild_hall: { questPowerPct: 3.0, dungeonPowerFlat: 6, renownDailyPct: 3.0 },
  guild_great_hall: { questPowerPct: 4.0, dungeonPowerFlat: 8, renownDailyPct: 4.0 },
};

const CONSORTIUM_BUILDING_EFFECTS = {
  consortium_trade_office: { logisticsRewardPct: 3.0, launchCostReductionPct: 3.0, logisticsLossMitigationPct: 2.0, routeEfficiencyPct: 1.0 },
  consortium_exchange_house: { logisticsRewardPct: 4.0, launchCostReductionPct: 4.0, logisticsLossMitigationPct: 3.0, routeEfficiencyPct: 2.0 },
  consortium_mercantile_hall: { logisticsRewardPct: 5.0, launchCostReductionPct: 5.0, logisticsLossMitigationPct: 4.0, routeEfficiencyPct: 2.5 },
};

const ROOM_EFFECTS = {
  office: {
    guild: { renownDailyPct: 1.0, questPowerPct: 0.5 },
    consortium: { routeEfficiencyPct: 1.0, logisticsRewardPct: 0.6 },
  },
  storage_room: {
    guild: { dungeonPowerFlat: 1 },
    consortium: { launchCostReductionPct: 1.5, routeEfficiencyPct: 0.6 },
  },
  contract_board: {
    guild: { questPowerPct: 1.2 },
    consortium: { logisticsRewardPct: 1.4 },
  },
  barracks_security_room: {
    guild: { dungeonPowerFlat: 2, questPowerPct: 0.8 },
    consortium: { logisticsLossMitigationPct: 1.8 },
  },
  vault: {
    guild: { renownDailyPct: 0.6 },
    consortium: { launchCostReductionPct: 1.2, logisticsLossMitigationPct: 1.6 },
  },
  archive: {
    guild: { questPowerPct: 0.9, renownDailyPct: 0.8 },
    consortium: { logisticsRewardPct: 0.9, routeEfficiencyPct: 0.6 },
  },
};

function getQualityFactor(base) {
  const metadata = asRecord(base?.metadata);
  const qualityModifiers = asRecord(metadata.qualityModifiers);
  const op = Number(qualityModifiers.operationalMultiplier ?? 1);
  if (!Number.isFinite(op)) return 1;
  // Keep quality influence slight.
  return clamp(1 + ((op - 1) * 0.35), 0.92, 1.08);
}

function listInstalledRooms(base) {
  const construction = asRecord(asRecord(base?.metadata).construction);
  const rooms = Array.isArray(construction.rooms) ? construction.rooms : [];
  return rooms
    .map((entry) => asRecord(entry))
    .filter((entry) => entry.status === "complete" && typeof entry.roomKey === "string")
    .map((entry) => ({
      roomKey: String(entry.roomKey),
      roomName: String(entry.roomName ?? entry.roomKey),
      monthlyUpkeepGold: asInt(entry.monthlyUpkeepGold, 0),
    }));
}

function makeBaseEffectsPayload(base, organizationType) {
  const metadata = asRecord(base?.metadata);
  const construction = asRecord(metadata.construction);
  const buildingKey = String(construction.mainBuildingKey ?? "").trim();

  const baseEffects = organizationType === "guild"
    ? asRecord(GUILD_BUILDING_EFFECTS[buildingKey])
    : asRecord(CONSORTIUM_BUILDING_EFFECTS[buildingKey]);

  const rooms = listInstalledRooms(base);
  const qualityFactor = getQualityFactor(base);

  const totals = {
    questPowerPct: asNum(baseEffects.questPowerPct, 0),
    dungeonPowerFlat: asNum(baseEffects.dungeonPowerFlat, 0),
    renownDailyPct: asNum(baseEffects.renownDailyPct, 0),
    logisticsRewardPct: asNum(baseEffects.logisticsRewardPct, 0),
    launchCostReductionPct: asNum(baseEffects.launchCostReductionPct, 0),
    logisticsLossMitigationPct: asNum(baseEffects.logisticsLossMitigationPct, 0),
    routeEfficiencyPct: asNum(baseEffects.routeEfficiencyPct, 0),
  };

  const contributions = [];
  for (const room of rooms) {
    const effect = asRecord(ROOM_EFFECTS[room.roomKey]?.[organizationType]);
    if (!Object.keys(effect).length) continue;
    contributions.push({ source: "room", key: room.roomKey, label: room.roomName, effect });
    totals.questPowerPct += Number(effect.questPowerPct ?? 0);
    totals.dungeonPowerFlat += Number(effect.dungeonPowerFlat ?? 0);
    totals.renownDailyPct += Number(effect.renownDailyPct ?? 0);
    totals.logisticsRewardPct += Number(effect.logisticsRewardPct ?? 0);
    totals.launchCostReductionPct += Number(effect.launchCostReductionPct ?? 0);
    totals.logisticsLossMitigationPct += Number(effect.logisticsLossMitigationPct ?? 0);
    totals.routeEfficiencyPct += Number(effect.routeEfficiencyPct ?? 0);
  }

  const scaled = {
    questPowerPct: clamp(Number((totals.questPowerPct * qualityFactor).toFixed(2)), 0, 18),
    dungeonPowerFlat: clamp(Math.round(totals.dungeonPowerFlat * qualityFactor), 0, 20),
    renownDailyPct: clamp(Number((totals.renownDailyPct * qualityFactor).toFixed(2)), 0, 20),
    logisticsRewardPct: clamp(Number((totals.logisticsRewardPct * qualityFactor).toFixed(2)), 0, 18),
    launchCostReductionPct: clamp(Number((totals.launchCostReductionPct * qualityFactor).toFixed(2)), 0, 15),
    logisticsLossMitigationPct: clamp(Number((totals.logisticsLossMitigationPct * qualityFactor).toFixed(2)), 0, 18),
    routeEfficiencyPct: clamp(Number((totals.routeEfficiencyPct * qualityFactor).toFixed(2)), 0, 14),
  };

  return {
    organizationType,
    baseStatus: String(base?.status ?? "none"),
    buildingKey: buildingKey || null,
    qualityFactor: Number(qualityFactor.toFixed(3)),
    effects: scaled,
    contributions,
    roomCount: rooms.length,
    source: "organization_base",
  };
}

export function getNeutralBaseEffects(organizationType) {
  return {
    organizationType,
    baseStatus: "none",
    buildingKey: null,
    qualityFactor: 1,
    effects: {
      questPowerPct: 0,
      dungeonPowerFlat: 0,
      renownDailyPct: 0,
      logisticsRewardPct: 0,
      launchCostReductionPct: 0,
      logisticsLossMitigationPct: 0,
      routeEfficiencyPct: 0,
    },
    contributions: [],
    roomCount: 0,
    source: "organization_base",
  };
}

export function computeOrganizationBaseEffects(base, organizationType) {
  if (!base || base.status !== "active") return getNeutralBaseEffects(organizationType);
  const metadata = asRecord(base.metadata);
  const construction = asRecord(metadata.construction);
  if (construction.buildingState !== "main_building_complete" && construction.buildingState !== "room_upgrade_under_construction") {
    return getNeutralBaseEffects(organizationType);
  }
  return makeBaseEffectsPayload(base, organizationType);
}

export async function getOrganizationBaseEffectsForOrg(client, organization) {
  if (!organization?.internalId || !organization?.type) return getNeutralBaseEffects("guild");
  const base = await findOrganizationBaseByOrganizationInternalId(client, organization.internalId);
  return computeOrganizationBaseEffects(base, organization.type);
}
