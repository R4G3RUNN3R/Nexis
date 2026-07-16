export const ORGANIZATION_ONE_SHOT_MIN_SIGNUPS = 5;
export const ORGANIZATION_ONE_SHOT_TOKEN_COST = 1;
export const ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE = 0.0001;

export const ORGANIZATION_ONE_SHOT_CAMPAIGNS = [
  {
    id: "guild-bonecrypt-depths",
    organizationType: "guild",
    theme: "dungeon_monster",
    title: "The Bonecrypt Depths",
    category: "Dungeon Delve",
    summary: "A five-member guild party clears a sealed undercrypt before the dead climb into the city drains.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 1200,
      progressionPoints: 18,
      reputation: 22,
      renown: 18,
      itemRewards: [
        { family: "weapon", label: "guild weapon cache", emphasis: "melee and ranged arms" },
        { family: "armor", label: "reinforced armor bundle", emphasis: "slashing and piercing protection" },
      ],
      legacyLabel: "Bonecrypt Clearing Recorded",
    },
  },
  {
    id: "guild-embermaw-hunt",
    organizationType: "guild",
    theme: "dungeon_monster",
    title: "The Embermaw Hunt",
    category: "Monster Hunt",
    summary: "Hunters track a furnace-fed beast through service tunnels and bring back proof of the kill.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 1500,
      progressionPoints: 20,
      reputation: 24,
      renown: 20,
      itemRewards: [
        { family: "weapon", label: "heavy weapon claim", emphasis: "hammers, axes, and polearms" },
        { family: "armor", label: "heat-scored plate pieces", emphasis: "bludgeoning and slashing defense" },
      ],
      legacyLabel: "Embermaw Hunt Recorded",
    },
  },
  {
    id: "guild-warded-grove-incursion",
    organizationType: "guild",
    theme: "dungeon_monster",
    title: "The Warded Grove Incursion",
    category: "Monster Suppression",
    summary: "A guild team enters a hostile grove pocket and drives out creatures twisted by a broken ward.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 1300,
      progressionPoints: 19,
      reputation: 23,
      renown: 19,
      itemRewards: [
        { family: "armor", label: "warden armor parcel", emphasis: "magical and poison protection" },
        { family: "weapon", label: "arcane focus crate", emphasis: "staffs, rods, and foci" },
      ],
      legacyLabel: "Grove Incursion Recorded",
    },
  },
  {
    id: "guild-corsair-cavern",
    organizationType: "guild",
    theme: "dungeon_monster",
    title: "The Corsair Cavern",
    category: "Dungeon Assault",
    summary: "The guild raids a tide-cut cavern where smugglers have chained something worse than guards to the cargo.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 1450,
      progressionPoints: 21,
      reputation: 25,
      renown: 21,
      itemRewards: [
        { family: "weapon", label: "corsair arms lot", emphasis: "knives, sabers, and spears" },
        { family: "armor", label: "saltcoat armor pieces", emphasis: "piercing and poison protection" },
      ],
      legacyLabel: "Corsair Cavern Recorded",
    },
  },
  {
    id: "guild-court-catacomb-champion",
    organizationType: "guild",
    theme: "dungeon_monster",
    title: "The Catacomb Champion",
    category: "Elite Dungeon Fight",
    summary: "Five guild members descend under Highcourt to defeat a sealed champion still obeying a dead verdict.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 1700,
      progressionPoints: 24,
      reputation: 28,
      renown: 24,
      itemRewards: [
        { family: "armor", label: "bastion armor claim", emphasis: "piercing and magical protection" },
        { family: "weapon", label: "court weapon writ", emphasis: "swords and disciplined blades" },
      ],
      legacyLabel: "Catacomb Champion Recorded",
    },
  },
  {
    id: "consortium-sapphire-ledger",
    organizationType: "consortium",
    theme: "trade",
    title: "The Sapphire Ledger Exchange",
    category: "Trade Operation",
    summary: "A consortium crew moves bonded ledgers through three markets and closes the margin before rivals react.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 3200,
      progressionPoints: 18,
      reputation: 14,
      renown: 10,
      itemRewards: [
        { family: "high_value_trade_good", label: "sealed ledger lots", emphasis: "high resale value" },
        { family: "high_value_trade_good", label: "bonded contract folios", emphasis: "premium city buyers" },
      ],
      legacyLabel: "Ledger Exchange Recorded",
    },
  },
  {
    id: "consortium-velvet-audit",
    organizationType: "consortium",
    theme: "espionage",
    title: "The Velvet Audit",
    category: "Espionage Audit",
    summary: "Agents infiltrate a rival counting house, copy the proof, and leave the locks looking bored.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 3600,
      progressionPoints: 20,
      reputation: 16,
      renown: 11,
      itemRewards: [
        { family: "high_value_trade_good", label: "compromising audit papers", emphasis: "valuable leverage sale" },
        { family: "high_value_trade_good", label: "court-stamped securities", emphasis: "prestige resale" },
      ],
      legacyLabel: "Velvet Audit Recorded",
    },
  },
  {
    id: "consortium-rival-route-sabotage",
    organizationType: "consortium",
    theme: "sabotage",
    title: "The Rival Route Sabotage",
    category: "Rival Sabotage",
    summary: "The company spoils a rival route with forged delays, bad freight math, and a very convincing clerk.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 3400,
      progressionPoints: 22,
      reputation: 15,
      renown: 12,
      itemRewards: [
        { family: "high_value_trade_good", label: "redirected luxury cargo", emphasis: "high-cost resale" },
        { family: "high_value_trade_good", label: "rare market permits", emphasis: "trade advantage" },
      ],
      legacyLabel: "Route Sabotage Recorded",
    },
  },
  {
    id: "consortium-relic-futures-play",
    organizationType: "consortium",
    theme: "trade",
    title: "The Relic Futures Play",
    category: "Speculative Trade",
    summary: "Brokers secure relic options before the public notice makes every amateur suddenly religious about margins.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 3900,
      progressionPoints: 21,
      reputation: 17,
      renown: 13,
      itemRewards: [
        { family: "high_value_trade_good", label: "authenticated relic lots", emphasis: "premium resale" },
        { family: "high_value_trade_good", label: "appraiser seals", emphasis: "market trust" },
      ],
      legacyLabel: "Relic Futures Recorded",
    },
  },
  {
    id: "consortium-black-quay-exposure",
    organizationType: "consortium",
    theme: "espionage",
    title: "The Black Quay Exposure",
    category: "Counter-Intelligence",
    summary: "A consortium cell exposes a rival black-quay arrangement and sells the silence more profitably than the scandal.",
    minimumSignups: 5,
    reward: {
      treasuryGold: 4100,
      progressionPoints: 24,
      reputation: 18,
      renown: 14,
      itemRewards: [
        { family: "high_value_trade_good", label: "quiet settlement writs", emphasis: "high-cost liquidation" },
        { family: "high_value_trade_good", label: "contraband routing notes", emphasis: "black-market value" },
      ],
      legacyLabel: "Black Quay Exposure Recorded",
    },
  },
];

export function getOrganizationOneShotCampaigns(type = null) {
  return ORGANIZATION_ONE_SHOT_CAMPAIGNS.filter((campaign) => !type || campaign.organizationType === type);
}

export function getOrganizationOneShotCampaign(campaignId) {
  return ORGANIZATION_ONE_SHOT_CAMPAIGNS.find((campaign) => campaign.id === campaignId) ?? null;
}
