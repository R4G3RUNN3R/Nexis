// Server-authoritative title catalog.
//
// This supersedes the never-wired client-only scaffold that used to live at
// src/data/titleData.ts / src/lib/titleLogic.ts / TitleSelectorPanel.tsx (that
// code defined a PLAYER_TITLE_DEFINITIONS list and a "the_absolute" entry but
// was never imported by any page, so nothing in it ever ran). The prestige
// system (server/data/liveWorldData.js PRESTIGE_TITLE_DEFINITIONS, driven by
// server/services/liveWorldService.js resolvePrestigeState/setPrestigeTitle)
// is a separate, already-working "auto title from progress" system with no
// stat effects and no multi-title inventory; it is left untouched. This file
// is the new "earn many, equip one, some carry real stat effects" system.
//
// Each title has:
//   id                  stable identifier, used for storage and API calls
//   name                display name
//   kind                "cosmetic" | "stat"
//   description         player-facing requirement text
//   flavor              short flavor line
//   unlock              declarative unlock condition, evaluated by titleService.js
//   effects             null for cosmetic titles, or an effects object for stat titles
//   hidden              if true, never listed in the normal catalog response at all
//   exclusiveToPublicId if set, only that account can ever see/earn/equip this title
//
// Effects shape (all optional):
//   effects.battleStats.<strength|defense|speed|dexterity> = { percent?, flat? }
//   effects.workingStats.<manualLabor|intelligence|endurance> = { percent?, flat? }
//   effects.statMax.<maxHealth|maxEnergy|maxStamina|maxComfort> = { percent?, flat? }
// percent bonuses are computed off the player's base (pre-title) value; flat
// bonuses are added on top. Since only one title can be equipped at a time,
// there is no stacking/compounding ambiguity to resolve.

import { ABSOLUTE_OWNER_PUBLIC_ID } from "../lib/adminAccess.js";

export const ABSOLUTE_TITLE_ID = "the_absolute";

export const TITLE_KINDS = ["cosmetic", "stat"];

// --- Cosmetic titles -------------------------------------------------------
// Easy/common: each hooks into an existing, low-effort Legacy achievement
// (server/data/legacyAchievementsData.js) so earning one is just "keep
// playing normally." No stat effects.
const COSMETIC_TITLES = [
  {
    id: "newcomer",
    name: "Newcomer",
    kind: "cosmetic",
    description: "Register a Nexis citizen profile.",
    flavor: "The ink on your registry entry is still wet.",
    unlock: { type: "achievement", achievementId: "acct-001" },
    effects: null,
  },
  {
    id: "footloose",
    name: "Footloose",
    kind: "cosmetic",
    description: "Begin travel to another city.",
    flavor: "You have discovered that Nexis is not, in fact, the entire world.",
    unlock: { type: "achievement", achievementId: "trv-001" },
    effects: null,
  },
  {
    id: "seasoned-wanderer",
    name: "Seasoned Wanderer",
    kind: "cosmetic",
    description: "Resolve ten journeys or travel arrivals.",
    flavor: "The road no longer surprises you. Much.",
    unlock: { type: "achievement", achievementId: "trv-002" },
    effects: null,
  },
  {
    id: "lettered",
    name: "Lettered",
    kind: "cosmetic",
    description: "Complete one education course.",
    flavor: "You can now read things and it is somehow noticeable.",
    unlock: { type: "achievement", achievementId: "edu-002" },
    effects: null,
  },
  {
    id: "well-schooled",
    name: "Well-Schooled",
    kind: "cosmetic",
    description: "Complete five education courses.",
    flavor: "A respectable stack of finished coursework.",
    unlock: { type: "achievement", achievementId: "edu-003" },
    effects: null,
  },
  {
    id: "purse-keeper",
    name: "Purse-Keeper",
    kind: "cosmetic",
    description: "Hold 1,000 gold at once.",
    flavor: "You have successfully not spent all of it. Yet.",
    unlock: { type: "achievement", achievementId: "eco-001" },
    effects: null,
  },
  {
    id: "market-caller",
    name: "Market Caller",
    kind: "cosmetic",
    description: "Create a marketplace listing.",
    flavor: "You have opinions about pricing now.",
    unlock: { type: "achievement", achievementId: "eco-002" },
    effects: null,
  },
  {
    id: "trade-hand",
    name: "Trade Hand",
    kind: "cosmetic",
    description: "Complete five marketplace trades.",
    flavor: "You know a fair price when you see one, mostly.",
    unlock: { type: "achievement", achievementId: "eco-003" },
    effects: null,
  },
  {
    id: "blooded",
    name: "Blooded",
    kind: "cosmetic",
    description: "Resolve your first combat.",
    flavor: "Nothing that happened was your fault, probably.",
    unlock: { type: "achievement", achievementId: "cmb-001" },
    effects: null,
  },
  {
    id: "pathfinder",
    name: "Pathfinder",
    kind: "cosmetic",
    description: "Record a travel discovery or hidden-site lead.",
    flavor: "You added a note to a map that did not have one before.",
    unlock: { type: "achievement", achievementId: "exp-001" },
    effects: null,
  },
  {
    id: "site-seer",
    name: "Site-Seer",
    kind: "cosmetic",
    description: "Discover or explore three hidden sites.",
    flavor: "Rumors keep turning into real places when you show up.",
    unlock: { type: "achievement", achievementId: "exp-002" },
    effects: null,
  },
  {
    id: "artisans-hand",
    name: "Artisan's Hand",
    kind: "cosmetic",
    description: "Craft your first item.",
    flavor: "It is a little crooked. It still counts.",
    unlock: { type: "achievement", achievementId: "itm-001" },
    effects: null,
  },
  {
    id: "organized",
    name: "Organized",
    kind: "cosmetic",
    description: "Join a guild or consortium.",
    flavor: "You now have people to blame for things.",
    unlock: { type: "achievement", achievementId: "org-001" },
    effects: null,
  },
  {
    id: "practiced-hand",
    name: "Practiced Hand",
    kind: "cosmetic",
    description: "Unlock your first skill.",
    flavor: "A new trick, freshly learned and slightly overused.",
    unlock: { type: "achievement", achievementId: "skl-001" },
    effects: null,
  },
];

// --- Stat titles -------------------------------------------------------
// Rare and hard-gated: each requires a large, sustained effort investment
// (hundreds of resolved fights, multiple full academy completions across
// different cities, or completing every Legacy achievement in the game).
// Bonuses are intentionally small (1-3%) and clearly bounded so none of
// these move the game's balance on their own; they establish the pattern.
const STAT_TITLES = [
  {
    id: "warlords-mark",
    name: "Warlord's Mark",
    kind: "stat",
    description: "Win 400 real fights.",
    flavor: "Four hundred separate arguments, all settled the same way.",
    unlock: { type: "counter", key: "combatWins", threshold: 400 },
    effects: {
      battleStats: {
        strength: { percent: 2 },
        defense: { percent: 2 },
      },
    },
  },
  {
    id: "grandmaster-of-the-trades",
    name: "Grandmaster of the Trades",
    kind: "stat",
    description: "Fully complete all five city academies.",
    flavor: "Every city's instructors, all five of them, have run out of things to teach you.",
    unlock: { type: "academyCount", threshold: 5 },
    effects: {
      workingStats: {
        intelligence: { percent: 3 },
        endurance: { percent: 2 },
      },
    },
  },
  {
    id: "paragon-of-nexis",
    name: "Paragon of Nexis",
    kind: "stat",
    description: "Earn every Legacy achievement.",
    flavor: "There is nothing left on the board that does not already have your name on it.",
    unlock: { type: "allAchievements" },
    effects: {
      battleStats: {
        strength: { percent: 1 },
        defense: { percent: 1 },
        speed: { percent: 1 },
        dexterity: { percent: 1 },
      },
      workingStats: {
        manualLabor: { percent: 1 },
        intelligence: { percent: 1 },
        endurance: { percent: 1 },
      },
    },
  },
];

// --- The Absolute --------------------------------------------------------
// One-time, Hennet-exclusive. ABSOLUTE_OWNER_PUBLIC_ID (public ID 1,000,000)
// is the pre-existing identifier for that account, already used the same way
// by src/lib/adminAccess.ts / server/lib/adminAccess.js (isAbsoluteOwner) and
// src/data/propertyData.ts ("Hennet exclusive" property access), and named
// explicitly as "Hennet Uthellien" in server/lib/userIdentity.js's reserved
// identity table. Reusing that constant here (rather than inventing a new
// allowlist) means there is exactly one place in the codebase that defines
// who "Hennet" is.
//
// This title is never organically earnable (unlock.type "exclusiveGrant" is
// never true on its own) and is filtered out of every catalog response for
// any other account by isTitleVisibleToUser() below. It can only enter a
// player's grantedTitleIds through titleService.grantAbsoluteTitleToAllowlistedAccount,
// which hardcodes the same ABSOLUTE_OWNER_PUBLIC_ID lookup and refuses to run
// against any other account.
const ABSOLUTE_TITLE = {
  id: ABSOLUTE_TITLE_ID,
  name: "The Absolute",
  kind: "stat",
  description: "Reserved. Not earnable, grantable, or equippable through any normal player or admin action.",
  flavor: "A title that should not exist for normal characters, which is exactly why it does.",
  unlock: { type: "exclusiveGrant" },
  hidden: true,
  exclusiveToPublicId: ABSOLUTE_OWNER_PUBLIC_ID,
  effects: {
    battleStats: {
      strength: { flat: 100000 },
      defense: { flat: 100000 },
      speed: { flat: 100000 },
      dexterity: { flat: 100000 },
    },
    workingStats: {
      manualLabor: { flat: 100000 },
      intelligence: { flat: 100000 },
      endurance: { flat: 100000 },
    },
    statMax: {
      maxHealth: { flat: 100000 },
      maxEnergy: { flat: 100000 },
      maxStamina: { flat: 100000 },
      maxComfort: { flat: 100000 },
    },
  },
};

export const TITLE_DEFINITIONS = [...COSMETIC_TITLES, ...STAT_TITLES, ABSOLUTE_TITLE];

export function getTitleDefinition(titleId) {
  const id = String(titleId ?? "").trim();
  if (!id) return null;
  return TITLE_DEFINITIONS.find((title) => title.id === id) ?? null;
}

// A title is visible to a given user (public ID) unless it is locked to a
// different, specific account via exclusiveToPublicId. This is the guard
// that keeps The Absolute out of every other player's catalog listing.
export function isTitleVisibleToUser(title, publicId) {
  if (!title?.exclusiveToPublicId) return true;
  return publicId === title.exclusiveToPublicId;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry) => typeof entry === "string" && entry.trim())));
}

// Shared shape for the persisted "which titles does this player hold / have
// equipped" state. Pure and DB-free so both runtimePlayerState.js (a leaf
// module with no service imports) and titleService.js can use it without
// creating an import cycle.
export function normalizeTitlesState(rawTitles) {
  const raw = asRecord(rawTitles);
  return {
    grantedTitleIds: asStringArray(raw.grantedTitleIds),
    equippedTitleId: typeof raw.equippedTitleId === "string" && raw.equippedTitleId ? raw.equippedTitleId : null,
    grantLog: Array.isArray(raw.grantLog) ? raw.grantLog.slice(-50) : [],
  };
}

// Resolves the definition for the currently-equipped title, re-checking the
// exclusivity allowlist every time. This is intentional defense in depth: it
// means even if a bad equippedTitleId somehow ended up persisted for a
// non-allowlisted account, the effect-application layer in
// runtimePlayerState.js would still refuse to honor it.
export function resolveEquippedTitleForRuntime(equippedTitleId, publicId) {
  if (!equippedTitleId) return null;
  const title = getTitleDefinition(equippedTitleId);
  if (!title) return null;
  if (!isTitleVisibleToUser(title, publicId)) return null;
  return title;
}

function applyStatEffect(baseValue, effect) {
  const base = Number(baseValue) || 0;
  if (!effect) return base;
  const flat = Number(effect.flat) || 0;
  const percent = Number(effect.percent) || 0;
  return base + flat + base * (percent / 100);
}

export function computeEffectiveBattleStats(baseBattleStats, title) {
  const base = asRecord(baseBattleStats);
  const effects = asRecord(asRecord(title?.effects).battleStats);
  const result = { ...base };
  for (const key of Object.keys(base)) {
    result[key] = Math.max(0, Math.round(applyStatEffect(base[key], effects[key])));
  }
  return result;
}

export function computeEffectiveWorkingStats(baseWorkingStats, title) {
  const base = asRecord(baseWorkingStats);
  const effects = asRecord(asRecord(title?.effects).workingStats);
  const result = { ...base };
  for (const key of Object.keys(base)) {
    result[key] = Math.max(0, Math.round(applyStatEffect(base[key], effects[key])));
  }
  return result;
}

// Only ever boosts the four max-resource fields; every other field of
// baseStats (current health/energy/stamina/comfort, nerve, chain, ...) is
// copied through untouched so current pools are never lost or reset.
export function computeEffectiveMaxStats(baseStats, title) {
  const base = asRecord(baseStats);
  const effects = asRecord(asRecord(title?.effects).statMax);
  const result = { ...base };
  for (const key of ["maxHealth", "maxEnergy", "maxStamina", "maxComfort"]) {
    if (key in base) {
      result[key] = Math.max(0, Math.round(applyStatEffect(base[key], effects[key])));
    }
  }
  return result;
}

function describeEffect(label, effect) {
  if (!effect) return null;
  const parts = [];
  if (effect.percent) parts.push(`${effect.percent > 0 ? "+" : ""}${effect.percent}%`);
  if (effect.flat) parts.push(`${effect.flat > 0 ? "+" : ""}${effect.flat.toLocaleString("en-GB")}`);
  return parts.length ? `${parts.join(" / ")} ${label}` : null;
}

const BATTLE_STAT_LABELS = { strength: "Strength", defense: "Defense", speed: "Speed", dexterity: "Dexterity" };
const WORKING_STAT_LABELS = { manualLabor: "Manual Labor", intelligence: "Intelligence", endurance: "Endurance" };
const MAX_STAT_LABELS = { maxHealth: "Max Health", maxEnergy: "Max Energy", maxStamina: "Max Stamina", maxComfort: "Max Comfort" };

// Human-readable effect lines for the UI ("+2% Strength", "+100,000 Max Health", ...).
export function describeTitleEffects(title) {
  if (!title?.effects) return [];
  const lines = [];
  const battleStats = asRecord(title.effects.battleStats);
  for (const [key, label] of Object.entries(BATTLE_STAT_LABELS)) {
    const line = describeEffect(label, battleStats[key]);
    if (line) lines.push(line);
  }
  const workingStats = asRecord(title.effects.workingStats);
  for (const [key, label] of Object.entries(WORKING_STAT_LABELS)) {
    const line = describeEffect(label, workingStats[key]);
    if (line) lines.push(line);
  }
  const statMax = asRecord(title.effects.statMax);
  for (const [key, label] of Object.entries(MAX_STAT_LABELS)) {
    const line = describeEffect(label, statMax[key]);
    if (line) lines.push(line);
  }
  return lines;
}
