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

// Base (common-grade) reward per tag. Higher grades scale gold/xp via
// ONE_SHOT_GRADE_PROFILE and swap the item pool via REWARD_POOLS - see
// buildRewardForTag() below. Kept as the grade-1 baseline so the numbers a
// designer tunes here still mean something at every tier, not just common.
const BASE_REWARD_BY_TAG = {
  civic: { gold: 110, experience: 85 },
  focus: { gold: 95, experience: 100 },
  covert: { gold: 125, experience: 90 },
  travel: { gold: 100, experience: 90 },
  healing: { gold: 90, experience: 95 },
};

// Mirrors server/data/excursionData.js's GRADE_PROFILE pattern: grade only
// tunes multipliers/item count, the tag-specific pool (REWARD_POOLS) still
// defines what's actually available at that grade. Six tiers matching the
// canonical rarityRank in server/services/marketplaceService.js.
const ONE_SHOT_GRADE_PROFILE = {
  common: { goldMultiplier: 1, xpMultiplier: 1, itemCount: 1 },
  uncommon: { goldMultiplier: 1.3, xpMultiplier: 1.2, itemCount: 1 },
  rare: { goldMultiplier: 1.7, xpMultiplier: 1.4, itemCount: 1 },
  epic: { goldMultiplier: 2.3, xpMultiplier: 1.8, itemCount: 2 },
  legendary: { goldMultiplier: 3, xpMultiplier: 2.3, itemCount: 2 },
  mythic: { goldMultiplier: 4, xpMultiplier: 3, itemCount: 2 },
};

function getGradeProfile(grade) {
  return ONE_SHOT_GRADE_PROFILE[grade] ?? ONE_SHOT_GRADE_PROFILE.common;
}

// Real items from server/data/itemData.js's 180-item catalog, grouped by the
// same tag categories the old flat REWARDS table used, one pool per rarity
// tier. No new items - reuses what's already priced/balanced in the economy.
const REWARD_POOLS = {
  civic: {
    common: ["courier_satchel", "sealed_notice", "wax_seal"],
    uncommon: ["registrar_seal", "oath_guard_insignia", "forged_permit"],
    rare: ["relic_appraisal_docket", "siege_knot_folio", "monster_trackers_slate"],
    epic: ["registry_glass_index", "compiled_skill_manual"],
    legendary: ["bastion_writwork", "concordant_shard"],
    mythic: ["absolute_story_fragment"],
  },
  focus: {
    common: ["focus_draught", "vial_of_ink", "ledger_page"],
    uncommon: ["spark_focus", "arcane_ink", "relic_note"],
    rare: ["moon_resin", "spell_text_fragment", "ancient_fragment"],
    epic: ["wardglass_splinter", "moonward_core"],
    legendary: ["argent_spire_focus", "frostward_laminate"],
    mythic: ["absolute_script_leaf"],
  },
  covert: {
    common: ["smoke_pellet", "rope_kit"],
    uncommon: ["lockpick_set", "poison_vial", "shadow_cloak"],
    rare: ["smugglers_folded_route", "corsair_relic_piece"],
    epic: ["crowlantern_smoke_charge", "saltsteel_flake"],
    legendary: ["blackwake_keelmark"],
    mythic: ["absolute_relic_shard"],
  },
  travel: {
    common: ["rations", "lantern", "cargo_seals"],
    uncommon: ["foreign_token", "corsair_boots"],
    rare: ["watch_drill_book", "dockside_training_book", "monster_trackers_slate"],
    epic: ["blueglass_navigation_lens", "blueglass_splinter"],
    legendary: ["sunmetal_grit", "cold_iron_scale"],
    mythic: ["absolute_story_fragment"],
  },
  healing: {
    common: ["healing_tonic", "field_bandage", "medicinal_herb"],
    uncommon: ["restorative_elixir", "healing_root", "rare_herb"],
    rare: ["moonmilk_cordial", "nullsalt_pouch", "grove_field_book"],
    epic: ["watchglass_aegis_plate", "moonward_core"],
    legendary: ["frostward_laminate", "concordant_vestment"],
    mythic: ["absolute_script_leaf"],
  },
};

function getRewardPool(tag, grade) {
  const byGrade = REWARD_POOLS[tag] ?? REWARD_POOLS.civic;
  return byGrade[grade] ?? byGrade.common ?? [];
}

// Small deterministic string hash (djb2 variant) - used to pick a title
// template and reward items per campaign id. Deliberately not Math.random():
// the catalog must stay stable across server restarts and diff cleanly in
// git when a single campaign spec changes.
function hashString(value, seedOffset = 0) {
  let hash = 5381 + seedOffset;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

function buildRewardForTag(tag, campaignId, grade) {
  const base = BASE_REWARD_BY_TAG[tag] ?? BASE_REWARD_BY_TAG.civic;
  const profile = getGradeProfile(grade);
  const pool = getRewardPool(tag, grade);
  const itemCount = Math.min(pool.length, Math.max(1, profile.itemCount));
  const items = [];
  const usedIndexes = new Set();
  for (let n = 0; n < itemCount && pool.length; n += 1) {
    let index = hashString(`${campaignId}:${tag}:${grade}:${n}`) % pool.length;
    // Linear-probe past a collision so a two-item pull never repeats itself
    // when the pool is small (e.g. mythic pools are frequently length 1,
    // which this loop naturally short-circuits on since itemCount is capped
    // to pool.length above).
    let guard = 0;
    while (usedIndexes.has(index) && guard < pool.length) {
      index = (index + 1) % pool.length;
      guard += 1;
    }
    usedIndexes.add(index);
    items.push({ itemId: pool[index], quantity: 1 });
  }
  return {
    gold: Math.round(base.gold * profile.goldMultiplier),
    experience: Math.round(base.experience * profile.xpMultiplier),
    items,
  };
}

// --- Handwritten flagship campaigns ----------------------------------------
const HANDWRITTEN_CAMPAIGN_SPECS = [
  {
    id: "nexis-registry-door",
    cityId: "nexis",
    title: "The Registry Door That Was Never Filed",
    theme: "civic intrigue",
    kind: "civic",
    grade: "uncommon",
    encounterSubject: "a bronze archive door sealed with a die that should not exist",
    region: "Nexis City",
    summary: "A sealed archive room appears in the civic registry without any record that it was built.",
    openingTitle: "A door under the registry steps",
    opening: "A clerk with ink on both sleeves leads you beneath the Registry Hall. A bronze door waits where a blank wall stood yesterday, its lock stamped with a seal no current office claims.",
    openingChoices: [
      ["question_clerk", "Question the clerk before touching the seal", "The clerk admits the seal belongs to an abolished permit office.", "You keep the clerk talking a moment longer, and the story keeps changing shape."],
      ["inspect_seal", "Inspect the bronze seal directly", "The seal is real, but too clean. It was pressed this week using a die that should be locked in the Archive vault.", "The fresh die-work stays on your mind as you step past the threshold."],
      ["post_watch", "Post a quiet watch at the stairwell", "Your caution catches a runner trying to slip away with a bundle of fresh permits.", "The runner's bundle is still warm from the press when you catch up to the door."],
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
    kind: "civic",
    grade: "uncommon",
    encounterSubject: "a tarred courier box wedged beneath a working pier, watched by armed dock muscle",
    region: "Blackharbor",
    summary: "A smuggler writ resurfaces beneath Pier Nine, naming a cargo nobody admits exists.",
    openingTitle: "Low tide under Pier Nine",
    opening: "Blackharbor lowers its voice at low tide. A tarred courier box is wedged beneath Pier Nine, marked by a salt writ and guarded by people pretending not to watch it.",
    openingChoices: [
      ["watch_watchers", "Watch the watchers first", "Two watchers are dock muscle. The third is dressed like a customs clerk and carries a blade too fine for paperwork.", "You keep the false clerk's blade in the corner of your eye as the tide keeps rising."],
      ["cut_box_free", "Cut the box free immediately", "The rope parts cleanly, but the tide pulls hard. You reach the ladder as a shout rolls down the dock.", "The shout is still rolling down the dock behind you when you reach dry stone."],
      ["buy_silence", "Pay a dockhand for the quiet version", "The dockhand takes the coin and points to a second mark: the writ is a decoy, but the decoy is still valuable.", "The dockhand's coin-price tip about the decoy stays true all the way to the box."],
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
    kind: "civic",
    grade: "rare",
    encounterSubject: "a silver ward-bell swinging silently beneath a fever-warm root",
    region: "Silverbough",
    summary: "A root-bell rings beneath a silent shrine grove, but no warden admits to hearing it.",
    openingTitle: "A bell without sound",
    opening: "The shrine grove looks peaceful until every bird faces the same root. Beneath it, a silver bell swings without making a sound.",
    openingChoices: [
      ["touch_root", "Place a hand on the root", "The root is fever-warm. The bell is ringing inside the ward where only broken things can hear it.", "The root's fever-warmth lingers in your palm as you follow the ward-line down."],
      ["trace_moss", "Trace the moss line around the shrine", "The moss line forms a boundary, then a warning, then a map. Something entered the grove from below.", "The moss-map's warning still points the same direction once you're below the shrine."],
      ["call_witness", "Call for a second witness before acting", "A junior warden arrives pale and honest. She has heard the bell for three nights and was told to call it wind.", "The junior warden's three nights of silence weigh on you as you go under the root together."],
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
    kind: "civic",
    grade: "uncommon",
    encounterSubject: "a furnace line still cycling after hours, stamping plates with an obsolete machine mark",
    region: "Ironhall",
    summary: "A foundry machine keeps working after its crew signs out, and the output does not match any order.",
    openingTitle: "The foundry after bell",
    opening: "Ironhall should be quieter after the work bell. It is not. A furnace line keeps cycling, stamping blank plates with an obsolete machine mark.",
    openingChoices: [
      ["stop_line", "Stop the furnace line at the control wheel", "The wheel burns your glove but turns. The line slows enough to reveal a second feed belt under slag covers.", "The hidden feed belt keeps turning in your mind even after the wheel stops burning."],
      ["follow_feed", "Follow the hidden feed belt", "The belt leads to a sealed bin of reclaimed armor plates, each scraped clean of its original owner mark.", "Every scraped-clean plate in the bin raises the same question you carry to the foreman."],
      ["wake_foreman", "Wake the foreman and demand the ledger", "The foreman arrives furious, then frightened. The ledger in his hand is blank for tonight's shift.", "The foreman's fear outlasts his fury by the time you reach the bin yourself."],
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
    kind: "civic",
    grade: "rare",
    encounterSubject: "a sealed petition bearing a signature copied from a funeral seal",
    region: "Highcourt",
    summary: "A sealed petition arrives bearing three legal signatures, only two of which belong to living people.",
    openingTitle: "The third signature",
    opening: "Highcourt's petition hall smells of wax, linen, and controlled panic. The third signature on the sealed petition is perfect, old, and impossible.",
    openingChoices: [
      ["test_wax", "Test the wax before opening it", "The wax is fresh, but the imprint is copied from a funeral seal. Someone wanted the dead to authorize the living.", "The funeral-seal imprint follows you through every clause the hall reads aloud."],
      ["summon_bailiff", "Summon a bailiff before witnesses leave", "The bailiff blocks the outer door. A witness suddenly remembers an urgent appointment elsewhere and fails to reach it.", "The witness who couldn't leave has a story worth hearing before the petition is unsealed."],
      ["read_publicly", "Read the petition aloud in the hall", "The hall hears every clause. Half the witnesses look offended. The other half look relieved secrecy failed first.", "The relieved half of the hall watches the door as closely as you do now."],
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
  const grade = spec.grade ?? "common";
  return {
    id: spec.id,
    cityId: spec.cityId,
    title: spec.title,
    theme: spec.theme,
    kind: spec.kind ?? "civic",
    grade,
    encounterSubject: spec.encounterSubject ?? null,
    category,
    durationMinutes: spec.durationMinutes ?? DURATION_BY_CATEGORY[category] ?? 20,
    rewardTags,
    region: spec.region,
    summary: spec.summary,
    rewardPreview: `XP, gold, ${rewardLabels.length ? rewardLabels.join("/") : "useful"} supplies, and a permanent Chronicle record.`,
    startSceneId,
    imageKey: `${spec.id}/${spec.id}-thumb.png`,
    scenes: {
      [startSceneId]: {
        id: startSceneId,
        title: spec.openingTitle,
        narration: spec.opening,
        imageKey: `${spec.id}/${spec.id}-opening.png`,
        choices: spec.openingChoices.map(([id, label, narration, decisionLeadIn]) => ({ id, label, narration, decisionLeadIn: decisionLeadIn ?? null, nextSceneId: decisionSceneId, tags: [spec.theme] })),
      },
      [decisionSceneId]: {
        id: decisionSceneId,
        title: spec.decisionTitle,
        narration: spec.decision,
        imageKey: `${spec.id}/${spec.id}-decision.png`,
        choices: spec.finalChoices.map(([id, label, summary, rewardKey, tags], index) => ({
          id,
          label,
          conclusion: {
            outcome: summary,
            chronicleSummary: summary,
            reward: buildRewardForTag(rewardKey, spec.id, grade),
            recordTags: tags,
            imageKey: `${spec.id}/${spec.id}-outcome-${index + 1}.png`,
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

// 6 civic + 6 combat archetypes. Held at exactly 12 (not appended-to) so the
// generated campaign count stays at 5 cities x 12 archetypes x 5 seeds = 300,
// keeping the total catalog (+5 handwritten = 305) matched to the agreed
// image budget of ~5 images/campaign - roughly 1525 total.
const ADVENTURE_ARCHETYPES = [
  // --- civic (6) -----------------------------------------------------------
  { key: "local-threat", kind: "civic", grade: "common", category: "Local Contract", theme: "local pressure", titleCore: "Trouble", focus: "a familiar street problem that has grown teeth", encounterSubject: "a street tough weighing a concealed blade", rewardKey: "civic", pressure: "public confidence is fraying", danger: "street blades and bad paperwork" },
  { key: "archive-mystery", kind: "civic", grade: "uncommon", category: "Archive Mystery", theme: "record mystery", titleCore: "Index", focus: "a record that opens a case instead of closing one", encounterSubject: "a locked archive vault humming with ward-light", rewardKey: "focus", pressure: "someone wants the old page destroyed", danger: "wards, locked rooms, and false witnesses" },
  { key: "ledger-heist", kind: "civic", grade: "uncommon", category: "Fixed Heist", theme: "ledger heist", titleCore: "Ledger", focus: "a stolen document with more value than coin", encounterSubject: "a guarded strongroom stacked with sealed ledgers", rewardKey: "covert", pressure: "the window to recover it is narrow", danger: "lookouts, decoys, and private guards" },
  { key: "coastal-scheme", kind: "civic", grade: "common", category: "Cargo Scheme", theme: "cargo intrigue", titleCore: "Cargo", focus: "cargo that changed owners without ever moving", encounterSubject: "a disputed cargo crate under dock lantern light", rewardKey: "travel", pressure: "the manifest expires at dusk", danger: "ambushes, bribes, and hidden cargo marks" },
  { key: "arcane-accident", kind: "civic", grade: "rare", category: "Arcane Mishap", theme: "magical accident", titleCore: "Spark", focus: "an experiment or ward behaving like it has opinions", encounterSubject: "an unstable ward-circle throwing off measured sparks", rewardKey: "focus", pressure: "the effect is spreading in measured pulses", danger: "misfires, illusions, and unstable residue" },
  { key: "relic-trial", kind: "civic", grade: "rare", category: "Relic Recovery", theme: "relic test", titleCore: "Relic", focus: "a useful relic that judges procedure before worthiness", encounterSubject: "an ancient relic pulsing on a warded stone plinth", rewardKey: "healing", pressure: "a careless claimant could ruin it for everyone", danger: "ritual errors and impatient thieves" },
  // --- combat (6) ------------------------------------------------------------
  { key: "monster-guarded-delve", kind: "combat", grade: "uncommon", category: "Bounded Delve", theme: "guarded descent", titleCore: "Depth", focus: "a compact descent with a clear prize and a short clock", encounterSubject: "a scarred cave troll blocking a collapsed ruin entrance", rewardKey: "civic", pressure: "the entrance will not stay open", danger: "traps, narrow fighting, and a territorial guardian" },
  { key: "ward-wraith-incident", kind: "combat", grade: "epic", category: "Sealed Incident", theme: "contained horror", titleCore: "Wraith", focus: "a sealed place that should have stayed quiet", encounterSubject: "a spectral wraith straining against broken ward-chains", rewardKey: "healing", pressure: "the containment mark is weakening", danger: "fear, infection, and ward backlash" },
  { key: "beast-hunt", kind: "combat", grade: "rare", category: "Board Hunt", theme: "posted threat", titleCore: "Hunt", focus: "a public notice that understates the real danger", encounterSubject: "a pack of dire wolves circling just past the lamp-light", rewardKey: "civic", pressure: "the next victim is predictable", danger: "a prepared, coordinated predator pack" },
  { key: "soldier-patrol", kind: "combat", grade: "rare", category: "Field Expedition", theme: "hostile patrol", titleCore: "Patrol", focus: "a short route where an armed company controls the ground", encounterSubject: "a disciplined company of armored mercenary soldiers", rewardKey: "travel", pressure: "supplies and daylight are both running thin", danger: "coordinated soldiers, ambush lines, and hostile watchers" },
  { key: "assassin-contract", kind: "combat", grade: "epic", category: "Faction Incident", theme: "hired blades", titleCore: "Contract", focus: "a contract written on someone respectable's behalf", encounterSubject: "a masked assassin cell moving in coordinated silence", rewardKey: "covert", pressure: "both sides are rewriting the story", danger: "split loyalties and a staged kill order" },
  { key: "hydras-marsh", kind: "combat", grade: "mythic", category: "Relic Recovery", theme: "mythic beast", titleCore: "Coil", focus: "a relic no one can reach while the beast still breathes", encounterSubject: "a regenerating three-headed hydra rising from marsh water", rewardKey: "healing", pressure: "each severed head answers with two more", danger: "regenerating heads, marsh footing, and caustic breath" },
];

const VARIANT_SEEDS = [
  { key: "glass-witness", titleLead: "Glass Witness", object: "a glass witness token", clue: "a reflection that shows yesterday's room", actor: "a witness who remembers two versions of the same hour", twist: "the honest testimony is split between two impossible accounts" },
  { key: "dead-route", titleLead: "Dead Route", object: "a route mark assigned to a road no longer on the map", clue: "a mile-stone rubbing with fresh mud on it", actor: "a courier who swears the road still answered", twist: "the route is real only when someone has already paid the toll" },
  { key: "red-bell", titleLead: "Red Bell", object: "a warning bell wrapped in red thread", clue: "a bell note written before the bell was cast", actor: "an apprentice ordered to deny the alarm", twist: "silence is part of the alarm, not proof that nothing happened" },
  { key: "mask-debt", titleLead: "Masked Debt", object: "a debt mask passed between three hands", clue: "a signature hidden inside the mask seam", actor: "a broker whose public face is legally innocent", twist: "the debt belongs to an office rather than a person" },
  { key: "ash-engine", titleLead: "Ash Engine", object: "a small engine coughing warm ash", clue: "ash settling in the shape of a boundary map", actor: "a repair crew paid not to fix the cause", twist: "the engine is preserving evidence by refusing to stop" },
];

// ~10 distinct title shapes, picked deterministically per campaign (see
// hashString) so the catalog stops reading as one rigid MadLibs formula
// while staying 100% stable across restarts and clean in git diffs.
// Every template below must reference a distinguishing field from all three
// varying dimensions (city, archetype, seed) - each is globally unique within
// its dimension (5 distinct city.region/cityAdjective/site values, 12 distinct
// archetype.titleCore values, 5 distinct seed.titleLead values), so a template
// that drops any one dimension collides across every campaign that shares the
// dimensions it does use. (Confirmed the hard way: an earlier draft with three
// single/two-dimension templates produced 77 duplicate titles out of 305.)
const TITLE_TEMPLATES = [
  (city, archetype, seed) => `The ${city.cityAdjective} ${seed.titleLead} ${archetype.titleCore}`,
  (city, archetype, seed) => `${seed.titleLead}: A ${city.region} ${archetype.titleCore}`,
  (city, archetype, seed) => `The ${archetype.titleCore} of ${city.region}'s ${seed.titleLead}`,
  (city, archetype, seed) => `A ${city.cityAdjective} Reckoning: ${seed.titleLead} and the ${archetype.titleCore}`,
  (city, archetype, seed) => `${city.region}'s ${seed.titleLead} ${archetype.titleCore}`,
  (city, archetype, seed) => `Keys to the ${city.cityAdjective} ${archetype.titleCore}: The ${seed.titleLead} Affair`,
  (city, archetype, seed) => `What ${city.region} Called ${seed.titleLead}, A ${archetype.titleCore}`,
  (city, archetype, seed) => `${archetype.titleCore} in ${city.region}: The ${seed.titleLead} Account`,
  (city, archetype, seed) => `A Reckoning at ${city.site}: The ${seed.titleLead} ${archetype.titleCore}`,
  (city, archetype, seed) => `The ${seed.titleLead} ${archetype.titleCore} That Marked ${city.region}`,
];

function generatedTitle(city, archetype, seed) {
  const id = `${city.id}-${archetype.key}-${seed.key}`;
  const template = TITLE_TEMPLATES[hashString(id, 17) % TITLE_TEMPLATES.length];
  return template(city, archetype, seed);
}

function buildGeneratedChoices(city, archetype, seed) {
  if (archetype.kind === "combat") {
    return [
      ["assess_the_threat", `Size up ${archetype.encounterSubject}`, `You read the fight before it starts. ${city.publicRole.replace(/\b\w/g, (c) => c.toUpperCase())} confirms this matches reports near ${city.site}.`, `Your read on the threat holds true the moment you close the distance.`],
      ["question_the_contact", `Question the ${city.publicRole}`, `The ${city.publicRole} gives you a careful answer, then a useful one: ${seed.actor} saw it first and survived.`, `${seed.actor.replace(/^./, (c) => c.toUpperCase())}'s account matches what you find waiting.`],
      ["set_the_ground", `Choose the ground near ${city.site}`, `You pick the terrain before the terrain picks you, keeping ${seed.object} as leverage if talk fails.`, `The ground you chose near ${city.site} still favors you when it counts.`],
    ];
  }
  return [
    ["read_the_trace", `Study ${seed.clue}`, `You read ${seed.clue} before anyone can sweep it aside. The lead points toward ${city.institution}, but not cleanly.`, `${seed.clue.replace(/^./, (c) => c.toUpperCase())} keeps pointing the same direction as you go further in.`],
    ["question_the_contact", `Question the ${city.publicRole}`, `The ${city.publicRole} gives you a careful answer, then a useful one. ${seed.actor} is now the center of the matter.`, `${seed.actor.replace(/^./, (c) => c.toUpperCase())} is still the center of it once you press further.`],
    ["watch_the_site", `Set watch near ${city.site}`, `You keep the scene quiet long enough to spot a second hand in the work: ${city.underbelly} are circling the same evidence.`, `The ${city.underbelly} circling the evidence haven't noticed you yet.`],
  ];
}

function buildGeneratedFinalChoices(city, archetype, seed, title) {
  const secondaryTag = archetype.key === "ledger-heist" || archetype.key === "assassin-contract" ? "covert" : archetype.rewardKey;
  if (archetype.kind === "combat") {
    return [
      [
        "end_the_threat",
        `End it: face ${archetype.encounterSubject} directly`,
        `You resolved ${title} by facing ${archetype.encounterSubject} head-on near ${city.site}, proving ${archetype.focus} could be answered instead of only survived.`,
        archetype.rewardKey,
        [city.id, archetype.key, seed.key, "direct-fight"],
      ],
      [
        "outmaneuver_the_threat",
        `Outmaneuver it using ${seed.object}`,
        `You resolved ${title} by using ${seed.object} to break the fight's terms, proving that ${seed.twist}.`,
        secondaryTag,
        [city.id, archetype.key, seed.key, "outmaneuver"],
      ],
    ];
  }
  return [
    [
      "secure_public_record",
      `Secure the evidence through ${city.authority}`,
      `You resolved ${title} by preserving ${seed.object} through ${city.authority}, exposing ${archetype.focus} before ${city.threat} could bury the trail.`,
      archetype.rewardKey,
      [city.id, archetype.key, seed.key, "public-record"],
    ],
    [
      "follow_hidden_actor",
      `Follow ${seed.actor}`,
      `You resolved ${title} by following ${seed.actor} through ${city.site}, proving that ${seed.twist}.`,
      secondaryTag,
      [city.id, archetype.key, seed.key, "hidden-actor"],
    ],
  ];
}

function buildGeneratedCampaignSpec(city, archetype, seed) {
  const id = `${city.id}-${archetype.key}-${seed.key}`;
  const title = generatedTitle(city, archetype, seed);
  const isCombat = archetype.kind === "combat";
  const opening = isCombat
    ? `A ${city.publicRole} brings word of ${archetype.encounterSubject} near ${city.site}. The first report says ${archetype.focus}; the second, quieter report says ${archetype.pressure}. ${seed.object.replace(/^./, (c) => c.toUpperCase())} was found at the scene.`
    : `A ${city.publicRole} brings you ${seed.object} wrapped in ${city.material}. The first report says ${archetype.focus}; the second, quieter report says ${archetype.pressure}.`;
  const decision = isCombat
    ? `${archetype.encounterSubject.replace(/^./, (c) => c.toUpperCase())} is close now. You find ${seed.clue}, confirmation of ${city.threat} nearby, and proof that the immediate danger is ${archetype.danger}. The useful truth is worse: ${seed.twist}.`
    : `The trail leads through ${city.site}. You find ${seed.clue}, signs of ${city.threat}, and proof that the immediate danger is ${archetype.danger}. The useful truth is worse: ${seed.twist}.`;
  return {
    id,
    cityId: city.id,
    title,
    theme: archetype.theme,
    kind: archetype.kind,
    grade: archetype.grade,
    encounterSubject: isCombat ? archetype.encounterSubject : null,
    category: archetype.category,
    region: city.region,
    summary: isCombat ? `${city.region} reports ${archetype.encounterSubject} tied to ${archetype.focus}.` : `${city.region} reports ${seed.object} tied to ${archetype.focus}.`,
    openingTitle: `${seed.titleLead} in ${city.region}`,
    opening,
    openingChoices: buildGeneratedChoices(city, archetype, seed),
    decisionTitle: `${archetype.titleCore} under pressure`,
    decision,
    finalChoices: buildGeneratedFinalChoices(city, archetype, seed, title),
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
