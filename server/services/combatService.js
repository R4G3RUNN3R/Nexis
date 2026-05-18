import { getNpcOpponent } from "../data/combatData.js";
import { getSkillDefinition, getSkillDefinitions } from "../data/skillData.js";
import { rollLoot } from "../data/lootData.js";
import { getEquipmentStatTotalsForRuntimeState } from "./itemService.js";
import { getSlottedSkillIds, grantSkillXp, syncUnlockedSkills, unlockSkill } from "./skillService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addLegacyEntry(runtimeState, entry) {
  const legacy = asRecord(runtimeState.legacy);
  const visibleEntries = asArray(legacy.visibleEntries);
  if (visibleEntries.some((current) => asRecord(current).id === entry.id)) {
    runtimeState.legacy = legacy;
    return;
  }
  legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50);
  runtimeState.legacy = legacy;
}

function applyPassiveEffects(runtimeState) {
  const passiveIds = getSlottedSkillIds(runtimeState, "passive");
  const effects = {
    damageMultiplier: 0,
    accuracyBonus: 0,
    critBonus: 0,
    evadeBonus: 0,
    mitigationBonus: 0,
    initiativeBonus: 0,
    maxHealthBonus: 0,
  };
  for (const skillId of passiveIds) {
    const skill = getSkillDefinition(skillId);
    if (!skill) continue;
    const combat = asRecord(skill.combat);
    effects.damageMultiplier += asNumber(combat.damageMultiplier, 0);
    effects.accuracyBonus += asNumber(combat.accuracyBonus, 0);
    effects.critBonus += asNumber(combat.critBonus, 0);
    effects.evadeBonus += asNumber(combat.evadeBonus, 0);
    effects.mitigationBonus += asNumber(combat.mitigationBonus, 0);
    effects.initiativeBonus += asNumber(combat.initiativeBonus, 0);
    effects.maxHealthBonus += asNumber(combat.maxHealthBonus, 0);
  }
  return { ids: passiveIds, effects };
}

function getUnlockedActiveSkillIds(runtimeState) {
  syncUnlockedSkills(runtimeState);
  const playerSkills = asRecord(runtimeState.player?.skills);
  const unlocked = new Set(asArray(playerSkills.unlocked));
  return getSkillDefinitions()
    .filter((skill) => skill.slotType === "active" && unlocked.has(skill.id))
    .map((skill) => skill.id);
}

function getCombatSkills(runtimeState) {
  unlockSkill(runtimeState, "quick_strike", "combat-default");
  const slotted = getSlottedSkillIds(runtimeState, "active");
  const unlocked = getUnlockedActiveSkillIds(runtimeState);
  const activeIds = slotted.length ? slotted : unlocked.slice(0, 4);
  return activeIds.length ? activeIds : ["quick_strike"];
}

function addEffectTotals(target, source) {
  for (const [key, value] of Object.entries(asRecord(source))) {
    target[key] = asNumber(target[key], 0) + asNumber(value, 0);
  }
}

function buildPlayerCombatant(runtimeState, name = "You") {
  const player = asRecord(runtimeState.player);
  const stats = asRecord(player.stats);
  const battle = asRecord(player.battleStats);
  const passive = applyPassiveEffects(runtimeState);
  const equipment = getEquipmentStatTotalsForRuntimeState(runtimeState);
  const effects = { ...asRecord(passive.effects) };
  addEffectTotals(effects, equipment.combatModifiers);
  addEffectTotals(effects, equipment.passiveEffects);
  const pendingCombat = asRecord(asRecord(player.itemBuffs).pendingCombat);
  if (pendingCombat.effect) {
    effects[pendingCombat.effect] = asNumber(effects[pendingCombat.effect], 0) + asNumber(pendingCombat.amount, 0);
  }
  const combinedPassive = { ids: passive.ids, effects };
  const maxHealth = Math.max(30, asNumber(stats.maxHealth, 100) + asNumber(effects.maxHealthBonus, 0) + asNumber(equipment.stats?.maxHealth, 0));
  return {
    side: "player",
    name,
    level: Math.max(1, Math.floor(asNumber(player.level, 1))),
    maxHealth,
    health: clamp(asNumber(stats.health, maxHealth), 1, maxHealth),
    battleStats: {
      strength: Math.max(1, asNumber(battle.strength, 10) + asNumber(equipment.battleStats?.strength, 0)),
      defense: Math.max(1, asNumber(battle.defense, 10) + asNumber(equipment.battleStats?.defense, 0)),
      speed: Math.max(1, asNumber(battle.speed, 10) + asNumber(equipment.battleStats?.speed, 0)),
      dexterity: Math.max(1, asNumber(battle.dexterity, 10) + asNumber(equipment.battleStats?.dexterity, 0)),
    },
    passive: combinedPassive,
    equipmentTotals: equipment,
    pendingCombatItem: pendingCombat.itemId ? pendingCombat : null,
  };
}

function buildNpcCombatant(opponent) {
  const npc = typeof opponent === "string" ? getNpcOpponent(opponent) : opponent;
  const battle = asRecord(npc.battleStats);
  const maxHealth = Math.max(20, asNumber(npc.health, 70));
  return {
    side: "opponent",
    id: npc.id,
    name: npc.name,
    level: Math.max(1, Math.floor(asNumber(npc.level, 1))),
    maxHealth,
    health: maxHealth,
    battleStats: {
      strength: Math.max(1, asNumber(battle.strength, 8)),
      defense: Math.max(1, asNumber(battle.defense, 8)),
      speed: Math.max(1, asNumber(battle.speed, 8)),
      dexterity: Math.max(1, asNumber(battle.dexterity, 8)),
    },
    passive: { ids: [], effects: {} },
    reward: npc.reward ?? {},
  };
}

function calculateDamage(attacker, defender, skill, randomFn) {
  const combat = asRecord(skill?.combat);
  const attackerStats = attacker.battleStats;
  const defenderStats = defender.battleStats;
  const attackBase = 7 + attacker.level * 2 + attackerStats.strength * 0.78 + attackerStats.dexterity * 0.18;
  const skillMultiplier = asNumber(combat.damageMultiplier, 1) + asNumber(attacker.passive?.effects?.damageMultiplier, 0);
  const mitigation = clamp(defenderStats.defense / (defenderStats.defense + 95) + asNumber(defender.passive?.effects?.mitigationBonus, 0), 0.03, 0.62);
  const variance = 0.88 + randomFn() * 0.24;
  return Math.max(1, Math.round(attackBase * skillMultiplier * (1 - mitigation) * variance));
}

function tryAttack({ attacker, defender, skill, randomFn, turn }) {
  const combat = asRecord(skill?.combat);
  const accuracy = clamp(
    72 +
      (attacker.battleStats.dexterity - defender.battleStats.dexterity) * 0.75 +
      (attacker.battleStats.speed - defender.battleStats.speed) * 0.35 +
      asNumber(combat.accuracyBonus, 0) +
      asNumber(attacker.passive?.effects?.accuracyBonus, 0) -
      asNumber(defender.passive?.effects?.evadeBonus, 0),
    28,
    95,
  );
  const roll = randomFn() * 100;
  if (roll > accuracy) {
    return { turn, actor: attacker.name, target: defender.name, skillId: skill?.id ?? null, skillName: skill?.name ?? "Basic Strike", outcome: "miss", damage: 0, message: `${attacker.name} missed ${defender.name} with ${skill?.name ?? "Basic Strike"}.` };
  }

  const critChance = clamp(5 + attacker.battleStats.dexterity / 18 + asNumber(combat.critBonus, 0) + asNumber(attacker.passive?.effects?.critBonus, 0), 2, 45);
  const crit = randomFn() * 100 < critChance;
  let damage = calculateDamage(attacker, defender, skill, randomFn);
  if (crit) damage = Math.round(damage * 1.55);
  defender.health = Math.max(0, defender.health - damage);
  let heal = 0;
  if (attacker.side === "player" && asNumber(combat.heal, 0) > 0) {
    heal = Math.min(attacker.maxHealth - attacker.health, Math.round(asNumber(combat.heal, 0)));
    attacker.health += heal;
  }
  return {
    turn,
    actor: attacker.name,
    target: defender.name,
    skillId: skill?.id ?? null,
    skillName: skill?.name ?? "Basic Strike",
    outcome: crit ? "crit" : "hit",
    damage,
    heal,
    defenderHealth: defender.health,
    message: `${attacker.name} used ${skill?.name ?? "Basic Strike"} for ${damage}${crit ? " critical" : ""} damage${heal ? ` and recovered ${heal} health` : ""}.`,
  };
}

function npcSkill(opponent) {
  return {
    id: `${opponent.id ?? "npc"}_pressure`,
    name: `${opponent.name} pressure`,
    combat: { damageMultiplier: 1, accuracyBonus: 0, critBonus: 2 },
  };
}

export function resolveCombat(runtimeState, opponentInput, options = {}) {
  const now = options.now ?? Date.now();
  const randomFn = options.randomFn ?? Math.random;
  const opponentSource = typeof opponentInput === "string" ? getNpcOpponent(opponentInput) : opponentInput;
  const playerName = typeof options.playerName === "string" ? options.playerName : "You";
  const player = buildPlayerCombatant(runtimeState, playerName);
  const opponent = buildNpcCombatant(opponentSource);
  const activeSkillIds = getCombatSkills(runtimeState);
  const activeSkills = activeSkillIds.map((skillId) => getSkillDefinition(skillId)).filter(Boolean);
  const log = [];
  const skillEvents = [];
  const rounds = Math.max(1, Math.min(12, Math.floor(asNumber(options.rounds, 8))));
  const playerFirst = player.battleStats.speed + player.battleStats.dexterity + asNumber(player.passive.effects.initiativeBonus, 0) >= opponent.battleStats.speed + opponent.battleStats.dexterity;

  let turn = 1;
  const order = playerFirst ? ["player", "opponent"] : ["opponent", "player"];
  for (let round = 0; round < rounds && player.health > 0 && opponent.health > 0; round += 1) {
    for (const side of order) {
      if (player.health <= 0 || opponent.health <= 0) break;
      if (side === "player") {
        const skill = activeSkills[round % activeSkills.length] ?? getSkillDefinition("quick_strike");
        const entry = tryAttack({ attacker: player, defender: opponent, skill, randomFn, turn });
        log.push(entry);
        if (entry.outcome !== "miss" && skill?.id) {
          const xpEvent = grantSkillXp(runtimeState, skill.id, asNumber(skill.useXp, 10) + asNumber(options.bonusSkillXp, 0), options.context ?? "combat", now);
          if (xpEvent) skillEvents.push(xpEvent);
        }
      } else {
        const entry = tryAttack({ attacker: opponent, defender: player, skill: npcSkill(opponent), randomFn, turn });
        log.push(entry);
      }
      turn += 1;
    }
  }

  let winner = "draw";
  if (player.health > 0 && opponent.health <= 0) winner = "player";
  else if (opponent.health > 0 && player.health <= 0) winner = "opponent";
  else {
    const playerRatio = player.health / player.maxHealth;
    const opponentRatio = opponent.health / opponent.maxHealth;
    if (playerRatio > opponentRatio + 0.05) winner = "player";
    else if (opponentRatio > playerRatio + 0.05) winner = "opponent";
  }

  const playerRecord = asRecord(runtimeState.player);
  playerRecord.stats = { ...asRecord(playerRecord.stats), health: Math.max(1, Math.round(player.health)) };
  if (player.pendingCombatItem) {
    const itemBuffs = { ...asRecord(playerRecord.itemBuffs) };
    delete itemBuffs.pendingCombat;
    itemBuffs.lastConsumedCombatBuff = { ...player.pendingCombatItem, consumedAt: now, context: options.context ?? "combat" };
    playerRecord.itemBuffs = itemBuffs;
  }
  playerRecord.counters = {
    ...asRecord(playerRecord.counters),
    combatRoundsResolved: Math.max(0, Math.floor(asNumber(playerRecord.counters?.combatRoundsResolved, 0))) + log.length,
    combatWins: Math.max(0, Math.floor(asNumber(playerRecord.counters?.combatWins, 0))) + (winner === "player" ? 1 : 0),
    combatLosses: Math.max(0, Math.floor(asNumber(playerRecord.counters?.combatLosses, 0))) + (winner === "opponent" ? 1 : 0),
    firstCombatAt: playerRecord.counters?.firstCombatAt ?? now,
  };
  runtimeState.player = playerRecord;

  return {
    context: options.context ?? "combat",
    opponent: { id: opponent.id, name: opponent.name, level: opponent.level, summary: opponentSource.summary ?? null },
    winner,
    outcome: winner === "player" ? "victory" : winner === "opponent" ? "defeat" : "draw",
    player: { health: Math.round(player.health), maxHealth: player.maxHealth },
    opponentState: { health: Math.round(opponent.health), maxHealth: opponent.maxHealth },
    activeSkills: activeSkills.map((skill) => ({ id: skill.id, name: skill.name })),
    passiveSkills: player.passive.ids,
    log,
    skillEvents,
    resolvedAt: now,
  };
}

export function applyCombatReward(runtimeState, reward, context = "combat", now = Date.now(), extraDrops = []) {
  const player = asRecord(runtimeState.player);
  const gold = Math.max(0, Math.floor(asNumber(player.gold, 500) + asNumber(reward.gold, 0)));
  player.gold = gold;
  player.currencies = { ...asRecord(player.currencies), gold };
  player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + asNumber(reward.experience, 0)));
  const items = [];
  if (reward.item?.itemId) items.push({ itemId: reward.item.itemId, label: reward.item.label, quantity: 1 });
  for (const item of asArray(reward.items)) if (item?.itemId) items.push({ ...item, quantity: Math.max(1, Math.floor(asNumber(item.quantity, 1))) });
  for (const item of asArray(extraDrops)) if (item?.itemId) items.push({ ...item, quantity: Math.max(1, Math.floor(asNumber(item.quantity, 1))) });
  if (items.length) {
    player.inventory = { ...asRecord(player.inventory) };
    for (const item of items) {
      player.inventory[item.itemId] = Math.max(0, Math.floor(asNumber(player.inventory[item.itemId], 0) + asNumber(item.quantity, 1)));
    }
  }
  player.counters = {
    ...asRecord(player.counters),
    combatRewardsClaimed: Math.max(0, Math.floor(asNumber(player.counters?.combatRewardsClaimed, 0))) + 1,
    lootDropsReceived: Math.max(0, Math.floor(asNumber(player.counters?.lootDropsReceived, 0))) + items.length,
    lastCombatRewardAt: now,
  };
  runtimeState.player = player;
  if (context === "arena") {
    addLegacyEntry(runtimeState, { id: `arena_spar_${now}`, title: "Arena Sparring Won", summary: "Won an arena sparring match using the live combat engine.", kind: "combat", awardedAt: now });
  }
  return { gold: asNumber(reward.gold, 0), experience: asNumber(reward.experience, 0), items };
}

export function resolveNpcCombatWithRewards(runtimeState, opponentId, options = {}) {
  const now = options.now ?? Date.now();
  const opponent = getNpcOpponent(opponentId);
  const result = resolveCombat(runtimeState, opponent, options);
  let reward = null;
  if (result.winner === "player") {
    const drops = rollLoot(opponent.lootFamily ?? options.lootFamily ?? "bandit", options.randomFn ?? Math.random);
    reward = applyCombatReward(runtimeState, opponent.reward ?? {}, options.context ?? "combat", now, drops);
  }
  return { ...result, reward };
}
