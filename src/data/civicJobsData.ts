export type CivicJobTrackId =
  | "city_guard"
  | "medical_corps"
  | "academy_staff"
  | "trade_office"
  | "civic_bureau"
  | "forge_union";

export type WorkingStatKey = "manualLabor" | "intelligence" | "endurance";
export type CivicPassiveKey =
  | "education_speed"
  | "hospital_recovery"
  | "jail_reduction"
  | "market_discount";

export interface CivicJobPassive {
  key: CivicPassiveKey;
  name: string;
  description: string;
  magnitude: number;
}

export interface CivicJobRank {
  rank: number;
  title: string;
  requirementLabel: string;
  requirementRule?: CivicRankRequirementRule;
  dailyGold: number;
  dailyJobPoints: number;
  workingStatGains: Partial<Record<WorkingStatKey, number>>;
  passiveUnlock?: CivicJobPassive;
}

export interface CivicEntryRequirementRule {
  minimumWorkingTotal?: number;
  minimumManualLabor?: number;
  minimumIntelligence?: number;
  minimumEndurance?: number;
  completedCourses?: string[];
  requireNotHospitalized?: boolean;
  requireNotJailed?: boolean;
}

export interface CivicRankRequirementRule {
  minimumWorkingTotal?: number;
  minimumManualLabor?: number;
  minimumIntelligence?: number;
  minimumEndurance?: number;
  completedCourses?: string[];
  requireNotHospitalized?: boolean;
  requireNotJailed?: boolean;
}

export interface CivicJobTrack {
  id: CivicJobTrackId;
  name: string;
  subtitle: string;
  interviewPrompt: string;
  entryRequirements: string[];
  entryRule?: CivicEntryRequirementRule;
  specialties: string[];
  ranks: CivicJobRank[];
}

const EDUCATION_SPECIAL: CivicJobPassive = {
  key: "education_speed",
  name: "Faculty Privilege",
  description: "Courses complete faster while you remain employed in Education.",
  magnitude: 10,
};

const MEDICAL_SPECIAL: CivicJobPassive = {
  key: "hospital_recovery",
  name: "Medical Network",
  description: "Hospital recovery times are reduced while you remain employed in Medical.",
  magnitude: 15,
};

const LAW_SPECIAL: CivicJobPassive = {
  key: "jail_reduction",
  name: "Judicial Pull",
  description: "Jail sentences are reduced while you remain employed in Law.",
  magnitude: 15,
};

const GROCER_SPECIAL: CivicJobPassive = {
  key: "market_discount",
  name: "Bulk Buyer",
  description: "Legal market purchases are discounted while you remain employed in Grocer.",
  magnitude: 8,
};

export const CIVIC_JOB_TRACKS: CivicJobTrack[] = [
  {
    id: "city_guard",
    name: "Army",
    subtitle: "Barracks drills, patrol work, and getting shouted at by people who think volume is strategy.",
    interviewPrompt: "Why should Nexis hand you a uniform and trust you not to embarrass it?",
    entryRequirements: ["Working stats total 30+", "Not currently jailed"],
    entryRule: { minimumWorkingTotal: 30, requireNotJailed: true },
    specialties: ["Endurance growth", "Manual Labor growth", "Solid daily salary"],
    ranks: [
      {
        rank: 1,
        title: "Recruit",
        requirementLabel: "Starter",
        dailyGold: 40,
        dailyJobPoints: 1,
        workingStatGains: { endurance: 1, manualLabor: 1 },
      },
      {
        rank: 2,
        title: "Private",
        requirementLabel: "10 job points and Working stats 70+ total",
        requirementRule: { minimumWorkingTotal: 70 },
        dailyGold: 65,
        dailyJobPoints: 2,
        workingStatGains: { endurance: 1, manualLabor: 1 },
      },
      {
        rank: 3,
        title: "Corporal",
        requirementLabel: "30 job points and Endurance 45+",
        requirementRule: { minimumEndurance: 45 },
        dailyGold: 95,
        dailyJobPoints: 3,
        workingStatGains: { endurance: 2, manualLabor: 1 },
      },
      {
        rank: 4,
        title: "Sergeant",
        requirementLabel: "70 job points and Working stats 160+ total",
        requirementRule: { minimumWorkingTotal: 160 },
        dailyGold: 135,
        dailyJobPoints: 4,
        workingStatGains: { endurance: 2, manualLabor: 1 },
      },
      {
        rank: 5,
        title: "Commandant",
        requirementLabel: "130 job points and Working stats 260+ total",
        requirementRule: { minimumWorkingTotal: 260 },
        dailyGold: 185,
        dailyJobPoints: 5,
        workingStatGains: { endurance: 2, manualLabor: 2 },
      },
    ],
  },
  {
    id: "medical_corps",
    name: "Medical",
    subtitle: "Treat the wounded, manage the ward, and quietly judge how people keep arriving here.",
    interviewPrompt: "Why should the hospital trust your hands and your nerves?",
    entryRequirements: ["Basic Literacy completed", "Intelligence 12+", "Not currently hospitalized"],
    entryRule: { completedCourses: ["basic-literacy"], minimumIntelligence: 12, requireNotHospitalized: true },
    specialties: ["Intelligence growth", "Endurance growth", "Final recovery passive"],
    ranks: [
      {
        rank: 1,
        title: "Orderly",
        requirementLabel: "Starter",
        dailyGold: 35,
        dailyJobPoints: 1,
        workingStatGains: { intelligence: 1, endurance: 1 },
      },
      {
        rank: 2,
        title: "Nurse",
        requirementLabel: "10 job points and Intelligence 35+",
        requirementRule: { minimumIntelligence: 35 },
        dailyGold: 60,
        dailyJobPoints: 2,
        workingStatGains: { intelligence: 1, endurance: 1 },
      },
      {
        rank: 3,
        title: "Paramedic",
        requirementLabel: "30 job points and Intelligence 70+",
        requirementRule: { minimumIntelligence: 70 },
        dailyGold: 90,
        dailyJobPoints: 3,
        workingStatGains: { intelligence: 2, endurance: 1 },
      },
      {
        rank: 4,
        title: "Surgeon",
        requirementLabel: "70 job points and Intelligence 125+",
        requirementRule: { minimumIntelligence: 125 },
        dailyGold: 125,
        dailyJobPoints: 4,
        workingStatGains: { intelligence: 2, endurance: 1 },
      },
      {
        rank: 5,
        title: "Chief Physician",
        requirementLabel: "130 job points and Intelligence 210+",
        requirementRule: { minimumIntelligence: 210 },
        dailyGold: 175,
        dailyJobPoints: 5,
        workingStatGains: { intelligence: 2, endurance: 2 },
        passiveUnlock: MEDICAL_SPECIAL,
      },
    ],
  },
  {
    id: "academy_staff",
    name: "Education",
    subtitle: "Teach, catalogue, supervise, and endure the administrative ritual known as academia.",
    interviewPrompt: "Why should Nexis trust you around lessons, records, and people asking obvious questions?",
    entryRequirements: ["Basic Literacy completed", "Study Discipline completed", "Intelligence 14+"],
    entryRule: { completedCourses: ["basic-literacy", "study-discipline"], minimumIntelligence: 14 },
    specialties: ["Strong Intelligence growth", "Steady salary", "Final education-speed passive"],
    ranks: [
      {
        rank: 1,
        title: "Teaching Aide",
        requirementLabel: "Starter",
        dailyGold: 30,
        dailyJobPoints: 1,
        workingStatGains: { intelligence: 1 },
      },
      {
        rank: 2,
        title: "Tutor",
        requirementLabel: "10 job points and Intelligence 40+",
        requirementRule: { minimumIntelligence: 40 },
        dailyGold: 55,
        dailyJobPoints: 2,
        workingStatGains: { intelligence: 1, endurance: 1 },
      },
      {
        rank: 3,
        title: "Lecturer",
        requirementLabel: "30 job points and Intelligence 85+",
        requirementRule: { minimumIntelligence: 85 },
        dailyGold: 85,
        dailyJobPoints: 3,
        workingStatGains: { intelligence: 2 },
      },
      {
        rank: 4,
        title: "Professor",
        requirementLabel: "70 job points and Intelligence 145+",
        requirementRule: { minimumIntelligence: 145 },
        dailyGold: 120,
        dailyJobPoints: 4,
        workingStatGains: { intelligence: 2, endurance: 1 },
      },
      {
        rank: 5,
        title: "Chancellor",
        requirementLabel: "130 job points and Intelligence 230+",
        requirementRule: { minimumIntelligence: 230 },
        dailyGold: 165,
        dailyJobPoints: 5,
        workingStatGains: { intelligence: 3 },
        passiveUnlock: EDUCATION_SPECIAL,
      },
    ],
  },
  {
    id: "trade_office",
    name: "Grocer",
    subtitle: "Shelf stock, supply runs, bulk orders, and the noble craft of making small margins very large.",
    interviewPrompt: "Why should the city trust you with stockrooms, ledgers, and legal retail?",
    entryRequirements: ["Practical Arithmetic completed", "Working stats total 35+", "Not currently jailed"],
    entryRule: { completedCourses: ["practical-arithmetic"], minimumWorkingTotal: 35, requireNotJailed: true },
    specialties: ["Manual Labor growth", "Intelligence growth", "Final market-discount passive"],
    ranks: [
      {
        rank: 1,
        title: "Stock Clerk",
        requirementLabel: "Starter",
        dailyGold: 40,
        dailyJobPoints: 1,
        workingStatGains: { manualLabor: 1, intelligence: 1 },
      },
      {
        rank: 2,
        title: "Shop Assistant",
        requirementLabel: "10 job points and Working stats 65+ total",
        requirementRule: { minimumWorkingTotal: 65 },
        dailyGold: 60,
        dailyJobPoints: 2,
        workingStatGains: { manualLabor: 1, intelligence: 1 },
      },
      {
        rank: 3,
        title: "Buyer",
        requirementLabel: "30 job points and Intelligence 55+",
        requirementRule: { minimumIntelligence: 55 },
        dailyGold: 90,
        dailyJobPoints: 3,
        workingStatGains: { manualLabor: 1, intelligence: 2 },
      },
      {
        rank: 4,
        title: "Manager",
        requirementLabel: "70 job points and Working stats 170+ total",
        requirementRule: { minimumWorkingTotal: 170 },
        dailyGold: 125,
        dailyJobPoints: 4,
        workingStatGains: { manualLabor: 1, intelligence: 2 },
      },
      {
        rank: 5,
        title: "Regional Director",
        requirementLabel: "130 job points and Working stats 260+ total",
        requirementRule: { minimumWorkingTotal: 260 },
        dailyGold: 175,
        dailyJobPoints: 5,
        workingStatGains: { manualLabor: 2, intelligence: 2 },
        passiveUnlock: GROCER_SPECIAL,
      },
    ],
  },
  {
    id: "civic_bureau",
    name: "Law",
    subtitle: "Case files, court procedure, citations, and the sort of authority that travels with paperwork.",
    interviewPrompt: "Why should Nexis let you near its legal machinery and people it would rather correct?",
    entryRequirements: ["Basic Literacy completed", "Civic Fundamentals completed", "Intelligence 15+"],
    entryRule: { completedCourses: ["basic-literacy", "civic-fundamentals"], minimumIntelligence: 15 },
    specialties: ["Intelligence growth", "Endurance growth", "Final jail-reduction passive"],
    ranks: [
      {
        rank: 1,
        title: "Clerk",
        requirementLabel: "Starter",
        dailyGold: 35,
        dailyJobPoints: 1,
        workingStatGains: { intelligence: 1, endurance: 1 },
      },
      {
        rank: 2,
        title: "Caseworker",
        requirementLabel: "10 job points and Intelligence 45+",
        requirementRule: { minimumIntelligence: 45 },
        dailyGold: 60,
        dailyJobPoints: 2,
        workingStatGains: { intelligence: 1, endurance: 1 },
      },
      {
        rank: 3,
        title: "Magistrate's Aide",
        requirementLabel: "30 job points and Intelligence 85+",
        requirementRule: { minimumIntelligence: 85 },
        dailyGold: 90,
        dailyJobPoints: 3,
        workingStatGains: { intelligence: 2, endurance: 1 },
      },
      {
        rank: 4,
        title: "Prosecutor",
        requirementLabel: "70 job points and Intelligence 145+",
        requirementRule: { minimumIntelligence: 145 },
        dailyGold: 125,
        dailyJobPoints: 4,
        workingStatGains: { intelligence: 2, endurance: 1 },
      },
      {
        rank: 5,
        title: "Chief Jurist",
        requirementLabel: "130 job points and Intelligence 220+",
        requirementRule: { minimumIntelligence: 220 },
        dailyGold: 170,
        dailyJobPoints: 5,
        workingStatGains: { intelligence: 2, endurance: 2 },
        passiveUnlock: LAW_SPECIAL,
      },
    ],
  },
  {
    id: "forge_union",
    name: "Casino",
    subtitle: "Tables, chips, odds, and the deeply respectable business of profiting from bad decisions.",
    interviewPrompt: "Why should Nexis trust you on the gaming floor when money and impulse are in a knife fight?",
    entryRequirements: ["Intelligence 12+", "Manual Labor 12+", "Not currently hospitalized"],
    entryRule: { minimumIntelligence: 12, minimumManualLabor: 12, requireNotHospitalized: true },
    specialties: ["Intelligence growth", "Manual Labor growth", "Higher late salary"],
    ranks: [
      {
        rank: 1,
        title: "Floor Runner",
        requirementLabel: "Starter",
        dailyGold: 45,
        dailyJobPoints: 1,
        workingStatGains: { intelligence: 1, manualLabor: 1 },
      },
      {
        rank: 2,
        title: "Dealer",
        requirementLabel: "10 job points and Intelligence 35+",
        requirementRule: { minimumIntelligence: 35 },
        dailyGold: 70,
        dailyJobPoints: 2,
        workingStatGains: { intelligence: 1, manualLabor: 1 },
      },
      {
        rank: 3,
        title: "Pit Boss",
        requirementLabel: "30 job points and Intelligence 70+",
        requirementRule: { minimumIntelligence: 70 },
        dailyGold: 105,
        dailyJobPoints: 3,
        workingStatGains: { intelligence: 2, manualLabor: 1 },
      },
      {
        rank: 4,
        title: "Operations Manager",
        requirementLabel: "70 job points and Working stats 180+ total",
        requirementRule: { minimumWorkingTotal: 180 },
        dailyGold: 145,
        dailyJobPoints: 4,
        workingStatGains: { intelligence: 2, manualLabor: 1 },
      },
      {
        rank: 5,
        title: "House Director",
        requirementLabel: "130 job points and Working stats 280+ total",
        requirementRule: { minimumWorkingTotal: 280 },
        dailyGold: 200,
        dailyJobPoints: 5,
        workingStatGains: { intelligence: 2, manualLabor: 2 },
      },
    ],
  },
];

export function getCivicTrack(trackId: CivicJobTrackId) {
  return CIVIC_JOB_TRACKS.find((track) => track.id === trackId) ?? null;
}

export function getWorkingStatLabel(stat: WorkingStatKey) {
  if (stat === "manualLabor") return "Manual Labor";
  if (stat === "intelligence") return "Intelligence";
  return "Endurance";
}

export function formatWorkingStatGains(gains: Partial<Record<WorkingStatKey, number>>) {
  return (Object.entries(gains) as Array<[WorkingStatKey, number]>)
    .filter((entry) => (entry[1] ?? 0) > 0)
    .map(([stat, amount]) => `+${amount} ${getWorkingStatLabel(stat)}`)
    .join(" | ");
}
