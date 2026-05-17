const FIVE_MINUTES = 5 * 60 * 1000;

export const CITY_CONTRACTS = {
  nexis: [
    {
      id: "nexis-registry-errands",
      cityId: "nexis",
      title: "Registry Errand Circuit",
      type: "Civic errand",
      summary: "Carry stamped forms between the Registry, market clerks, and the watch desk before the ink dries.",
      risk: "low",
      requirementLabel: "Open to new citizens. Costs 1 stamina to complete.",
      completion: { staminaCost: 1, note: "Complete the circuit while in Nexis City." },
      reward: { gold: 55, experience: 12, items: [{ itemId: "vial_of_ink", label: "Vial of Ink", quantity: 1 }] },
      chronicle: {
        title: "First Registry Circuit",
        summary: "Completed a starter civic errand through the Nexis Registry.",
      },
    },
    {
      id: "nexis-permit-runner",
      cityId: "nexis",
      title: "Permit Runner Shift",
      type: "Permit work",
      summary: "Verify simple trade permits and deliver corrections to vendors trying to call mistakes tradition.",
      risk: "low",
      requirementLabel: "Open to citizens. General Studies improves later permit work.",
      completion: { staminaCost: 1, note: "Finish the shift at the Nexis City Board." },
      reward: { gold: 68, experience: 14 },
      chronicle: {
        title: "Permit Runner",
        summary: "Handled a clean permit shift in the starter capital.",
      },
    },
    {
      id: "nexis-watch-messenger",
      cityId: "nexis",
      title: "Watch Messenger Route",
      type: "Messenger work",
      summary: "Run a sealed notice from the watch desk to a Highcourt clerk and return with the receipt.",
      risk: "moderate",
      requirementLabel: "Travel to Highcourt and return to Nexis City before claiming.",
      completion: {
        staminaCost: 2,
        visitCityId: "south",
        visitLabel: "Highcourt",
        note: "Visit Highcourt with the packet, then return to Nexis City.",
      },
      reward: { gold: 110, experience: 24, items: [{ itemId: "wax_seal", label: "Wax Seal", quantity: 1 }] },
      chronicle: {
        title: "Watch Packet Delivered",
        summary: "Finished a cross-city messenger run between Nexis City and Highcourt.",
      },
    },
  ],
  west: [
    {
      id: "blackharbor-cargo-tally",
      cityId: "west",
      title: "Cargo Tally at Low Tide",
      type: "Dock contract",
      summary: "Count crates, check seals, and flag suspicious potion imports before the harbor books close.",
      risk: "moderate",
      requirementLabel: "Must be in Blackharbor. Costs 2 stamina to complete.",
      completion: { staminaCost: 2, note: "Complete the tally in Blackharbor's dock market." },
      reward: { gold: 96, experience: 18, items: [{ itemId: "healing_tonic", label: "Healing Tonic", quantity: 1 }] },
      chronicle: {
        title: "Blackharbor Cargo Tally",
        summary: "Worked the low-tide import tally in Blackharbor.",
      },
    },
    {
      id: "blackharbor-escort-watch",
      cityId: "west",
      title: "Pier Escort Watch",
      type: "Escort contract",
      summary: "Guard foreign goods from pier to counting room through streets full of interested strangers.",
      risk: "high",
      requirementLabel: "Escort the manifest to Highcourt and return to Blackharbor.",
      completion: {
        staminaCost: 2,
        visitCityId: "south",
        visitLabel: "Highcourt",
        note: "Visit Highcourt with the manifest, then return to Blackharbor.",
      },
      reward: { gold: 145, experience: 30, items: [{ itemId: "rations", label: "Rations", quantity: 1 }] },
      chronicle: {
        title: "Pier Escort Completed",
        summary: "Protected a Blackharbor manifest through court-road pressure.",
      },
    },
    {
      id: "blackharbor-quiet-manifest",
      cityId: "west",
      title: "Quiet Manifest Recovery",
      type: "Smuggling pressure",
      summary: "Recover a missing cargo slip without asking why everyone knows which slip it is.",
      risk: "high",
      requirementLabel: "Must be in Blackharbor. Street Survival improves future covert contracts.",
      completion: { staminaCost: 3, note: "Resolve the manifest dispute in Blackharbor." },
      reward: { gold: 170, experience: 34, items: [{ itemId: "torn_map", label: "Tattered Map", quantity: 1 }] },
      chronicle: {
        title: "Quiet Manifest Recovered",
        summary: "Recovered a Blackharbor slip that several people were pretending not to need.",
      },
    },
  ],
  north: [
    {
      id: "silverbough-herb-circle",
      cityId: "north",
      title: "Herb Circle Supply Run",
      type: "Healing supply",
      summary: "Gather, sort, and deliver field herbs for healers who can spot lazy work from across a room.",
      risk: "low",
      requirementLabel: "Must be in Silverbough. Costs 1 stamina to complete.",
      completion: { staminaCost: 1, note: "Deliver sorted herbs to the Silverbough healing circle." },
      reward: { gold: 76, experience: 16, items: [{ itemId: "medicinal_herb", label: "Medicinal Herb", quantity: 1 }] },
      chronicle: {
        title: "Herb Circle Supply",
        summary: "Helped Silverbough's healers keep their herb circle stocked.",
      },
    },
    {
      id: "silverbough-relic-rubbing",
      cityId: "north",
      title: "Relic Rubbing Intake",
      type: "Relic cataloguing",
      summary: "Deliver temple rubbings to Nexis archivists, then return them flat, dry, and mysterious.",
      risk: "moderate",
      requirementLabel: "Visit Nexis City and return to Silverbough.",
      completion: {
        staminaCost: 2,
        visitCityId: "nexis",
        visitLabel: "Nexis City",
        note: "Take the rubbings to Nexis City, then return to Silverbough.",
      },
      reward: { gold: 118, experience: 26, items: [{ itemId: "relic_note", label: "Relic Note", quantity: 1 }] },
      chronicle: {
        title: "Relic Intake Logged",
        summary: "Carried a Silverbough relic rubbing through a proper archive intake.",
      },
    },
    {
      id: "silverbough-ward-lantern",
      cityId: "north",
      title: "Ward Lantern Walk",
      type: "Ward patrol",
      summary: "Check northern-path lantern wards and report which lights flicker like they know something.",
      risk: "moderate",
      requirementLabel: "Must be in Silverbough. World Geography improves later ward routes.",
      completion: { staminaCost: 2, note: "Finish the ward walk outside Silverbough." },
      reward: { gold: 105, experience: 22, items: [{ itemId: "wild_herb", label: "Wild Herb", quantity: 2 }] },
      chronicle: {
        title: "Ward Lantern Walk",
        summary: "Logged a patrol of Silverbough's outer ward lanterns.",
      },
    },
  ],
  east: [
    {
      id: "ironhall-ore-yard",
      cityId: "east",
      title: "Ore Yard Haul",
      type: "Material haul",
      summary: "Move ore, coal, and rivets between yard scales and forge benches without inventing injuries.",
      risk: "moderate",
      requirementLabel: "Must be in Ironhall. Manual Labor improves later forge work.",
      completion: { staminaCost: 2, note: "Finish the haul inside Ironhall's ore yard." },
      reward: { gold: 90, experience: 18, items: [{ itemId: "iron_ore", label: "Iron Ore", quantity: 2 }] },
      chronicle: {
        title: "Ore Yard Haul",
        summary: "Took a first paid shift in Ironhall's material yards.",
      },
    },
    {
      id: "ironhall-forge-order",
      cityId: "east",
      title: "Forge Order Rush",
      type: "Craft contract",
      summary: "Run order slips between smiths, armor fitters, and component lockers before the shouting starts.",
      risk: "low",
      requirementLabel: "Must be in Ironhall. Practical Arithmetic unlocks better ledger work.",
      completion: { staminaCost: 1, note: "Close the rush order at the Foundry counter." },
      reward: { gold: 82, experience: 17, items: [{ itemId: "coal", label: "Coal", quantity: 1 }] },
      chronicle: {
        title: "Forge Order Closed",
        summary: "Kept an Ironhall forge order moving before the benches jammed.",
      },
    },
    {
      id: "ironhall-bridge-brace",
      cityId: "east",
      title: "Bridge Brace Repair",
      type: "Repair crew",
      summary: "Inspect road braces on the forge route where every loose bolt has ambitions.",
      risk: "moderate",
      requirementLabel: "Visit Nexis City for city permit bolts, then return to Ironhall.",
      completion: {
        staminaCost: 2,
        visitCityId: "nexis",
        visitLabel: "Nexis City",
        note: "Fetch permit bolts from Nexis City, then return to Ironhall.",
      },
      reward: { gold: 125, experience: 27, items: [{ itemId: "rope", label: "Rope", quantity: 1 }] },
      chronicle: {
        title: "Bridge Brace Crew",
        summary: "Supported a forge-road repair crew out of Ironhall.",
      },
    },
  ],
  south: [
    {
      id: "highcourt-seal-filing",
      cityId: "south",
      title: "Seal Filing Queue",
      type: "Legal filing",
      summary: "File permit seals, log petition references, and learn why patience counts as civic ammunition.",
      risk: "low",
      requirementLabel: "Must be in Highcourt. Civic Fundamentals unlocks better filings.",
      completion: { staminaCost: 1, note: "Finish the filing queue at Highcourt." },
      reward: { gold: 88, experience: 17, items: [{ itemId: "wax_seal", label: "Wax Seal", quantity: 1 }] },
      chronicle: {
        title: "Highcourt Filing",
        summary: "Survived a Highcourt seal filing queue with dignity mostly intact.",
      },
    },
    {
      id: "highcourt-archive-delivery",
      cityId: "south",
      title: "Archive Delivery in Triplicate",
      type: "Archive delivery",
      summary: "Carry court archives between offices while each duplicate finds exactly the suspicious clerk it deserves.",
      risk: "low",
      requirementLabel: "Visit Nexis City archive intake, then return to Highcourt.",
      completion: {
        staminaCost: 2,
        visitCityId: "nexis",
        visitLabel: "Nexis City",
        note: "Visit Nexis City archive intake, then return to Highcourt.",
      },
      reward: { gold: 120, experience: 25, items: [{ itemId: "vial_of_ink", label: "Vial of Ink", quantity: 1 }] },
      chronicle: {
        title: "Archive Delivery",
        summary: "Completed a Highcourt archive delivery without losing any duplicate paperwork.",
      },
    },
    {
      id: "highcourt-diplomatic-escort",
      cityId: "south",
      title: "Diplomatic Escort Note",
      type: "Prestige errand",
      summary: "Escort a minor envoy across the permit district, which is mostly walking slowly near expensive arguments.",
      risk: "moderate",
      requirementLabel: "Must be in Highcourt. Rhetoric will deepen this route later.",
      completion: { staminaCost: 2, note: "Close the escort note in Highcourt's permit district." },
      reward: { gold: 132, experience: 29 },
      chronicle: {
        title: "Diplomatic Escort",
        summary: "Handled a first Highcourt prestige errand among the permit offices.",
      },
    },
  ],
};

export const CITY_ACADEMIES = {
  nexis: {
    id: "nexis-hall-of-letters",
    cityId: "nexis",
    name: "Hall of Letters",
    theme: "Civic administration, watch procedure, public law, and practical city operations.",
    entryRequirements: ["Be present in Nexis City", "Open to all registered citizens"],
    requiredCourses: [],
    lockReason: "Travel to Nexis City to study here.",
    durationMs: FIVE_MINUTES,
    progressionSupports: ["Civic Jobs", "permits", "city board work", "organization administration"],
    reward: {
      experience: 28,
      workingStats: { intelligence: 1 },
      flags: ["academy_nexis_letters_intro"],
    },
    chronicle: {
      title: "Entered the Hall of Letters",
      summary: "Started practical civic study in Nexis City's Hall of Letters.",
      completionTitle: "Hall of Letters Primer",
      completionSummary: "Completed the first Hall of Letters primer for city administration.",
    },
  },
  west: {
    id: "blackharbor-tidewright-academy",
    cityId: "west",
    name: "Tidewright Academy",
    theme: "Maritime routing, covert manifests, corsair law, and cargo-risk judgment.",
    entryRequirements: ["Be present in Blackharbor", "Complete World Geography"],
    requiredCourses: ["world-geography"],
    lockReason: "World Geography is required before the docks trust your route judgment.",
    durationMs: FIVE_MINUTES,
    progressionSupports: ["sea routes", "cargo contracts", "black-market reads", "consortium logistics"],
    reward: {
      experience: 34,
      workingStats: { endurance: 1 },
      flags: ["academy_blackharbor_tidewright_intro"],
    },
    chronicle: {
      title: "Tidewright Enrollment",
      summary: "Joined Blackharbor's Tidewright Academy for port-route handling.",
      completionTitle: "Tidewright Primer",
      completionSummary: "Completed a first Blackharbor primer on tides, cargo, and quiet manifests.",
    },
  },
  north: {
    id: "silverbough-argent-bough-lyceum",
    cityId: "north",
    name: "Argent Bough Lyceum",
    theme: "Arcane field ethics, healing theory, ward literacy, and relic handling.",
    entryRequirements: ["Be present in Silverbough", "Complete World Geography"],
    requiredCourses: ["world-geography"],
    lockReason: "World Geography is required before Silverbough's outer wards open to you.",
    durationMs: FIVE_MINUTES,
    progressionSupports: ["healing jobs", "relic contracts", "ward patrols", "discovery events"],
    reward: {
      experience: 34,
      workingStats: { intelligence: 1 },
      flags: ["academy_silverbough_lyceum_intro"],
    },
    chronicle: {
      title: "Argent Bough Enrollment",
      summary: "Entered Silverbough's Lyceum for ward and relic basics.",
      completionTitle: "Argent Bough Primer",
      completionSummary: "Completed a first Silverbough primer in ward literacy and healing theory.",
    },
  },
  east: {
    id: "ironhall-enginewright-hall",
    cityId: "east",
    name: "Enginewright Hall",
    theme: "Forge discipline, war-school basics, enginewright ledgers, and material planning.",
    entryRequirements: ["Be present in Ironhall", "Complete Practical Arithmetic"],
    requiredCourses: ["practical-arithmetic"],
    lockReason: "Practical Arithmetic is required before Ironhall lets you touch serious ledgers.",
    durationMs: FIVE_MINUTES,
    progressionSupports: ["forge contracts", "material markets", "repair work", "industrial consortium loops"],
    reward: {
      experience: 36,
      workingStats: { manualLabor: 1 },
      battleStats: { strength: 1 },
      flags: ["academy_ironhall_enginewright_intro"],
    },
    chronicle: {
      title: "Enginewright Enrollment",
      summary: "Took a first seat in Ironhall's Enginewright Hall.",
      completionTitle: "Enginewright Primer",
      completionSummary: "Completed a first Ironhall primer on material ledgers and forge discipline.",
    },
  },
  south: {
    id: "highcourt-college-of-civic-law",
    cityId: "south",
    name: "College of Civic Law",
    theme: "Rhetoric, civic law, statecraft, diplomacy, and prestige administration.",
    entryRequirements: ["Be present in Highcourt", "Complete Civic Fundamentals"],
    requiredCourses: ["civic-fundamentals"],
    lockReason: "Civic Fundamentals is required before Highcourt accepts your petitions as study material.",
    durationMs: FIVE_MINUTES,
    progressionSupports: ["legal filings", "prestige markets", "permits", "diplomatic errands"],
    reward: {
      experience: 36,
      workingStats: { intelligence: 1 },
      flags: ["academy_highcourt_civic_law_intro"],
    },
    chronicle: {
      title: "Civic Law Enrollment",
      summary: "Entered Highcourt's College of Civic Law for statecraft basics.",
      completionTitle: "Civic Law Primer",
      completionSummary: "Completed a first Highcourt primer in law, rhetoric, and permits.",
    },
  },
};

export function getCityContracts(cityId) {
  return CITY_CONTRACTS[cityId] ?? CITY_CONTRACTS.nexis;
}

export function getCityContract(contractId) {
  for (const contracts of Object.values(CITY_CONTRACTS)) {
    const contract = contracts.find((entry) => entry.id === contractId);
    if (contract) return contract;
  }
  return null;
}

export function getCityAcademy(cityId) {
  return CITY_ACADEMIES[cityId] ?? CITY_ACADEMIES.nexis;
}

export function getAcademyById(academyId) {
  return Object.values(CITY_ACADEMIES).find((academy) => academy.id === academyId) ?? null;
}
