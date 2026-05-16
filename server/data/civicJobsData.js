export const CIVIC_SHIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const MAX_CIVIC_RANK = 7;
const SALARY_BY_RANK = {
  1: 40,
  2: 65,
  3: 95,
  4: 135,
  5: 185,
  6: 245,
  7: 320,
};
const DAILY_JOB_POINTS_BY_RANK = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
};
const PROMOTION_POINT_COSTS = {
  2: 5,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 30,
};

export const CONSORTIUM_CIVIC_POLICY = {
  mode: "consortium_replaces_civic_jobs",
  blockedReason:
    "Consortium membership counts as your effective job. Civic payroll, collection, and new civic JP gains are blocked while consortium-affiliated.",
};

const CITY_WATCH_CAPSTONE = {
  key: "city_watch_hardline",
  name: "Hardline Watch Doctrine",
  description: "City Watch emergency readiness while actively employed.",
  magnitude: 8,
  activeMode: "employed",
};

const APOTHECARY_CAPSTONE = {
  key: "hospital_recovery",
  name: "Field Triage Discipline",
  description: "Permanent reduction to hospital recovery time after mastering the hall.",
  magnitude: 15,
  activeMode: "permanent",
};

const UNIVERSITY_CAPSTONE = {
  key: "education_speed",
  name: "Scholarly Momentum",
  description: "Permanent education speed bonus after reaching University capstone rank.",
  magnitude: 10,
  activeMode: "permanent",
};

const PROVISIONER_CAPSTONE = {
  key: "market_discount",
  name: "Procurement Mastery",
  description: "Permanent legal market discount through optimized procurement networks.",
  magnitude: 8,
  activeMode: "permanent",
};

const BUILDERS_GUILD_CAPSTONE = {
  key: "builders_site_momentum",
  name: "Site Momentum",
  description: "Active construction contracts complete slightly faster while employed as a builder.",
  magnitude: 8,
  activeMode: "employed",
};

const TRIBUNAL_CAPSTONE = {
  key: "jail_reduction",
  name: "Tribunal Leverage",
  description: "Permanent jail sentence reduction from senior tribunal standing.",
  magnitude: 15,
  activeMode: "permanent",
};

const GAMBLING_DEN_CAPSTONE = {
  key: "gambling_den_house_edge",
  name: "House Edge Discipline",
  description: "Operational edge bonuses while actively employed by the den.",
  magnitude: 8,
  activeMode: "employed",
};

const CITY_WATCH_SPEND_OPTIONS = [
  {
    id: "city_watch_strike_drills",
    label: "Combat Drills: +100 STR",
    description: "Convert City Watch JP into direct strength conditioning.",
    costJobPoints: 10,
    effect: { kind: "battle_stat", stat: "strength", amount: 100 },
  },
  {
    id: "city_watch_shield_wall",
    label: "Shield Wall: +100 DEF",
    description: "Convert City Watch JP into defensive line training.",
    costJobPoints: 10,
    effect: { kind: "battle_stat", stat: "defense", amount: 100 },
  },
  {
    id: "city_watch_requisition_pool",
    label: "Militia Requisition Cache",
    description: "Spend 25 JP for a random practical guard weapon or armor package.",
    costJobPoints: 25,
    effect: {
      kind: "inventory_roll",
      pool: [
        { itemId: "tempered_blade", quantity: 1, label: "Tempered Blade" },
        { itemId: "brigandine_plate", quantity: 1, label: "Brigandine Plate" },
        { itemId: "tower_shield", quantity: 1, label: "Tower Shield" },
        { itemId: "hunters_bow", quantity: 1, label: "Hunter's Bow" },
      ],
    },
  },
];

const UNIVERSITY_SPEND_OPTIONS = [
  {
    id: "university_archivist_int",
    label: "Research Focus: +100 INT",
    description: "Spend University JP for concentrated intelligence gains.",
    costJobPoints: 10,
    effect: { kind: "working_stat", stat: "intelligence", amount: 100 },
  },
  {
    id: "university_field_study_end",
    label: "Field Practicum: +100 END",
    description: "Spend University JP for endurance gains from applied study rotations.",
    costJobPoints: 10,
    effect: { kind: "working_stat", stat: "endurance", amount: 100 },
  },
  {
    id: "university_workshop_man",
    label: "Workshop Discipline: +100 MAN",
    description: "Spend University JP for manual-labor gains via technical workshop training.",
    costJobPoints: 10,
    effect: { kind: "working_stat", stat: "manualLabor", amount: 100 },
  },
];

function rankTemplate(rank, title, workingStatGains, requirementRule, passiveUnlock) {
  return {
    rank,
    title,
    dailyGold: SALARY_BY_RANK[rank],
    dailyJobPoints: DAILY_JOB_POINTS_BY_RANK[rank],
    workingStatGains,
    ...(requirementRule ? { requirementRule } : {}),
    ...(passiveUnlock ? { passiveUnlock } : {}),
  };
}

export const CIVIC_JOB_TRACKS = [
  {
    id: "city_watch",
    name: "City Watch",
    entryRequirements: ["Interview at the Watch Barracks", "Not jailed", "Not hospitalized"],
    entryRule: { requireNotJailed: true, requireNotHospitalized: true },
    interviewQuestions: [
      "How would you de-escalate a market dispute without drawing steel?",
      "What matters more on patrol: obedience to orders or protection of citizens?",
      "How do you respond when another watch officer abuses authority?",
    ],
    spendOptions: CITY_WATCH_SPEND_OPTIONS,
    ranks: [
      rankTemplate(1, "Watch Recruit", { endurance: 1, manualLabor: 1 }),
      rankTemplate(2, "Patrol Officer", { endurance: 1, manualLabor: 1 }, { minimumWorkingTotal: 70 }),
      rankTemplate(3, "Senior Patrol", { endurance: 2, manualLabor: 1 }, { minimumEndurance: 40 }),
      rankTemplate(4, "Sergeant", { endurance: 2, manualLabor: 1 }, { minimumWorkingTotal: 145 }),
      rankTemplate(5, "Lieutenant", { endurance: 2, manualLabor: 2 }, { minimumWorkingTotal: 210 }),
      rankTemplate(6, "Captain", { endurance: 3, manualLabor: 2 }, { minimumWorkingTotal: 285 }),
      rankTemplate(7, "High Marshal", { endurance: 3, manualLabor: 3 }, { minimumWorkingTotal: 370, minimumEndurance: 120 }, CITY_WATCH_CAPSTONE),
    ],
  },
  {
    id: "apothecary_hall",
    name: "Apothecary Hall",
    entryRequirements: ["Basic Literacy completed", "Intelligence 20+", "Not hospitalized"],
    entryRule: { completedCourses: ["basic-literacy"], minimumIntelligence: 20, requireNotHospitalized: true },
    interviewQuestions: [
      "How do you verify a remedy before giving it to a patient?",
      "What is your protocol when triage resources are limited?",
      "How would you document a treatment failure for review?",
    ],
    spendOptions: [],
    ranks: [
      rankTemplate(1, "Dispensary Aide", { intelligence: 1, endurance: 1 }),
      rankTemplate(2, "Apprentice Apothecary", { intelligence: 1, endurance: 1 }, { minimumIntelligence: 45 }),
      rankTemplate(3, "Hall Apothecary", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 80, completedCourses: ["study-discipline"] }),
      rankTemplate(4, "Field Chirurgeon", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 120 }),
      rankTemplate(5, "Senior Physician", { intelligence: 2, endurance: 2 }, { minimumIntelligence: 170, completedCourses: ["medical-ethics"] }),
      rankTemplate(6, "Master Alchemist", { intelligence: 3, endurance: 2 }, { minimumIntelligence: 230 }),
      rankTemplate(7, "Grand Healer", { intelligence: 3, endurance: 3 }, { minimumIntelligence: 300, completedCourses: ["advanced-anatomy"] }, APOTHECARY_CAPSTONE),
    ],
  },
  {
    id: "university",
    name: "University",
    entryRequirements: ["Basic Literacy completed", "Study Discipline completed", "Intelligence 24+"],
    entryRule: { completedCourses: ["basic-literacy", "study-discipline"], minimumIntelligence: 24 },
    interviewQuestions: [
      "How do you test whether a claim is evidence-based?",
      "What is your method for teaching difficult material to novices?",
      "When does civic duty outweigh academic neutrality?",
    ],
    spendOptions: UNIVERSITY_SPEND_OPTIONS,
    ranks: [
      rankTemplate(1, "Junior Proctor", { intelligence: 1, endurance: 1 }),
      rankTemplate(2, "Lecturer", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 50 }),
      rankTemplate(3, "Senior Lecturer", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 90, completedCourses: ["practical-arithmetic"] }),
      rankTemplate(4, "Archivist", { intelligence: 3, endurance: 1 }, { minimumIntelligence: 140 }),
      rankTemplate(5, "Dean", { intelligence: 3, endurance: 2 }, { minimumIntelligence: 200, completedCourses: ["civic-fundamentals"] }),
      rankTemplate(6, "Provost", { intelligence: 4, endurance: 2 }, { minimumIntelligence: 270 }),
      rankTemplate(7, "Rector Magnificus", { intelligence: 4, endurance: 3 }, { minimumIntelligence: 340, completedCourses: ["academy-methods"] }, UNIVERSITY_CAPSTONE),
    ],
  },
  {
    id: "provisioner",
    name: "Provisioner",
    entryRequirements: ["Interview with Quartermaster Intake", "Not jailed", "Not hospitalized"],
    entryRule: { requireNotJailed: true, requireNotHospitalized: true },
    interviewQuestions: [
      "How do you keep inventories accurate during chaotic deliveries?",
      "When supplies run short, who gets priority and why?",
      "What is your process for spotting theft or spoilage early?",
    ],
    spendOptions: [],
    ranks: [
      rankTemplate(1, "Stock Runner", { manualLabor: 1, intelligence: 1 }),
      rankTemplate(2, "Store Clerk", { manualLabor: 1, intelligence: 1 }, { minimumWorkingTotal: 75 }),
      rankTemplate(3, "Buyer", { manualLabor: 1, intelligence: 2 }, { minimumWorkingTotal: 115 }),
      rankTemplate(4, "Quartermaster", { manualLabor: 2, intelligence: 2 }, { minimumWorkingTotal: 170 }),
      rankTemplate(5, "Logistics Foreman", { manualLabor: 2, intelligence: 2 }, { minimumWorkingTotal: 230 }),
      rankTemplate(6, "Supply Director", { manualLabor: 2, intelligence: 3 }, { minimumWorkingTotal: 300 }),
      rankTemplate(7, "Grand Provisioner", { manualLabor: 3, intelligence: 3 }, { minimumWorkingTotal: 380 }, PROVISIONER_CAPSTONE),
    ],
  },
  {
    id: "builders_guild",
    name: "Builder's Guild",
    entryRequirements: ["Interview with the Property Office foreman", "Not jailed", "Not hospitalized"],
    entryRule: { requireNotJailed: true, requireNotHospitalized: true },
    interviewQuestions: [
      "How do you prioritize safety when a site schedule slips?",
      "When materials run short, what gets protected first?",
      "How do you keep quality steady under deadline pressure?",
    ],
    spendOptions: [],
    ranks: [
      rankTemplate(1, "Apprentice Builder", { manualLabor: 1, endurance: 1 }),
      rankTemplate(2, "Site Hand", { manualLabor: 1, endurance: 1 }, { minimumWorkingTotal: 80 }),
      rankTemplate(3, "Journeyman Mason", { manualLabor: 2, endurance: 1 }, { minimumWorkingTotal: 125 }),
      rankTemplate(4, "Foreman", { manualLabor: 2, endurance: 2 }, { minimumWorkingTotal: 180 }),
      rankTemplate(5, "Master Builder", { manualLabor: 3, endurance: 2 }, { minimumWorkingTotal: 245 }),
      rankTemplate(6, "Chief Architect", { manualLabor: 3, endurance: 3 }, { minimumWorkingTotal: 315 }),
      rankTemplate(7, "Guild Constructor", { manualLabor: 4, endurance: 3 }, { minimumWorkingTotal: 390 }, BUILDERS_GUILD_CAPSTONE),
    ],
  },
  {
    id: "civic_tribunal",
    name: "Civic Tribunal",
    entryRequirements: ["Basic Literacy completed", "Civic Fundamentals completed", "Intelligence 26+"],
    entryRule: { completedCourses: ["basic-literacy", "civic-fundamentals"], minimumIntelligence: 26 },
    interviewQuestions: [
      "How do you weigh fairness against strict procedural order?",
      "What evidence threshold is needed before escalating charges?",
      "How do you handle pressure from powerful interests?",
    ],
    spendOptions: [],
    ranks: [
      rankTemplate(1, "Court Clerk", { intelligence: 1, endurance: 1 }),
      rankTemplate(2, "Case Advocate", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 55 }),
      rankTemplate(3, "Magistrate's Aide", { intelligence: 2, endurance: 1 }, { minimumIntelligence: 100 }),
      rankTemplate(4, "Magistrate", { intelligence: 3, endurance: 1 }, { minimumIntelligence: 150, completedCourses: ["study-discipline"] }),
      rankTemplate(5, "Senior Jurist", { intelligence: 3, endurance: 2 }, { minimumIntelligence: 215 }),
      rankTemplate(6, "High Justiciar", { intelligence: 4, endurance: 2 }, { minimumIntelligence: 285, completedCourses: ["law-and-civic-order"] }),
      rankTemplate(7, "Lord Arbiter", { intelligence: 4, endurance: 3 }, { minimumIntelligence: 360 }, TRIBUNAL_CAPSTONE),
    ],
  },
  {
    id: "gambling_den",
    name: "Gambling Den",
    entryRequirements: ["Interview with the Pit Floor Manager", "Not hospitalized", "Not jailed"],
    entryRule: { requireNotHospitalized: true, requireNotJailed: true },
    interviewQuestions: [
      "How do you read a table before a bet turns volatile?",
      "What do you do when a patron accuses the house of cheating?",
      "Where is the line between charm and manipulation on the floor?",
    ],
    spendOptions: [],
    ranks: [
      rankTemplate(1, "Floor Runner", { intelligence: 1, manualLabor: 1 }),
      rankTemplate(2, "Dealer", { intelligence: 1, manualLabor: 1 }, { minimumIntelligence: 35 }),
      rankTemplate(3, "Pit Boss", { intelligence: 2, manualLabor: 1 }, { minimumWorkingTotal: 105 }),
      rankTemplate(4, "Cage Manager", { intelligence: 2, manualLabor: 2 }, { minimumWorkingTotal: 165 }),
      rankTemplate(5, "House Strategist", { intelligence: 2, manualLabor: 2 }, { minimumWorkingTotal: 230 }),
      rankTemplate(6, "Master Croupier", { intelligence: 3, manualLabor: 2 }, { minimumWorkingTotal: 300 }),
      rankTemplate(7, "Den Sovereign", { intelligence: 3, manualLabor: 3 }, { minimumWorkingTotal: 370 }, GAMBLING_DEN_CAPSTONE),
    ],
  },
];

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

export function defaultCivicEmploymentState() {
  return {
    activeTrackId: null,
    trackProgress: {},
  };
}

function normalizeTrackProgress(value, now = Date.now()) {
  const source = asRecord(value);
  return {
    rank: Math.min(MAX_CIVIC_RANK, Math.max(1, asWholeNumber(source.rank, 1))),
    jobPoints: asWholeNumber(source.jobPoints, 0),
    shiftsWorked: asWholeNumber(source.shiftsWorked, 0),
    joinedAt: asWholeNumber(source.joinedAt, now),
    lastShiftAt: source.lastShiftAt == null ? null : asWholeNumber(source.lastShiftAt, now),
  };
}

export function normalizeCivicEmploymentState(value, now = Date.now()) {
  const source = asRecord(value);
  const progressSource = asRecord(source.trackProgress);
  const trackProgress = {};
  for (const [trackId, rawProgress] of Object.entries(progressSource)) {
    trackProgress[trackId] = normalizeTrackProgress(rawProgress, now);
  }

  return {
    activeTrackId: typeof source.activeTrackId === "string" ? source.activeTrackId : null,
    trackProgress,
  };
}

export function createTrackProgress(now = Date.now()) {
  return {
    rank: 1,
    jobPoints: 0,
    shiftsWorked: 0,
    joinedAt: now,
    lastShiftAt: null,
  };
}

export function getCivicTrack(trackId) {
  return CIVIC_JOB_TRACKS.find((track) => track.id === trackId) ?? null;
}

export function getTrackProgress(state, trackId) {
  const normalized = normalizeCivicEmploymentState(state);
  return normalized.trackProgress[trackId] ?? null;
}

export function getCivicSpendOptions(trackId) {
  const track = getCivicTrack(trackId);
  return Array.isArray(track?.spendOptions) ? track.spendOptions : [];
}

export function getRequiredPointsForRank(rank) {
  if (rank <= 1) return 0;
  return PROMOTION_POINT_COSTS[rank] ?? Number.POSITIVE_INFINITY;
}

export function getShiftCooldownRemaining(progress, now = Date.now()) {
  if (!progress?.lastShiftAt) return 0;
  return Math.max(0, progress.lastShiftAt + CIVIC_SHIFT_COOLDOWN_MS - now);
}

export function getWorkingTotal(workingStats) {
  const stats = asRecord(workingStats);
  return (
    asWholeNumber(stats.manualLabor, 0) +
    asWholeNumber(stats.intelligence, 0) +
    asWholeNumber(stats.endurance, 0)
  );
}

function hasCompletedCourses(completedCourses, requiredCourses) {
  if (!Array.isArray(requiredCourses) || requiredCourses.length === 0) return true;
  const completed = new Set(
    Array.isArray(completedCourses)
      ? completedCourses.filter((entry) => typeof entry === "string")
      : [],
  );
  return requiredCourses.every((courseId) => completed.has(courseId));
}

export function getRuleFailure(rule, runtimeState) {
  if (!rule) return null;

  const player = asRecord(runtimeState?.player);
  const stats = asRecord(player.workingStats);
  const condition = asRecord(player.condition);
  const completedCourses = asRecord(runtimeState?.education).completedCourses;

  if (rule.requireNotHospitalized && condition.type === "hospitalized") {
    return "Unavailable while hospitalized.";
  }
  if (rule.requireNotJailed && condition.type === "jailed") {
    return "Unavailable while jailed.";
  }

  if (typeof rule.minimumWorkingTotal === "number" && getWorkingTotal(stats) < rule.minimumWorkingTotal) {
    return `Requires ${rule.minimumWorkingTotal}+ combined working stats.`;
  }
  if (typeof rule.minimumManualLabor === "number" && asWholeNumber(stats.manualLabor, 0) < rule.minimumManualLabor) {
    return `Requires Manual Labor ${rule.minimumManualLabor}+.`;
  }
  if (typeof rule.minimumIntelligence === "number" && asWholeNumber(stats.intelligence, 0) < rule.minimumIntelligence) {
    return `Requires Intelligence ${rule.minimumIntelligence}+.`;
  }
  if (typeof rule.minimumEndurance === "number" && asWholeNumber(stats.endurance, 0) < rule.minimumEndurance) {
    return `Requires Endurance ${rule.minimumEndurance}+.`;
  }

  if (!hasCompletedCourses(completedCourses, rule.completedCourses)) {
    const completed = new Set(Array.isArray(completedCourses) ? completedCourses : []);
    const missing = rule.completedCourses
      .filter((courseId) => !completed.has(courseId))
      .map((courseId) => String(courseId).replace(/-/g, " "));
    return `Requires ${missing.join(", ")}.`;
  }

  return null;
}

export function getCurrentRank(track, progress) {
  const rank = Math.min(MAX_CIVIC_RANK, Math.max(1, asWholeNumber(progress?.rank, 1)));
  return track.ranks.find((entry) => entry.rank === rank) ?? track.ranks[0];
}

export function getNextRank(track, progress) {
  const current = getCurrentRank(track, progress);
  return track.ranks.find((entry) => entry.rank === current.rank + 1) ?? null;
}

export function getUnlockedPassivesForTrack(trackId, rank) {
  const track = getCivicTrack(trackId);
  if (!track) return [];
  return track.ranks
    .filter((entry) => entry.rank <= rank && entry.passiveUnlock)
    .map((entry) => entry.passiveUnlock);
}

export function getActiveCivicJobPassives(state) {
  const normalized = normalizeCivicEmploymentState(state);
  const activeTrackId = normalized.activeTrackId;
  const passives = {};

  for (const [trackId, progress] of Object.entries(normalized.trackProgress)) {
    const unlocked = getUnlockedPassivesForTrack(trackId, progress.rank);
    for (const passive of unlocked) {
      const activeMode = passive.activeMode ?? "employed";
      if (activeMode === "permanent" || activeTrackId === trackId) {
        passives[passive.key] = passive.magnitude;
      }
    }
  }

  return passives;
}

export function isConsortiumMember(runtimeState) {
  const membership = asRecord(asRecord(runtimeState?.consortium).membership);
  const internalId = membership.organizationInternalId;
  const publicId = membership.publicId;
  return (
    (typeof internalId === "string" && internalId.length > 0) ||
    (typeof publicId === "string" && publicId.length > 0) ||
    typeof publicId === "number"
  );
}
