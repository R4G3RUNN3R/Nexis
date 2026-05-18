function stock({ itemId, price, tier = "core", source = "local", minimumStanding = 0, requiredCourses = [], description }) {
  return { itemId, price, tier, source, minimumStanding, requiredCourses, description };
}

function special({ id, cityId, name, summary, actionLabel, costGold, minimumStanding = 0, requiredCourses = [], cooldownMs = 10 * 60 * 1000, reward }) {
  return { id, cityId, name, summary, actionLabel, costGold, minimumStanding, requiredCourses, cooldownMs, reward };
}

export const CITY_MARKET_PROFILES = {
  nexis: {
    cityId: "nexis",
    name: "Civic Market Hall",
    summary: "Broad starter stock, legal paperwork, and general supplies for new citizens.",
    imports: ["basic tools", "rations", "paperwork supplies"],
    exports: ["permits", "civic dispatches", "starter equipment"],
    stock: [
      stock({ itemId: "rations", price: 35, description: "Cheap capital travel food." }),
      stock({ itemId: "rope", price: 55, description: "General utility cordage." }),
      stock({ itemId: "courier_satchel", price: 115, description: "Favored by registry runners." }),
      stock({ itemId: "vial_of_ink", price: 42, source: "civic", description: "Locally common filing supply." }),
      stock({ itemId: "wax_seal", price: 72, source: "civic", minimumStanding: 2, description: "Standing-checked civic seal stock." }),
      stock({ itemId: "lantern", price: 96, description: "Basic route and ruin light." }),
      stock({ itemId: "shovel", price: 80, description: "Common field tool." }),
      stock({ itemId: "ledger_page", price: 120, tier: "specialty", minimumStanding: 2, description: "Registry ledger paper for trusted city work." }),
    ],
  },
  west: {
    cityId: "west",
    name: "Blackharbor Dock Market",
    summary: "Imported tonics, foreign cargo, maritime supplies, and brokered goods move through the docks.",
    imports: ["healing tonics", "sealed cargo", "foreign tokens", "salt glass"],
    exports: ["cargo contracts", "escort manifests", "underdock rumors"],
    stock: [
      stock({ itemId: "healing_tonic", price: 120, source: "imported", description: "Cheaper at the port than inland." }),
      stock({ itemId: "restorative_elixir", price: 335, tier: "specialty", source: "imported", minimumStanding: 2, description: "Trusted import stock." }),
      stock({ itemId: "travel_cloak", price: 165, source: "maritime", description: "Dock-weather travel gear." }),
      stock({ itemId: "courier_satchel", price: 112, source: "cargo", description: "Port messenger stock." }),
      stock({ itemId: "rations", price: 32, source: "ship stores", description: "Ship-ready provisions." }),
      stock({ itemId: "foreign_token", price: 175, tier: "specialty", minimumStanding: 2, description: "Broker token for trusted cargo introductions." }),
      stock({ itemId: "torn_map", price: 155, tier: "specialty", requiredCourses: ["world-geography"], description: "Route scrap sold to literate travelers." }),
      stock({ itemId: "rope", price: 48, source: "dock", description: "Dock rope is everywhere, mercifully." }),
    ],
  },
  north: {
    cityId: "north",
    name: "Silverbough Herbal Relic Market",
    summary: "Herbs, tonics, reagents, ward supplies, and relic paperwork dominate the northern stalls.",
    imports: ["moonwater", "rare roots", "relic rubbings"],
    exports: ["medicinal herbs", "ward notes", "healing services"],
    stock: [
      stock({ itemId: "wild_herb", price: 18, source: "local", description: "Abundant around Silverbough." }),
      stock({ itemId: "medicinal_herb", price: 48, source: "local", description: "Cheaper near the healing circles." }),
      stock({ itemId: "rare_herb", price: 130, tier: "specialty", minimumStanding: 2, description: "Trusted herb-court stock." }),
      stock({ itemId: "healing_root", price: 170, tier: "specialty", minimumStanding: 2, description: "Potent root from warded suppliers." }),
      stock({ itemId: "enchanted_parchment", price: 140, source: "arcane", requiredCourses: ["world-geography"], description: "Parchment handled through conservatory channels." }),
      stock({ itemId: "relic_note", price: 145, tier: "specialty", requiredCourses: ["world-geography"], description: "Catalog note for academy-adjacent relic work." }),
      stock({ itemId: "herbalist_gloves", price: 78, source: "local", description: "Protective harvest gloves." }),
      stock({ itemId: "ward_shard", price: 220, tier: "specialty", minimumStanding: 4, requiredCourses: ["world-geography"], description: "Restricted ward fragment for trusted researchers." }),
    ],
  },
  east: {
    cityId: "east",
    name: "Ironhall Forge Market",
    summary: "Tools, ores, fuel, fittings, and industrial materials are easier to source at the forge city.",
    imports: ["coal", "timber braces", "raw ore"],
    exports: ["tools", "armor blanks", "steel braces"],
    stock: [
      stock({ itemId: "coal", price: 48, source: "forge", description: "Common forge fuel." }),
      stock({ itemId: "iron_ore", price: 72, source: "ore yard", description: "Cheaper near the yards." }),
      stock({ itemId: "iron_ingot", price: 138, source: "forge", description: "Local refined stock." }),
      stock({ itemId: "iron_rivets", price: 76, source: "workshop", description: "Every brace asks for these eventually." }),
      stock({ itemId: "smithing_hammer", price: 170, source: "forge", description: "Locally balanced hammer." }),
      stock({ itemId: "miners_pick", price: 158, source: "labor hall", description: "Common industrial tool." }),
      stock({ itemId: "steel_ingot", price: 255, tier: "specialty", minimumStanding: 2, description: "Trusted forge stock." }),
      stock({ itemId: "steel_brace", price: 310, tier: "specialty", minimumStanding: 4, requiredCourses: ["practical-arithmetic"], description: "Restricted bracewright stock." }),
    ],
  },
  south: {
    cityId: "south",
    name: "Highcourt Permit Arcade",
    summary: "Legal supplies, refined luxuries, permit materials, and prestige goods are priced for people who pretend not to ask.",
    imports: ["fine ink", "court attire", "official seals"],
    exports: ["permits", "titles", "legal filings"],
    stock: [
      stock({ itemId: "vial_of_ink", price: 38, source: "court", description: "Fine ink is cheap where everyone writes too much." }),
      stock({ itemId: "wax_seal", price: 62, source: "court", description: "Permit-desk seal stock." }),
      stock({ itemId: "courier_satchel", price: 125, source: "envoy", description: "Formal messenger satchel." }),
      stock({ itemId: "forged_seal_kit", price: 240, tier: "specialty", minimumStanding: 2, description: "Legal-adjacent seal kit sold under watchful eyebrows." }),
      stock({ itemId: "prestige_goods", price: 460, tier: "specialty", minimumStanding: 2, description: "Refined goods for court-facing status." }),
      stock({ itemId: "court_token", price: 210, tier: "specialty", minimumStanding: 4, requiredCourses: ["civic-fundamentals"], description: "Introduction token for trusted petitioners." }),
      stock({ itemId: "engraved_goblet", price: 390, tier: "luxury", minimumStanding: 4, description: "Highcourt ceremony stock." }),
      stock({ itemId: "sealed_notice", price: 135, source: "court", minimumStanding: 2, description: "Formal notice bundle for trusted errands." }),
    ],
  },
};

export const CITY_SPECIALS = {
  nexis: [
    special({ id: "nexis-registry-stamp", cityId: "nexis", name: "Registry Stamp Packet", summary: "Buy a clean packet of civic stamps and filing supplies from the registry desk.", actionLabel: "Buy stamp packet", costGold: 45, reward: { items: [{ itemId: "wax_seal", label: "Wax Seal", quantity: 1 }, { itemId: "vial_of_ink", label: "Vial of Ink", quantity: 1 }], cityStanding: 1 } }),
    special({ id: "nexis-dispatch-voucher", cityId: "nexis", name: "Dispatch Voucher", summary: "Trade standing and gold for a trusted dispatch bundle used by stronger civic contracts.", actionLabel: "Request dispatch bundle", costGold: 95, minimumStanding: 2, reward: { items: [{ itemId: "sealed_notice", label: "Sealed Notice", quantity: 1 }], experience: 10, cityStanding: 1 } }),
  ],
  west: [
    special({ id: "blackharbor-import-lot", cityId: "west", name: "Potion Import Lot", summary: "Buy a brokered tonic lot fresh off the docks while customs looks elsewhere legally enough.", actionLabel: "Buy tonic lot", costGold: 110, reward: { items: [{ itemId: "healing_tonic", label: "Healing Tonic", quantity: 2 }], cityStanding: 1 } }),
    special({ id: "blackharbor-cargo-introduction", cityId: "west", name: "Cargo Broker Introduction", summary: "Pay a dock broker for a foreign-goods introduction that improves port access.", actionLabel: "Meet cargo broker", costGold: 155, minimumStanding: 2, reward: { items: [{ itemId: "foreign_token", label: "Foreign Token", quantity: 1 }], experience: 14, cityStanding: 1 } }),
  ],
  north: [
    special({ id: "silverbough-shrine-petition", cityId: "north", name: "Shrine Petition", summary: "Contribute to shrine supply and receive healer-approved restorative stock.", actionLabel: "Submit shrine petition", costGold: 75, reward: { items: [{ itemId: "medicinal_herb", label: "Medicinal Herb", quantity: 2 }], cityStanding: 1 } }),
    special({ id: "silverbough-relic-appraisal", cityId: "north", name: "Relic Appraisal Token", summary: "Request a conservatory appraisal token for future relic work.", actionLabel: "Request appraisal", costGold: 135, minimumStanding: 2, requiredCourses: ["world-geography"], reward: { items: [{ itemId: "relic_note", label: "Relic Note", quantity: 1 }], experience: 14, cityStanding: 1 } }),
  ],
  east: [
    special({ id: "ironhall-material-requisition", cityId: "east", name: "Material Requisition", summary: "Buy a requisition bundle from the ore yard before workshops claim the lot.", actionLabel: "Buy requisition", costGold: 90, reward: { items: [{ itemId: "iron_ore", label: "Iron Ore", quantity: 2 }, { itemId: "coal", label: "Coal", quantity: 1 }], cityStanding: 1 } }),
    special({ id: "ironhall-forge-commission", cityId: "east", name: "Forge Commission Slot", summary: "Reserve a short forge commission slot for better industrial materials.", actionLabel: "Reserve forge slot", costGold: 165, minimumStanding: 2, requiredCourses: ["practical-arithmetic"], reward: { items: [{ itemId: "steel_ingot", label: "Steel Ingot", quantity: 1 }], experience: 15, cityStanding: 1 } }),
  ],
  south: [
    special({ id: "highcourt-legal-seal", cityId: "south", name: "Legal Seal Packet", summary: "Purchase court-approved seals and ink for filings that must look awake.", actionLabel: "Buy legal packet", costGold: 85, reward: { items: [{ itemId: "wax_seal", label: "Wax Seal", quantity: 1 }, { itemId: "vial_of_ink", label: "Vial of Ink", quantity: 1 }], cityStanding: 1 } }),
    special({ id: "highcourt-noble-introduction", cityId: "south", name: "Noble Introduction", summary: "Pay the chamber fee for a formal introduction token with prestige value.", actionLabel: "Request introduction", costGold: 220, minimumStanding: 4, requiredCourses: ["civic-fundamentals"], reward: { items: [{ itemId: "court_token", label: "Court Token", quantity: 1 }], experience: 18, cityStanding: 1 } }),
  ],
};

export const CITY_BLACK_MARKETS = {
  nexis: {
    cityId: "nexis",
    name: "Nexis Backroom Rumors",
    summary: "Starter underworld access remains cautious in the capital.",
    minimumStanding: 4,
    requiredCourses: ["street-survival"],
    lockReason: "Requires Street Survival and 4 Nexis City standing.",
    stock: [
      stock({ itemId: "lockpick", price: 115, source: "backroom", description: "Single pick from a quiet stall." }),
      stock({ itemId: "forged_document", price: 260, source: "backroom", minimumStanding: 4, description: "Capital forged paper with risk baked in." }),
    ],
  },
  west: {
    cityId: "west",
    name: "Blackharbor Underdock Brokers",
    summary: "Potion imports, quiet manifests, and contraband-adjacent cargo make Blackharbor's under-market immediately useful.",
    minimumStanding: 0,
    requiredCourses: [],
    lockReason: null,
    stock: [
      stock({ itemId: "healing_tonic", price: 105, source: "underdock", description: "Discount import tonic from a broker who smiles too much." }),
      stock({ itemId: "lockpick_set", price: 230, source: "underdock", description: "Fuller pick set for quiet doors." }),
      stock({ itemId: "forged_document", price: 205, source: "underdock", minimumStanding: 2, description: "Cargo papers with elastic truth." }),
      stock({ itemId: "restorative_elixir", price: 320, source: "underdock", minimumStanding: 2, description: "High-value import, dock-gated by trust." }),
    ],
  },
  north: {
    cityId: "north",
    name: "Sealed Relic Rumors",
    summary: "Silverbough suppresses illicit relic trade; only trained, trusted visitors hear useful offers.",
    minimumStanding: 4,
    requiredCourses: ["world-geography"],
    lockReason: "Requires World Geography and 4 Silverbough standing.",
    stock: [
      stock({ itemId: "ancient_fragment", price: 245, source: "sealed rumor", description: "Questionable fragment for relic scholars." }),
      stock({ itemId: "ward_shard", price: 280, source: "sealed rumor", minimumStanding: 4, description: "Restricted ward shard." }),
    ],
  },
  east: {
    cityId: "east",
    name: "Industrial Backchannel",
    summary: "Ironhall does not advertise sabotage parts, because it has at least some standards.",
    minimumStanding: 4,
    requiredCourses: ["practical-arithmetic", "street-survival"],
    lockReason: "Requires Practical Arithmetic, Street Survival, and 4 Ironhall standing.",
    stock: [
      stock({ itemId: "gear_cogs", price: 155, source: "backchannel", description: "Precision cogs with no invoice." }),
      stock({ itemId: "tempered_steel", price: 365, source: "backchannel", minimumStanding: 4, description: "Tempered stock from an unofficial bench." }),
    ],
  },
  south: {
    cityId: "south",
    name: "Quiet Influence Desk",
    summary: "Highcourt's under-market is influence, introductions, and paperwork with strategic omissions.",
    minimumStanding: 4,
    requiredCourses: ["civic-fundamentals"],
    lockReason: "Requires Civic Fundamentals and 4 Highcourt standing.",
    stock: [
      stock({ itemId: "forged_seal_kit", price: 215, source: "quiet influence", description: "Risky kit wrapped in polite language." }),
      stock({ itemId: "court_token", price: 240, source: "quiet influence", minimumStanding: 4, description: "Introduction token from the wrong side of a nice desk." }),
    ],
  },
};

export function getCityMarketProfile(cityId) {
  return CITY_MARKET_PROFILES[cityId] ?? CITY_MARKET_PROFILES.nexis;
}

export function getCitySpecials(cityId) {
  return CITY_SPECIALS[cityId] ?? CITY_SPECIALS.nexis;
}

export function getCitySpecialById(specialId) {
  for (const specials of Object.values(CITY_SPECIALS)) {
    const match = specials.find((entry) => entry.id === specialId);
    if (match) return match;
  }
  return null;
}

export function getCityBlackMarket(cityId) {
  return CITY_BLACK_MARKETS[cityId] ?? CITY_BLACK_MARKETS.nexis;
}

function tradeGood({ itemId, sourceCityId, category, requiredCourses = [], sellPrices, note }) {
  return { itemId, sourceCityId, category, requiredCourses, sellPrices, note };
}

function fenceGood({ itemId, price, requiredCourses = [], minimumStanding = 0, note }) {
  return { itemId, price, requiredCourses, minimumStanding, note };
}

export const LEGAL_TRADE_GOODS = [
  tradeGood({ itemId: "healing_tonic", sourceCityId: "west", category: "Potion import", sellPrices: { nexis: 118, west: 84, north: 142, east: 110, south: 145 }, note: "Port tonics move best toward healer and court cities." }),
  tradeGood({ itemId: "restorative_elixir", sourceCityId: "west", category: "Premium potion", requiredCourses: ["world-geography"], sellPrices: { nexis: 350, west: 250, north: 410, east: 330, south: 430 }, note: "High-value imports need route literacy before vendors trust the paperwork." }),
  tradeGood({ itemId: "foreign_token", sourceCityId: "west", category: "Foreign cargo marker", requiredCourses: ["world-geography"], sellPrices: { nexis: 205, west: 130, north: 198, east: 185, south: 235 }, note: "Highcourt and Nexis clerks pay for clean foreign introductions." }),
  tradeGood({ itemId: "wild_herb", sourceCityId: "north", category: "Common herb", sellPrices: { nexis: 28, west: 34, north: 12, east: 26, south: 30 }, note: "Cheap Silverbough herbs fill basic apothecary demand elsewhere." }),
  tradeGood({ itemId: "medicinal_herb", sourceCityId: "north", category: "Medicinal herb", sellPrices: { nexis: 62, west: 78, north: 34, east: 58, south: 72 }, note: "Blackharbor crews and Highcourt clinics both pay above northern source value." }),
  tradeGood({ itemId: "rare_herb", sourceCityId: "north", category: "Rare herb", requiredCourses: ["world-geography"], sellPrices: { nexis: 145, west: 175, north: 95, east: 138, south: 165 }, note: "Rare northern stock benefits from geography-backed route confidence." }),
  tradeGood({ itemId: "relic_note", sourceCityId: "north", category: "Relic paperwork", requiredCourses: ["world-geography"], sellPrices: { nexis: 178, west: 150, north: 105, east: 160, south: 190 }, note: "Relic notes sell to archives and permit desks, not random fruit stalls. Thankfully." }),
  tradeGood({ itemId: "coal", sourceCityId: "east", category: "Forge fuel", sellPrices: { nexis: 65, west: 58, north: 72, east: 34, south: 62 }, note: "Silverbough ward boilers and Nexis workshops buy Ironhall coal above yard rates." }),
  tradeGood({ itemId: "iron_ore", sourceCityId: "east", category: "Ore", sellPrices: { nexis: 94, west: 88, north: 80, east: 50, south: 96 }, note: "Nexis and Highcourt pay more for clean Ironhall ore shipments." }),
  tradeGood({ itemId: "iron_ingot", sourceCityId: "east", category: "Refined metal", requiredCourses: ["practical-arithmetic"], sellPrices: { nexis: 158, west: 150, north: 145, east: 105, south: 174 }, note: "Ingot arbitrage requires arithmetic because metal ledgers are where hope goes to be itemized." }),
  tradeGood({ itemId: "steel_ingot", sourceCityId: "east", category: "Premium metal", requiredCourses: ["practical-arithmetic"], sellPrices: { nexis: 288, west: 270, north: 260, east: 198, south: 320 }, note: "Highcourt commissions pay heavily for trusted steel." }),
  tradeGood({ itemId: "vial_of_ink", sourceCityId: "south", category: "Legal supply", sellPrices: { nexis: 52, west: 58, north: 48, east: 44, south: 28 }, note: "Highcourt ink is cheap at court and useful everywhere bureaucracy has happened." }),
  tradeGood({ itemId: "wax_seal", sourceCityId: "south", category: "Permit supply", sellPrices: { nexis: 84, west: 82, north: 74, east: 70, south: 48 }, note: "Seals travel well to offices that ran out and are pretending they planned ahead." }),
  tradeGood({ itemId: "sealed_notice", sourceCityId: "south", category: "Formal notice", requiredCourses: ["civic-fundamentals"], sellPrices: { nexis: 165, west: 150, north: 142, east: 145, south: 98 }, note: "Formal notices are strongest in civic centers once the player understands the rules." }),
  tradeGood({ itemId: "prestige_goods", sourceCityId: "south", category: "Luxury goods", requiredCourses: ["practical-arithmetic"], sellPrices: { nexis: 525, west: 540, north: 500, east: 485, south: 350 }, note: "Luxury arbitrage is readable after practical commerce math." }),
  tradeGood({ itemId: "courier_satchel", sourceCityId: "west", category: "Travel gear", sellPrices: { nexis: 126, west: 84, north: 118, east: 122, south: 132 }, note: "Courier gear sells best where paperwork and travel collide." }),
];

export const BLACK_MARKET_FENCES = {
  nexis: [
    fenceGood({ itemId: "stolen_coin", price: 38, note: "Backroom coin buyers keep starter underworld sales small." }),
    fenceGood({ itemId: "lockpick", price: 72, note: "Simple tools move quietly in the capital." }),
    fenceGood({ itemId: "forged_document", price: 155, minimumStanding: 4, note: "Capital papers need trusted contacts." }),
  ],
  west: [
    fenceGood({ itemId: "stolen_coin", price: 55, note: "Dockside fences like portable value." }),
    fenceGood({ itemId: "lockpick_set", price: 170, note: "Underdock crews buy practical tools." }),
    fenceGood({ itemId: "forged_document", price: 185, note: "Elastic cargo papers sell well in Blackharbor." }),
    fenceGood({ itemId: "foreign_token", price: 205, note: "Foreign markers can be flipped through brokers." }),
    fenceGood({ itemId: "restorative_elixir", price: 285, minimumStanding: 2, note: "Premium import fencing requires dock trust." }),
  ],
  north: [
    fenceGood({ itemId: "ancient_fragment", price: 210, note: "Relic whispers buy fragments under the table." }),
    fenceGood({ itemId: "relic_note", price: 185, note: "Catalog notes are valuable to the wrong collectors." }),
    fenceGood({ itemId: "ward_shard", price: 245, minimumStanding: 4, note: "Restricted ward pieces need trusted scholar contacts." }),
  ],
  east: [
    fenceGood({ itemId: "gear_cogs", price: 130, note: "Unofficial benches buy precision parts." }),
    fenceGood({ itemId: "steel_brace", price: 260, minimumStanding: 4, note: "Restricted braces move through industrial side doors." }),
    fenceGood({ itemId: "tempered_steel", price: 310, minimumStanding: 4, note: "Tempered stock needs quiet forge contacts." }),
  ],
  south: [
    fenceGood({ itemId: "forged_seal_kit", price: 190, note: "Influence desks buy risky seal kits with very polite silence." }),
    fenceGood({ itemId: "forged_document", price: 210, note: "Court-adjacent false papers are valuable and dangerous." }),
    fenceGood({ itemId: "court_token", price: 260, minimumStanding: 4, note: "Introduction tokens require trusted Highcourt contacts." }),
    fenceGood({ itemId: "prestige_goods", price: 430, minimumStanding: 4, note: "Prestige goods can be liquidated through quiet noble channels." }),
  ],
};

export function getLegalTradeGoods() {
  return LEGAL_TRADE_GOODS;
}

export function getLegalTradeGood(itemId) {
  return LEGAL_TRADE_GOODS.find((entry) => entry.itemId === itemId) ?? null;
}

export function getBlackMarketFence(cityId) {
  return BLACK_MARKET_FENCES[cityId] ?? BLACK_MARKET_FENCES.nexis;
}
