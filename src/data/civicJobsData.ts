export type CivicJobTrackId =
  | "city_guard"
  | "medical_corps"
  | "academy_staff"
  | "trade_office"
  | "civic_bureau"
  | "forge_union";

export interface CivicJobRank {
  rank: number;
  title: string;
  requirementLabel: string;
  requirementRule?: CivicRankRequirementRule;
  dailyGold: number;
  dailyJobPoints: number;
  passiveSummary: string;
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

export const CIVIC_JOB_TRACKS: CivicJobTrack[] = [
  {
    id: "city_guard",
    name: "City Guard",
    subtitle: "Order, patrols, and the occasional reminder that laws are mostly paperwork with weapons.",
    interviewPrompt: "Why should Nexis trust you with its walls and citizens?",
    entryRequirements: ["Battle-ready fundamentals", "No active jail sentence", "Working stats total 30+"],
    entryRule: { minimumWorkingTotal: 30, requireNotJailed: true },
    specialties: ["Patrol bonuses", "Slight arrest resistance later", "Better defensive duty income"],
    ranks: [
      { rank: 1, title: "Watch Recruit", requirementLabel: "Starter", dailyGold: 120, dailyJobPoints: 2, passiveSummary: "+1% civic respect gain" },
      { rank: 2, title: "Gate Watcher", requirementLabel: "Working stats 75+ total", requirementRule: { minimumWorkingTotal: 75 }, dailyGold: 180, dailyJobPoints: 3, passiveSummary: "+1% travel safety in nearby routes" },
      { rank: 3, title: "Patrolman", requirementLabel: "Working stats 140+ total", requirementRule: { minimumWorkingTotal: 140 }, dailyGold: 260, dailyJobPoints: 4, passiveSummary: "+2% civic respect gain" },
      { rank: 4, title: "Shield Sergeant", requirementLabel: "Working stats 240+ total", requirementRule: { minimumWorkingTotal: 240 }, dailyGold: 360, dailyJobPoints: 5, passiveSummary: "+2% defensive recovery speed" },
      { rank: 5, title: "Wall Captain", requirementLabel: "Working stats 400+ total", requirementRule: { minimumWorkingTotal: 400 }, dailyGold: 500, dailyJobPoints: 6, passiveSummary: "+3% city security actions" },
    ],
  },
  {
    id: "medical_corps",
    name: "Medical Corps",
    subtitle: "Patching up people who keep making terrible decisions. A growth sector.",
    interviewPrompt: "How do you stay calm when someone arrives leaking enthusiasm and blood?",
    entryRequirements: ["Basic Literacy completed", "Intelligence 12+", "Not currently hospitalized"],
    entryRule: { completedCourses: ["basic-literacy"], minimumIntelligence: 12, requireNotHospitalized: true },
    specialties: ["Recovery bonuses", "Potion quality later", "Hospital utility"],
    ranks: [
      { rank: 1, title: "Ward Runner", requirementLabel: "Starter", dailyGold: 110, dailyJobPoints: 2, passiveSummary: "+1% recovery speed" },
      { rank: 2, title: "Apothecary Aide", requirementLabel: "Intelligence 40+", requirementRule: { minimumIntelligence: 40 }, dailyGold: 170, dailyJobPoints: 3, passiveSummary: "+1% potion efficiency" },
      { rank: 3, title: "Field Medic", requirementLabel: "Intelligence 90+", requirementRule: { minimumIntelligence: 90 }, dailyGold: 250, dailyJobPoints: 4, passiveSummary: "+2% recovery speed" },
      { rank: 4, title: "Surgical Hand", requirementLabel: "Intelligence 160+", requirementRule: { minimumIntelligence: 160 }, dailyGold: 340, dailyJobPoints: 5, passiveSummary: "+2% revive-style service quality" },
      { rank: 5, title: "Hospital Master", requirementLabel: "Intelligence 260+", requirementRule: { minimumIntelligence: 260 }, dailyGold: 470, dailyJobPoints: 6, passiveSummary: "+3% medical service output" },
    ],
  },
  {
    id: "academy_staff",
    name: "Academy Staff",
    subtitle: "A noble profession, mostly consisting of paperwork, dust, and explaining obvious things repeatedly.",
    interviewPrompt: "How would you support the city academy and its students?",
    entryRequirements: ["Basic Literacy completed", "Study Discipline completed", "Intelligence 14+"],
    entryRule: { completedCourses: ["basic-literacy", "study-discipline"], minimumIntelligence: 14 },
    specialties: ["Education speed support", "Course access later", "Library utility"],
    ranks: [
      { rank: 1, title: "Archive Clerk", requirementLabel: "Starter", dailyGold: 100, dailyJobPoints: 2, passiveSummary: "+1% education speed" },
      { rank: 2, title: "Study Attendant", requirementLabel: "Intelligence 50+", requirementRule: { minimumIntelligence: 50 }, dailyGold: 150, dailyJobPoints: 3, passiveSummary: "+1% course cost efficiency" },
      { rank: 3, title: "Assistant Lecturer", requirementLabel: "Intelligence 110+", requirementRule: { minimumIntelligence: 110 }, dailyGold: 230, dailyJobPoints: 4, passiveSummary: "+2% education speed" },
      { rank: 4, title: "Faculty Scribe", requirementLabel: "Intelligence 180+", requirementRule: { minimumIntelligence: 180 }, dailyGold: 320, dailyJobPoints: 5, passiveSummary: "+2% unlock tracking clarity" },
      { rank: 5, title: "Dean's Hand", requirementLabel: "Intelligence 300+", requirementRule: { minimumIntelligence: 300 }, dailyGold: 440, dailyJobPoints: 6, passiveSummary: "+3% education speed" },
    ],
  },
  {
    id: "trade_office",
    name: "Trade Office",
    subtitle: "Where numbers become power, invoices become weapons, and merchants pretend they are respectable.",
    interviewPrompt: "Why should the city trust you around trade manifests and money?",
    entryRequirements: ["Practical Arithmetic completed", "Working stats total 35+", "No active jail sentence"],
    entryRule: { completedCourses: ["practical-arithmetic"], minimumWorkingTotal: 35, requireNotJailed: true },
    specialties: ["Trade efficiency", "Market fees later", "Caravan support"],
    ranks: [
      { rank: 1, title: "Ledger Runner", requirementLabel: "Starter", dailyGold: 130, dailyJobPoints: 2, passiveSummary: "+1% trade income efficiency" },
      { rank: 2, title: "Manifest Clerk", requirementLabel: "Working stats 85+ total", requirementRule: { minimumWorkingTotal: 85 }, dailyGold: 190, dailyJobPoints: 3, passiveSummary: "+1% market fee efficiency" },
      { rank: 3, title: "Quarter Assessor", requirementLabel: "Working stats 150+ total", requirementRule: { minimumWorkingTotal: 150 }, dailyGold: 280, dailyJobPoints: 4, passiveSummary: "+2% trade income efficiency" },
      { rank: 4, title: "Route Auditor", requirementLabel: "Working stats 250+ total", requirementRule: { minimumWorkingTotal: 250 }, dailyGold: 380, dailyJobPoints: 5, passiveSummary: "+2% caravan outcome quality" },
      { rank: 5, title: "Trade Commissioner", requirementLabel: "Working stats 420+ total", requirementRule: { minimumWorkingTotal: 420 }, dailyGold: 520, dailyJobPoints: 6, passiveSummary: "+3% trade efficiency" },
    ],
  },
  {
    id: "civic_bureau",
    name: "Civic Bureau",
    subtitle: "Permits, records, fines, forms, and the dead-eyed rhythm of bureaucracy.",
    interviewPrompt: "What makes you suitable for civic administration?",
    entryRequirements: ["Basic Literacy completed", "Civic Fundamentals completed", "Intelligence 15+"],
    entryRule: { completedCourses: ["basic-literacy", "civic-fundamentals"], minimumIntelligence: 15 },
    specialties: ["Reputation gains", "Permit processing later", "Contract administration"],
    ranks: [
      { rank: 1, title: "Desk Clerk", requirementLabel: "Starter", dailyGold: 115, dailyJobPoints: 2, passiveSummary: "+1% civic reputation gain" },
      { rank: 2, title: "Records Scribe", requirementLabel: "Intelligence 60+", requirementRule: { minimumIntelligence: 60 }, dailyGold: 175, dailyJobPoints: 3, passiveSummary: "+1% permit efficiency" },
      { rank: 3, title: "Permit Officer", requirementLabel: "Intelligence 120+", requirementRule: { minimumIntelligence: 120 }, dailyGold: 255, dailyJobPoints: 4, passiveSummary: "+2% civic reputation gain" },
      { rank: 4, title: "Registrar", requirementLabel: "Intelligence 200+", requirementRule: { minimumIntelligence: 200 }, dailyGold: 350, dailyJobPoints: 5, passiveSummary: "+2% contract admin success" },
      { rank: 5, title: "Civic Marshal", requirementLabel: "Intelligence 320+", requirementRule: { minimumIntelligence: 320 }, dailyGold: 480, dailyJobPoints: 6, passiveSummary: "+3% civic gain efficiency" },
    ],
  },
  {
    id: "forge_union",
    name: "Forge Union",
    subtitle: "Heat, hammering, and very loud arguments about what counts as proper metalwork.",
    interviewPrompt: "Why should the forge trust your hands, lungs, and patience?",
    entryRequirements: ["Endurance 12+", "Manual Labor 12+", "Not currently hospitalized"],
    entryRule: { minimumEndurance: 12, minimumManualLabor: 12, requireNotHospitalized: true },
    specialties: ["Crafting support", "Material quality later", "Workshop utility"],
    ranks: [
      { rank: 1, title: "Coal Hand", requirementLabel: "Starter", dailyGold: 125, dailyJobPoints: 2, passiveSummary: "+1% crafting output" },
      { rank: 2, title: "Hammer Aide", requirementLabel: "Manual Labor 55+", requirementRule: { minimumManualLabor: 55 }, dailyGold: 185, dailyJobPoints: 3, passiveSummary: "+1% material efficiency" },
      { rank: 3, title: "Journeyman Smith", requirementLabel: "Manual Labor 120+", requirementRule: { minimumManualLabor: 120 }, dailyGold: 270, dailyJobPoints: 4, passiveSummary: "+2% crafting output" },
      { rank: 4, title: "Tempering Master", requirementLabel: "Manual Labor 210+", requirementRule: { minimumManualLabor: 210 }, dailyGold: 365, dailyJobPoints: 5, passiveSummary: "+2% equipment quality chance" },
      { rank: 5, title: "Guild Forgewarden", requirementLabel: "Manual Labor 340+", requirementRule: { minimumManualLabor: 340 }, dailyGold: 495, dailyJobPoints: 6, passiveSummary: "+3% workshop efficiency" },
    ],
  },
];
