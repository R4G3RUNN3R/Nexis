export const CITY_DIARIES = [
  {
    cityId: "nexis",
    cityName: "Nexis City",
    title: "Registry Diary",
    tiers: [
      { id: "nexis-easy", label: "Easy", tasks: ["Complete a civic job", "Visit the City Board", "Record a Codex entry"], reward: "+1 civic standing and Registry Initiate distinction" },
      { id: "nexis-standard", label: "Standard", tasks: ["Finish Practical Arithmetic", "Complete a local contract", "Win or finish a sparring duel"], reward: "Registry Clerk title eligibility" },
      { id: "nexis-dangerous", label: "Dangerous", tasks: ["Clear a tunnel threat", "Complete a bounty writ", "Escort a consortium ledger route"], reward: "Civic route discount and Watch notice unlocks" },
      { id: "nexis-elite", label: "Elite", tasks: ["Resolve a city-wide event", "Complete a guild operation", "Finish a Nexis DMOS one-shot"], reward: "Archivist of Nexis distinction" },
    ],
  },
  {
    cityId: "west",
    cityName: "Blackharbor",
    title: "Dock Ledger Diary",
    tiers: [
      { id: "blackharbor-easy", label: "Easy", tasks: ["Travel to Blackharbor", "Inspect a cargo notice", "Buy or sell a trade good"], reward: "+1 dock standing and Saltmarked distinction" },
      { id: "blackharbor-standard", label: "Standard", tasks: ["Complete Street Survival", "Finish a dockside contract", "Use Shadow safely"], reward: "Pier Runner title eligibility" },
      { id: "blackharbor-dangerous", label: "Dangerous", tasks: ["Complete a smuggler trace", "Win a bounty writ", "Protect or intercept a cargo route"], reward: "Blackharbor underworld notices" },
      { id: "blackharbor-elite", label: "Elite", tasks: ["Resolve a corsair event", "Complete a Blackharbor one-shot", "Earn a covert manual"], reward: "Salt Writ Keeper distinction" },
    ],
  },
  {
    cityId: "north",
    cityName: "Silverbough",
    title: "Warden Diary",
    tiers: [
      { id: "silverbough-easy", label: "Easy", tasks: ["Visit Silverbough", "Use a healing item", "Read a ward Codex entry"], reward: "+1 grove standing and Warden Witness distinction" },
      { id: "silverbough-standard", label: "Standard", tasks: ["Finish Historical Awareness", "Complete a shrine notice", "Craft or acquire a reagent"], reward: "Grove Aide title eligibility" },
      { id: "silverbough-dangerous", label: "Dangerous", tasks: ["Resolve a ward disturbance", "Complete a relic recovery", "Use magical protection in combat"], reward: "Warden contract expansion" },
      { id: "silverbough-elite", label: "Elite", tasks: ["Complete a Silverbough one-shot", "Discover a hidden grove site", "Finish a guild ward operation"], reward: "Bell-Warden distinction" },
    ],
  },
  {
    cityId: "east",
    cityName: "Ironhall",
    title: "Foundry Diary",
    tiers: [
      { id: "ironhall-easy", label: "Easy", tasks: ["Visit Ironhall", "Salvage an item", "Read a forge notice"], reward: "+1 foundry standing and Rivetmarked distinction" },
      { id: "ironhall-standard", label: "Standard", tasks: ["Craft a useful item", "Complete a material shortage contract", "Equip bludgeoning or slashing gear"], reward: "Line Hand title eligibility" },
      { id: "ironhall-dangerous", label: "Dangerous", tasks: ["Resolve a machine incident", "Complete a convoy defense", "Recover a forge wreck cache"], reward: "Bulwark set rumor unlocks" },
      { id: "ironhall-elite", label: "Elite", tasks: ["Complete an Ironhall one-shot", "Defeat a foundry elite", "Support a consortium forge route"], reward: "Furnace Marshal distinction" },
    ],
  },
  {
    cityId: "south",
    cityName: "Highcourt",
    title: "Petition Diary",
    tiers: [
      { id: "highcourt-easy", label: "Easy", tasks: ["Visit Highcourt", "Read a legal notice", "Complete a courier errand"], reward: "+1 court standing and Seal Witness distinction" },
      { id: "highcourt-standard", label: "Standard", tasks: ["Finish Civic Fundamentals", "Complete a petition task", "Gain a title"], reward: "Court Runner title eligibility" },
      { id: "highcourt-dangerous", label: "Dangerous", tasks: ["Expose a forged writ", "Win a formal duel", "Complete a prestige route escort"], reward: "Court brokerage notices" },
      { id: "highcourt-elite", label: "Elite", tasks: ["Complete a Highcourt one-shot", "Resolve a diplomatic event", "Earn a law or rhetoric manual"], reward: "Seal-Bearer distinction" },
    ],
  },
];

export const QUALITY_DEFINITIONS = [
  { id: "seen-red-bell", label: "Seen the Red Bell", type: "story", summary: "Unlocked by ward incidents and Silverbough one-shots; opens ward-related notices." },
  { id: "owes-blackharbor-favor", label: "Owes Blackharbor a Favor", type: "social", summary: "Tracks dockside bargains that can unlock shady help or future complications." },
  { id: "registry-trusted", label: "Registry Trusted", type: "civic", summary: "Earned through Nexis City civic work; improves lawful board opportunities." },
  { id: "forge-witness", label: "Forge Witness", type: "craft", summary: "Tracks involvement in Ironhall machine and foundry incidents." },
  { id: "court-recognized", label: "Court Recognized", type: "prestige", summary: "Marks a player as visible to Highcourt clerks, petitioners, and brokers." },
  { id: "bounty-marked", label: "Bounty Marked", type: "pvp", summary: "Player has generated enough PvP/criminal attention for bounty hooks." },
  { id: "dmos-veteran", label: "DMOS Veteran", type: "chronicle", summary: "Tracks completed Nexis one-shots and unlocks deeper campaign branches." },
];

export const WORLD_EVENT_TEMPLATES = [
  { id: "nexis-tunnel-raiders", cityId: "nexis", label: "Tunnel Raider Muster", cadence: "rotating", summary: "Civic guards request guild support below the registry routes.", hooks: ["Guild operation", "City Board notice", "PvP bounty spillover"] },
  { id: "blackharbor-corsair-pressure", cityId: "west", label: "Corsair Pressure", cadence: "rotating", summary: "Cargo lanes become profitable and dangerous while corsair crews test the piers.", hooks: ["Consortium route risk", "Caravan interception", "Black market notices"] },
  { id: "silverbough-wardfall", cityId: "north", label: "Wardfall", cadence: "rotating", summary: "A grove ward drops into warning state and calls for relic-aware responders.", hooks: ["Hidden site discovery", "Guild ward operation", "Healing demand"] },
  { id: "ironhall-furnace-beast", cityId: "east", label: "Furnace Beast", cadence: "timed", summary: "A foundry incident produces an elite threat and material shortage.", hooks: ["Elite hunt", "Forge materials", "Consortium supply route"] },
  { id: "highcourt-legal-emergency", cityId: "south", label: "Legal Emergency", cadence: "rotating", summary: "A contested petition creates court errands, duel pressure, and diplomatic notices.", hooks: ["Formal duel", "Courier adventure", "Prestige diary"] },
];
