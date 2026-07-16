export const PVP_SCAFFOLD_VERSION = "pvp-core-v1";

export const PVP_MODES = [
  {
    id: "sparring_duel",
    label: "Sparring Duel",
    summary: "A consensual same-city practice fight with no bounty, rivalry, or injury stakes.",
    risk: "low",
    unlock: "Available once both players can access Arena duels.",
    rewards: ["combat practice", "duel record", "minor achievement progress"],
  },
  {
    id: "ranked_duel",
    label: "Ranked Duel",
    summary: "A consensual competitive duel that affects seasonal rating and duel medals.",
    risk: "moderate",
    unlock: "Requires ranked PvP opt-in and same-city presence.",
    rewards: ["rank rating", "season points", "titles", "legacy records"],
  },
  {
    id: "bounty_writ",
    label: "Bounty Writ",
    summary: "A lawful hunt created from valid aggression, outlaw status, or explicit bounty eligibility.",
    risk: "targeted",
    unlock: "Requires a bounty-eligible target and escrowed gold.",
    rewards: ["bounty gold", "hunt record", "notoriety pressure"],
  },
  {
    id: "guild_rivalry",
    label: "Guild Rivalry",
    summary: "Guild-scored PvP against declared rivals, tracked as renown and rivalry history.",
    risk: "organization",
    unlock: "Requires guild leadership declaration and rival acceptance or hostile warrant.",
    rewards: ["guild renown", "season standings", "war-room records"],
  },
  {
    id: "caravan_interception",
    label: "Caravan Interception",
    summary: "Danger-route PvP around consortium logistics, escorts, and hostile interception.",
    risk: "route",
    unlock: "Requires opt-in dangerous route logistics and visible escort/interception state.",
    rewards: ["route disruption", "treasury impact", "cargo-risk records"],
  },
  {
    id: "arena_season",
    label: "Arena Season",
    summary: "Timed ladder play with weekly or monthly brackets, medals, and cosmetic prestige.",
    risk: "structured",
    unlock: "Requires Arena access and seasonal registration.",
    rewards: ["season medals", "titles", "rare manual eligibility", "public rankings"],
  },
];

export const PVP_SAFETY_RULES = [
  { id: "protected_default", label: "Protected by default", summary: "Players must opt into ranked, bounty, rivalry, or danger-route risk before high-stakes PvP applies." },
  { id: "same_city_default", label: "Same-city by default", summary: "Ordinary duels remain same-city interactions unless an explicit travel, bounty, or event rule says otherwise." },
  { id: "valid_bounty_target", label: "Valid bounty target", summary: "Bounty writs require opt-in, wanted status, or another lawful target state; random protected targets are blocked." },
  { id: "anti_farming", label: "Anti-farming", summary: "Repeated farming of the same target should be limited by cooldowns, diminished rewards, and record flags." },
  { id: "travel_owns_danger_routes", label: "Travel owns danger routes", summary: "Danger-route PvP belongs to Travel and Consortium logistics, not World Map." },
  { id: "record_results", label: "Record results", summary: "Every PvP result should write a compact combat record with participants, damage summary, and reward source." },
];

export const PVP_NOTORIETY_TIERS = [
  { id: "clean", label: "Clean", minScore: 0, summary: "Protected from bounty writs unless explicitly opted in." },
  { id: "noticed", label: "Noticed", minScore: 10, summary: "City officials track suspicious aggression and failed shady work." },
  { id: "wanted", label: "Wanted", minScore: 30, summary: "Eligible for lawful bounty writs and City Board notices." },
  { id: "outlaw", label: "Outlaw", minScore: 60, summary: "Open season for bounty hunters in eligible contexts; black-market access improves." },
  { id: "infamous", label: "Infamous", minScore: 100, summary: "High-risk, high-notice criminal identity with severe civic consequences." },
];

export const PVP_SEASON_TEMPLATE = {
  id: "season-0-foundation",
  label: "Foundation Season",
  status: "scaffolded",
  ratingFloor: 700,
  defaultRating: 1000,
  bands: ["Initiate", "Proven", "Vanguard", "Champion", "Mythic"],
};

export function getNotorietyTier(score = 0) {
  return [...PVP_NOTORIETY_TIERS].reverse().find((tier) => score >= tier.minScore) ?? PVP_NOTORIETY_TIERS[0];
}
