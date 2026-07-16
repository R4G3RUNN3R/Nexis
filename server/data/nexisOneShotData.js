export const NEXIS_ONE_SHOT_ENGINE = "dmos-nexis-fixed-v1";

export const DMOS_NEXIS_DIRECTIVE = [
  "You are the DMOS engine running a Nexis one-shot campaign.",
  "Nexis is a fantasy civic, mercantile, arcane world of cities, guilds, consortiums, hidden sites, archives, and hard-gated progression.",
  "Run short bounded one-shot scenes only. Present fixed choices with fixed outcomes supplied by Nexis.",
  "Use the character snapshot, current city, title, guild, consortium, life path, education, and discoveries to frame the scene.",
  "Never grant rewards directly. Nexis validates XP, gold, items, titles, records, and achievements after completion.",
  "Keep tone grounded, dangerous, civic, mercantile, and arcane. No jokes, memes, or impossible promises.",
].join("\n");

const DURATION_BY_CATEGORY = {
  "Local Contract": 15,
  "Archive Mystery": 18,
  "Fixed Heist": 20,
  "Sealed Incident": 22,
  "Hidden Site Run": 24,
  "Bounded Delve": 25,
  "Cargo Scheme": 18,
  "Board Hunt": 20,
  "Field Expedition": 24,
  "Arcane Mishap": 20,
  "Faction Incident": 22,
  "Relic Recovery": 25,
};

const REWARD_TAG_LABELS = {
  civic: "civic",
  focus: "arcane/focus",
  covert: "covert",
  travel: "travel",
  healing: "healing",
};

const REWARDS = {
  civic: { gold: 110, experience: 85, items: [{ itemId: "field_bandage", quantity: 1 }] },
  focus: { gold: 95, experience: 100, items: [{ itemId: "focus_draught", quantity: 1 }] },
  covert: { gold: 125, experience: 90, items: [{ itemId: "smoke_pellet", quantity: 1 }] },
  travel: { gold: 100, experience: 90, items: [{ itemId: "rations", quantity: 2 }] },
  healing: { gold: 90, experience: 95, items: [{ itemId: "healing_tonic", quantity: 1 }] },
};

const HANDWRITTEN_CAMPAIGN_SPECS = [
  {
    id: "nexis-registry-door",
    cityId: "nexis",
    title: "The Registry Door That Was Never Filed",
    theme: "civic intrigue",
    region: "Nexis City",
    summary: "A sealed archive room appears in the civic registry without any record that it was built.",
    openingTitle: "A door under the registry steps",
    opening: "A clerk with ink on both sleeves leads you beneath the Registry Hall. A bronze door waits where a blank wall stood yesterday, its lock stamped with a seal no current office claims.",
    openingChoices: [
      ["question_clerk", "Question the clerk before touching the seal", "The clerk admits the seal belongs to an abolished permit office."],
      ["inspect_seal", "Inspect the bronze seal directly", "The seal is real, but too clean. It was pressed this week using a die that should be locked in the Archive vault."],
      ["post_watch", "Post a quiet watch at the stairwell", "Your caution catches a runner trying to slip away with a bundle of fresh permits."],
    ],
    decisionTitle: "The abolished office",
    decision: "Beyond the door, ledger shelves glow with cold blue ward-light. Three ledgers sit open: one records names, one records debts, and one records future arrests.",
    finalChoices: [
      ["take_names", "Secure the names ledger", "You exposed a dead civic office being used to file living permits and secured the names ledger before the ring could scatter.", "civic", ["civic", "nexis", "archive"]],
      ["break_future_arrests", "Break the future-arrest ledger", "You destroyed an unlawful arrest ledger and forced the Registry to admit that someone was writing crimes before they happened.", "focus", ["justice", "nexis", "ward"]],
    ],
  },
  {
    id: "blackharbor-salt-writ",
    cityId: "west",
    title: "The Salt Writ Below Pier Nine",
    theme: "dockside contraband",
    region: "Blackharbor",
    summary: "A smuggler writ resurfaces beneath Pier Nine, naming a cargo nobody admits exists.",
    openingTitle: "Low tide under Pier Nine",
    opening: "Blackharbor lowers its voice at low tide. A tarred courier box is wedged beneath Pier Nine, marked by a salt writ and guarded by people pretending not to watch it.",
    openingChoices: [
      ["watch_watchers", "Watch the watchers first", "Two watchers are dock muscle. The third is dressed like a customs clerk and carries a blade too fine for paperwork."],
      ["cut_box_free", "Cut the box free immediately", "The rope parts cleanly, but the tide pulls hard. You reach the ladder as a shout rolls down the dock."],
      ["buy_silence", "Pay a dockhand for the quiet version", "The dockhand takes the coin and points to a second mark: the writ is a decoy, but the decoy is still valuable."],
    ],
    decisionTitle: "The cargo nobody owns",
    decision: "Inside the box is a half-burned manifest, a sealed vial, and a route mark for a ship that has not docked in three years.",
    finalChoices: [
      ["sell_manifest", "Hand the manifest to a legitimate broker", "You recovered the Salt Writ manifest under Pier Nine and moved it through a legitimate broker before the dock crews closed ranks.", "travel", ["blackharbor", "market", "cargo"]],
      ["keep_vial", "Keep the sealed vial and burn the route mark", "You erased a ghost route under Blackharbor and kept the one thing the smugglers had hidden from their own manifest.", "covert", ["blackharbor", "shadow", "contraband"]],
    ],
  },
  {
    id: "silverbough-root-bell",
    cityId: "north",
    title: "The Warden Bell in the Root",
    theme: "ward failure",
    region: "Silverbough",
    summary: "A root-bell rings beneath a silent shrine grove, but no warden admits to hearing it.",
    openingTitle: "A bell without sound",
    opening: "The shrine grove looks peaceful until every bird faces the same root. Beneath it, a silver bell swings without making a sound.",
    openingChoices: [
      ["touch_root", "Place a hand on the root", "The root is fever-warm. The bell is ringing inside the ward where only broken things can hear it."],
      ["trace_moss", "Trace the moss line around the shrine", "The moss line forms a boundary, then a warning, then a map. Something entered the grove from below."],
      ["call_witness", "Call for a second witness before acting", "A junior warden arrives pale and honest. She has heard the bell for three nights and was told to call it wind."],
    ],
    decisionTitle: "Below the shrine line",
    decision: "Under the root is a cracked ward-stone and a folded petition asking that the failure be hidden until festival week ends.",
    finalChoices: [
      ["mend_stone", "Mend the ward-stone enough to hold", "You answered the silent root-bell of Silverbough and restored a cracked ward before the grove failure spread.", "healing", ["silverbough", "ward", "healing"]],
      ["file_petition", "File the hidden petition publicly", "You brought a hidden Silverbough ward failure into public record and forced the Conservatory to repair what it wanted buried.", "focus", ["silverbough", "record", "academy"]],
    ],
  },
  {
    id: "ironhall-furnace-ledger",
    cityId: "east",
    title: "The Furnace Ledger",
    theme: "forge incident",
    region: "Ironhall",
    summary: "A foundry machine keeps working after its crew signs out, and the output does not match any order.",
    openingTitle: "The foundry after bell",
    opening: "Ironhall should be quieter after the work bell. It is not. A furnace line keeps cycling, stamping blank plates with an obsolete machine mark.",
    openingChoices: [
      ["stop_line", "Stop the furnace line at the control wheel", "The wheel burns your glove but turns. The line slows enough to reveal a second feed belt under slag covers."],
      ["follow_feed", "Follow the hidden feed belt", "The belt leads to a sealed bin of reclaimed armor plates, each scraped clean of its original owner mark."],
      ["wake_foreman", "Wake the foreman and demand the ledger", "The foreman arrives furious, then frightened. The ledger in his hand is blank for tonight's shift."],
    ],
    decisionTitle: "Plates without owners",
    decision: "The blank plates are being prepared for a private security order outside official foundry contracts.",
    finalChoices: [
      ["secure_bin", "Secure the bin and tag every plate", "You stopped an Ironhall furnace line producing unregistered armor plates and forced the output into public count.", "civic", ["ironhall", "forge", "security"]],
      ["trace_buyer", "Trace the buyer mark before reporting", "You traced the hidden buyer behind Ironhall's blank-plate order before the foundry could claim a clerical accident.", "travel", ["ironhall", "consortium", "ledger"]],
    ],
  },
  {
    id: "highcourt-sealed-petition",
    cityId: "south",
    title: "The Sealed Petition",
    theme: "court conspiracy",
    region: "Highcourt",
    summary: "A sealed petition arrives bearing three legal signatures, only two of which belong to living people.",
    openingTitle: "The third signature",
    opening: "Highcourt's petition hall smells of wax, linen, and controlled panic. The third signature on the sealed petition is perfect, old, and impossible.",
    openingChoices: [
      ["test_wax", "Test the wax before opening it", "The wax is fresh, but the imprint is copied from a funeral seal. Someone wanted the dead to authorize the living."],
      ["summon_bailiff", "Summon a bailiff before witnesses leave", "The bailiff blocks the outer door. A witness suddenly remembers an urgent appointment elsewhere and fails to reach it."],
      ["read_publicly", "Read the petition aloud in the hall", "The hall hears every clause. Half the witnesses look offended. The other half look relieved secrecy failed first."],
    ],
    decisionTitle: "The legal shape of fraud",
    decision: "The petition would transfer a disputed route charter to a court brokerage at midnight, using a signature borrowed from a grave.",
    finalChoices: [
      ["void_petition", "Void the petition on record", "You voided a forged Highcourt petition before it could transfer a route charter under a dead signature.", "focus", ["highcourt", "law", "route"]],
      ["bait_broker", "Let the broker arrive and expose the buyer", "You baited the Highcourt broker behind a forged petition and caught the buyer arriving with a receipt for stolen law.", "covert", ["highcourt", "broker", "prestige"]],
    ],
  },
];

function buildCampaign(spec) {
  const startSceneId = `${spec.id}-opening`;
  const decisionSceneId = `${spec.id}-decision`;
  const category = spec.category ?? spec.theme;
  const rewardTags = Array.from(new Set((spec.finalChoices ?? []).map((choice) => choice[3]).filter((tag) => typeof tag === "string" && tag.trim())));
  const rewardLabels = rewardTags.map((tag) => REWARD_TAG_LABELS[tag] ?? tag);
  return {
    id: spec.id,
    cityId: spec.cityId,
    title: spec.title,
    theme: spec.theme,
    category,
    durationMinutes: spec.durationMinutes ?? DURATION_BY_CATEGORY[category] ?? 20,
    rewardTags,
    region: spec.region,
    summary: spec.summary,
    rewardPreview: `XP, gold, ${rewardLabels.length ? rewardLabels.join("/") : "useful"} supplies, and a permanent Chronicle record.`,
    startSceneId,
    scenes: {
      [startSceneId]: {
        id: startSceneId,
        title: spec.openingTitle,
        narration: spec.opening,
        choices: spec.openingChoices.map(([id, label, narration]) => ({ id, label, narration, nextSceneId: decisionSceneId, tags: [spec.theme] })),
      },
      [decisionSceneId]: {
        id: decisionSceneId,
        title: spec.decisionTitle,
        narration: spec.decision,
        choices: spec.finalChoices.map(([id, label, summary, rewardKey, tags]) => ({
          id,
          label,
          conclusion: {
            outcome: summary,
            chronicleSummary: summary,
            reward: REWARDS[rewardKey] ?? REWARDS.civic,
            recordTags: tags,
          },
        })),
      },
    },
  };
}


const CITY_PROFILES = [
  {
    id: "nexis",
    region: "Nexis City",
    institution: "Registry Hall",
    authority: "civic wardens",
    underbelly: "permit brokers",
    site: "old transit tunnels",
    relic: "bronze civic seal",
    publicRole: "registry clerk",
    threat: "fraudulent offices and tunnel crews",
    material: "wax, stamped bronze, and courier slips",
    cityAdjective: "Registry",
  },
  {
    id: "west",
    region: "Blackharbor",
    institution: "Harbormaster's House",
    authority: "dock inspectors",
    underbelly: "smuggler captains",
    site: "salt-black piers",
    relic: "tarred cargo writ",
    publicRole: "dock factor",
    threat: "contraband rings and corsair pressure",
    material: "salt rope, black sailcloth, and locked crates",
    cityAdjective: "Salt",
  },
  {
    id: "north",
    region: "Silverbough",
    institution: "Warden Conservatory",
    authority: "grove wardens",
    underbelly: "relic poachers",
    site: "root-lit shrine paths",
    relic: "silver ward bell",
    publicRole: "junior warden",
    threat: "ward failures and relic sickness",
    material: "moss, silver thread, and sealed herb jars",
    cityAdjective: "Grove",
  },
  {
    id: "east",
    region: "Ironhall",
    institution: "Foundry Ledger Office",
    authority: "forge marshals",
    underbelly: "scrap syndicates",
    site: "slag service galleries",
    relic: "rivet-marked machine plate",
    publicRole: "line foreman",
    threat: "unregistered foundry work and machine incidents",
    material: "slag dust, rivets, and heat-scored plates",
    cityAdjective: "Furnace",
  },
  {
    id: "south",
    region: "Highcourt",
    institution: "Petition Hall",
    authority: "court bailiffs",
    underbelly: "quiet brokers",
    site: "sealed galleries",
    relic: "funeral-wax petition seal",
    publicRole: "legal clerk",
    threat: "forged petitions and prestige blackmail",
    material: "linen writs, red wax, and court ribbons",
    cityAdjective: "Court",
  },
];

const ADVENTURE_ARCHETYPES = [
  { key: "local-threat", category: "Local Contract", theme: "local pressure", titleCore: "Trouble", focus: "a familiar street problem that has grown teeth", rewardKey: "civic", pressure: "public confidence is fraying", danger: "street blades and bad paperwork" },
  { key: "archive-mystery", category: "Archive Mystery", theme: "record mystery", titleCore: "Index", focus: "a record that opens a case instead of closing one", rewardKey: "focus", pressure: "someone wants the old page destroyed", danger: "wards, locked rooms, and false witnesses" },
  { key: "ledger-heist", category: "Fixed Heist", theme: "ledger heist", titleCore: "Ledger", focus: "a stolen document with more value than coin", rewardKey: "covert", pressure: "the window to recover it is narrow", danger: "lookouts, decoys, and private guards" },
  { key: "sealed-horror", category: "Sealed Incident", theme: "contained horror", titleCore: "Seal", focus: "a sealed place that should have stayed quiet", rewardKey: "healing", pressure: "the containment mark is weakening", danger: "fear, infection, and ward backlash" },
  { key: "hidden-ruin", category: "Hidden Site Run", theme: "ruin survey", titleCore: "Ruin", focus: "a buried site exposed by bad weather and worse decisions", rewardKey: "travel", pressure: "other crews are already moving", danger: "unstable stone and territorial scavengers" },
  { key: "classic-delve", category: "Bounded Delve", theme: "small dungeon", titleCore: "Depth", focus: "a compact descent with a clear prize and a short clock", rewardKey: "civic", pressure: "the entrance will not stay open", danger: "traps, narrow fighting, and bad air" },
  { key: "coastal-scheme", category: "Cargo Scheme", theme: "cargo intrigue", titleCore: "Cargo", focus: "cargo that changed owners without ever moving", rewardKey: "travel", pressure: "the manifest expires at dusk", danger: "ambushes, bribes, and hidden cargo marks" },
  { key: "board-hunt", category: "Board Hunt", theme: "posted threat", titleCore: "Notice", focus: "a public notice that understates the real danger", rewardKey: "civic", pressure: "the next victim is predictable", danger: "a prepared local predator" },
  { key: "survival-clock", category: "Field Expedition", theme: "survival clock", titleCore: "March", focus: "a short route where time is the real enemy", rewardKey: "travel", pressure: "supplies and daylight are both running thin", danger: "exposure, wrong turns, and hostile watchers" },
  { key: "arcane-accident", category: "Arcane Mishap", theme: "magical accident", titleCore: "Spark", focus: "an experiment or ward behaving like it has opinions", rewardKey: "focus", pressure: "the effect is spreading in measured pulses", danger: "misfires, illusions, and unstable residue" },
  { key: "faction-hostage", category: "Faction Incident", theme: "hostage bargain", titleCore: "Bargain", focus: "a hostage or witness caught between respectable rivals", rewardKey: "covert", pressure: "both sides are rewriting the story", danger: "split loyalties and staged rescue attempts" },
  { key: "relic-trial", category: "Relic Recovery", theme: "relic test", titleCore: "Relic", focus: "a useful relic that judges procedure before worthiness", rewardKey: "healing", pressure: "a careless claimant could ruin it for everyone", danger: "ritual errors and impatient thieves" },
];

const VARIANT_SEEDS = [
  { key: "glass-witness", titleLead: "Glass Witness", object: "a glass witness token", clue: "a reflection that shows yesterday's room", actor: "a witness who remembers two versions of the same hour", twist: "the honest testimony is split between two impossible accounts" },
  { key: "dead-route", titleLead: "Dead Route", object: "a route mark assigned to a road no longer on the map", clue: "a mile-stone rubbing with fresh mud on it", actor: "a courier who swears the road still answered", twist: "the route is real only when someone has already paid the toll" },
  { key: "red-bell", titleLead: "Red Bell", object: "a warning bell wrapped in red thread", clue: "a bell note written before the bell was cast", actor: "an apprentice ordered to deny the alarm", twist: "silence is part of the alarm, not proof that nothing happened" },
  { key: "mask-debt", titleLead: "Masked Debt", object: "a debt mask passed between three hands", clue: "a signature hidden inside the mask seam", actor: "a broker whose public face is legally innocent", twist: "the debt belongs to an office rather than a person" },
  { key: "ash-engine", titleLead: "Ash Engine", object: "a small engine coughing warm ash", clue: "ash settling in the shape of a boundary map", actor: "a repair crew paid not to fix the cause", twist: "the engine is preserving evidence by refusing to stop" },
];

function generatedTitle(city, archetype, seed) {
  return `The ${city.cityAdjective} ${seed.titleLead} ${archetype.titleCore}`;
}

function buildGeneratedChoices(city, archetype, seed, decisionSceneId) {
  return [
    ["read_the_trace", `Study ${seed.clue}`, `You read ${seed.clue} before anyone can sweep it aside. The lead points toward ${city.institution}, but not cleanly.`],
    ["question_the_contact", `Question the ${city.publicRole}`, `The ${city.publicRole} gives you a careful answer, then a useful one. ${seed.actor} is now the center of the matter.`],
    ["watch_the_site", `Set watch near ${city.site}`, `You keep the scene quiet long enough to spot a second hand in the work: ${city.underbelly} are circling the same evidence.`],
  ].map(([id, label, narration]) => [id, label, narration]);
}

function buildGeneratedFinalChoices(city, archetype, seed) {
  return [
    [
      "secure_public_record",
      `Secure the evidence through ${city.authority}`,
      `You resolved ${generatedTitle(city, archetype, seed)} by preserving ${seed.object} through ${city.authority}, exposing ${archetype.focus} before ${city.threat} could bury the trail.`,
      archetype.rewardKey,
      [city.id, archetype.key, seed.key, "public-record"],
    ],
    [
      "follow_hidden_actor",
      `Follow ${seed.actor}`,
      `You resolved ${generatedTitle(city, archetype, seed)} by following ${seed.actor} through ${city.site}, proving that ${seed.twist}.`,
      archetype.key === "ledger-heist" || archetype.key === "faction-hostage" ? "covert" : archetype.rewardKey,
      [city.id, archetype.key, seed.key, "hidden-actor"],
    ],
  ];
}

function buildGeneratedCampaignSpec(city, archetype, seed) {
  const id = `${city.id}-${archetype.key}-${seed.key}`;
  return {
    id,
    cityId: city.id,
    title: generatedTitle(city, archetype, seed),
    theme: archetype.theme,
    category: archetype.category,
    region: city.region,
    summary: `${city.region} reports ${seed.object} tied to ${archetype.focus}.`,
    openingTitle: `${seed.titleLead} in ${city.region}`,
    opening: `A ${city.publicRole} brings you ${seed.object} wrapped in ${city.material}. The first report says ${archetype.focus}; the second, quieter report says ${archetype.pressure}.`,
    openingChoices: buildGeneratedChoices(city, archetype, seed),
    decisionTitle: `${archetype.titleCore} under pressure`,
    decision: `The trail leads through ${city.site}. You find ${seed.clue}, signs of ${city.threat}, and proof that the immediate danger is ${archetype.danger}. The useful truth is worse: ${seed.twist}.`,
    finalChoices: buildGeneratedFinalChoices(city, archetype, seed),
  };
}

const GENERATED_CAMPAIGN_SPECS = CITY_PROFILES.flatMap((city) =>
  ADVENTURE_ARCHETYPES.flatMap((archetype) =>
    VARIANT_SEEDS.map((seed) => buildGeneratedCampaignSpec(city, archetype, seed)),
  ),
);

const CAMPAIGN_SPECS = [...HANDWRITTEN_CAMPAIGN_SPECS, ...GENERATED_CAMPAIGN_SPECS];

export const ONE_SHOT_CAMPAIGNS = CAMPAIGN_SPECS.map(buildCampaign);

export function getOneShotCampaigns() {
  return ONE_SHOT_CAMPAIGNS;
}

export function getOneShotCampaign(campaignId) {
  return ONE_SHOT_CAMPAIGNS.find((campaign) => campaign.id === campaignId) ?? null;
}

export function getOneShotCampaignForCity(cityId) {
  return ONE_SHOT_CAMPAIGNS.find((campaign) => campaign.cityId === cityId) ?? ONE_SHOT_CAMPAIGNS[0];
}
