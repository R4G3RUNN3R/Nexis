import { getItemDisplayName } from "./itemData.js";

const LOOT_TABLES = {
  bandit: [
    { itemId: "stolen_coin", min: 1, max: 3, chance: 0.75 },
    { itemId: "field_bandage", min: 1, max: 1, chance: 0.28 },
    { itemId: "lockpick_set", min: 1, max: 1, chance: 0.08 },
    { itemId: "raider_token", min: 1, max: 1, chance: 0.22 },
  ],
  pirate: [
    { itemId: "stolen_coin", min: 1, max: 4, chance: 0.65 },
    { itemId: "rope_kit", min: 1, max: 1, chance: 0.22 },
    { itemId: "cargo_seals", min: 1, max: 2, chance: 0.3 },
    { itemId: "salt_glass_shard", min: 1, max: 1, chance: 0.12 },
    { itemId: "contraband_satchel", min: 1, max: 1, chance: 0.05 },
  ],
  beast: [
    { itemId: "wild_fang", min: 1, max: 2, chance: 0.55 },
    { itemId: "wild_herb", min: 1, max: 2, chance: 0.38 },
    { itemId: "medicinal_herb", min: 1, max: 1, chance: 0.18 },
  ],
  relic_guardian: [
    { itemId: "ward_shard", min: 1, max: 2, chance: 0.48 },
    { itemId: "ancient_fragment", min: 1, max: 1, chance: 0.18 },
    { itemId: "relic_core_splinter", min: 1, max: 1, chance: 0.08 },
  ],
  city_enforcer: [
    { itemId: "arena_mark", min: 1, max: 2, chance: 0.62 },
    { itemId: "field_bandage", min: 1, max: 1, chance: 0.18 },
    { itemId: "watch_baton", min: 1, max: 1, chance: 0.04 },
  ],
  arena: [
    { itemId: "arena_mark", min: 1, max: 3, chance: 0.7 },
    { itemId: "field_bandage", min: 1, max: 1, chance: 0.2 },
  ],
  abandoned_road: [
    { itemId: "stolen_coin", min: 1, max: 2, chance: 0.5 },
    { itemId: "field_bandage", min: 1, max: 1, chance: 0.22 },
    // Rare key-item drop for the Abandoned Road -> Smuggler's Gate adventure chain.
    // Guaranteed-after-N-attempts pity logic lives in adventureService.js (see pityItemId/pityThreshold).
    { itemId: "worn_caravan_seal", min: 1, max: 1, chance: 0.12 },
  ],
  // Salvage Yard "Salvage Scrap" reward pool (itemAdvancedService.js). Common materials roll often,
  // relic-adjacent components are rare. The consumed item is stripped from the result there so a
  // "no item salvages into itself" guarantee holds even though the pool isn't per-item deterministic.
  salvage: [
    { itemId: "scrap_metal", min: 1, max: 3, chance: 0.5 },
    { itemId: "rough_wood", min: 1, max: 3, chance: 0.5 },
    { itemId: "empty_vials", min: 1, max: 2, chance: 0.3 },
    { itemId: "iron_rivets", min: 1, max: 2, chance: 0.3 },
    { itemId: "arcane_ink", min: 1, max: 1, chance: 0.15 },
    { itemId: "vial_of_ink", min: 1, max: 1, chance: 0.15 },
    { itemId: "ward_shard", min: 1, max: 1, chance: 0.06 },
    { itemId: "ancient_fragment", min: 1, max: 1, chance: 0.02 },
  ],
};

function rollInt(randomFn, min, max) {
  const low = Math.max(1, Math.floor(min));
  const high = Math.max(low, Math.floor(max));
  return low + Math.floor(randomFn() * (high - low + 1));
}

export function getLootTable(family) {
  return LOOT_TABLES[family] ?? [];
}

export function rollLoot(family, randomFn = Math.random) {
  const table = getLootTable(family);
  const drops = [];
  for (const entry of table) {
    if (randomFn() <= entry.chance) {
      const quantity = rollInt(randomFn, entry.min, entry.max);
      drops.push({
        itemId: entry.itemId,
        label: getItemDisplayName(entry.itemId),
        quantity,
      });
    }
  }
  return drops.slice(0, 3);
}

// "Minor gold" component of the Salvage Yard reward. Gold isn't a lootable itemId in LOOT_TABLES,
// so this mirrors rollLoot()'s own chance-then-range-roll shape (same rollInt helper) instead of
// introducing a different randomization approach for currency.
const SALVAGE_GOLD_ROLL = { min: 3, max: 14, chance: 0.45 };

export function rollSalvageGold(randomFn = Math.random) {
  if (randomFn() > SALVAGE_GOLD_ROLL.chance) return 0;
  return rollInt(randomFn, SALVAGE_GOLD_ROLL.min, SALVAGE_GOLD_ROLL.max);
}
