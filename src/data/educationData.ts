export type EducationStatRewards = Partial<{
  strength: number;
  dexterity: number;
  defense: number;
  speed: number;
}>;

export type EducationWorkingStatRewards = Partial<{
  manualLabor: number;
  intelligence: number;
  endurance: number;
}>;

export type EducationRewardKind =
  | "utility"
  | "combat"
  | "economy"
  | "travel"
  | "shadow"
  | "governance";

export type EducationCourse = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  durationDays: number;
  costGold: number;
  description: string;
  rewardKind: EducationRewardKind;
  prerequisites?: string[];
  statRewards?: EducationStatRewards;
  workingStatRewards?: EducationWorkingStatRewards;
  systemEffects?: string[];
  unlocksSystems?: string[];
  summaryLines: string[];
};

export type EducationCategory = {
  id: string;
  name: string;
  description: string;
  courses: EducationCourse[];
};

function makeCourse(categoryId: string, index: number, data: Omit<EducationCourse, "categoryId" | "code">): EducationCourse {
  return {
    ...data,
    categoryId,
    code: `${categoryId.slice(0, 3).toUpperCase()}-${String(index).padStart(2, "0")}`,
  };
}

export const educationCategories: EducationCategory[] = [
  {
    id: "general",
    name: "General Studies",
    description: "Broad foundational education that improves world access and overall efficiency.",
    courses: [
      makeCourse("general", 1, {
        id: "basic-literacy",
        name: "Basic Literacy",
        durationDays: 9,
        costGold: 1000,
        description: "Reading and comprehension training that speeds up all later study.",
        rewardKind: "utility",
        systemEffects: ["Education speed +5%"],
        summaryLines: ["Education speed +5%", "Required foundation for later study-heavy trees"],
      }),
      makeCourse("general", 2, {
        id: "practical-arithmetic",
        name: "Practical Arithmetic",
        durationDays: 10,
        costGold: 1200,
        description: "Counting, valuation, and transactional reasoning. Commerce should not be run by people who fear numbers.",
        rewardKind: "economy",
        prerequisites: ["basic-literacy"],
        workingStatRewards: { manualLabor: 1, intelligence: 3 },
        systemEffects: ["Unlocks commerce", "Market efficiency +5%", "Job income +3%"],
        unlocksSystems: ["commerce"],
        summaryLines: ["Unlocks Commerce", "Market efficiency +5%", "Job income +3%", "Manual Labor +1, Intelligence +3"],
      }),
      makeCourse("general", 3, {
        id: "world-geography",
        name: "World Geography",
        durationDays: 12,
        costGold: 1400,
        description: "Maps, routes, terrain logic, and travel safety.",
        rewardKind: "travel",
        prerequisites: ["basic-literacy"],
        workingStatRewards: { intelligence: 2, endurance: 2 },
        systemEffects: ["Travel time -5%", "Unlocks passive discovery events", "Prevents being lost during full travel"],
        unlocksSystems: ["safe_travel", "travel_discovery"],
        summaryLines: ["Travel time -5%", "Unlocks travel discoveries", "Prevents getting lost on proper routes", "Intelligence +2, Endurance +2"],
      }),
      makeCourse("general", 4, {
        id: "civic-fundamentals",
        name: "Civic Fundamentals",
        durationDays: 11,
        costGold: 1500,
        description: "Permits, civic structures, public obligations, and legal standing.",
        rewardKind: "governance",
        prerequisites: ["practical-arithmetic"],
        workingStatRewards: { intelligence: 3 },
        systemEffects: ["Unlocks consortium creation", "Unlocks permits", "Unlocks civic contracts"],
        unlocksSystems: ["consortium_creation", "permits", "civic_contracts"],
        summaryLines: ["Required for Consortium creation", "Unlocks permits", "Unlocks civic contracts", "Intelligence +3"],
      }),
      makeCourse("general", 5, {
        id: "study-discipline",
        name: "Study Discipline",
        durationDays: 13,
        costGold: 1600,
        description: "Focus, scheduling, memory discipline, and sustained learning.",
        rewardKind: "utility",
        prerequisites: ["basic-literacy"],
        workingStatRewards: { intelligence: 2 },
        systemEffects: ["Education speed +5%"],
        summaryLines: ["Education speed +5%", "Stacks with Basic Literacy", "Intelligence +2"],
      }),
      makeCourse("general", 6, {
        id: "applied-reasoning",
        name: "Applied Reasoning",
        durationDays: 14,
        costGold: 1800,
        description: "Pattern recognition and practical problem solving for missions, contracts, and investigations.",
        rewardKind: "utility",
        prerequisites: ["study-discipline"],
        workingStatRewards: { intelligence: 3, endurance: 1 },
        systemEffects: ["Mission success +5%", "Contract success +5%", "Investigation success +5%"],
        summaryLines: ["Mission success +5%", "Contract success +5%", "Investigation success +5%", "Intelligence +3, Endurance +1"],
      }),
      makeCourse("general", 7, {
        id: "historical-awareness",
        name: "Historical Awareness",
        durationDays: 16,
        costGold: 2200,
        description: "Ruins make more sense when you know what fell there and why.",
        rewardKind: "travel",
        prerequisites: ["world-geography"],
        workingStatRewards: { intelligence: 2 },
        systemEffects: ["Discovery loot +15%", "Unlocks relic clues", "Unlocks lore-heavy dialogue"],
        unlocksSystems: ["relic_missions", "lore_dialogue"],
        summaryLines: ["Discovery loot +15%", "Unlocks relic clues", "Unlocks lore missions", "Intelligence +2"],
      }),
      makeCourse("general", 8, {
        id: "field-survival",
        name: "Field Survival",
        durationDays: 15,
        costGold: 2100,
        description: "Endurance, recovery, and staying functional outside safe walls.",
        rewardKind: "combat",
        prerequisites: ["world-geography"],
        workingStatRewards: { endurance: 5, intelligence: 1 },
        systemEffects: ["Health regeneration +10%"],
        summaryLines: ["Health regeneration +10%", "Endurance +5", "Intelligence +1"],
      }),
      makeCourse("general", 9, {
        id: "general-mastery",
        name: "General Mastery",
        durationDays: 22,
        costGold: 3500,
        description: "Completion of the full foundational line. Expensive, slow, and worth it.",
        rewardKind: "utility",
        prerequisites: [
          "basic-literacy",
          "practical-arithmetic",
          "world-geography",
          "civic-fundamentals",
          "study-discipline",
          "applied-reasoning",
          "historical-awareness",
          "field-survival",
        ],
        systemEffects: ["All battle stats +5%", "All working stats +5%"],
        unlocksSystems: ["general_mastery"],
        summaryLines: ["All battle stats +5%", "All working stats +5%", "Requires all previous General Studies courses"],
      }),
    ],
  },
  {
    id: "street",
    name: "Street Survival",
    description: "Urban awareness, illicit literacy, and underworld fundamentals before academy-bound shadow specialization.",
    courses: [
      makeCourse("street", 1, {
        id: "back-alley-awareness",
        name: "Back Alley Awareness",
        durationDays: 9,
        costGold: 1000,
        description: "Recognizing bad routes before they recognize you.",
        rewardKind: "shadow",
        systemEffects: ["Awareness +5%"],
        summaryLines: ["Awareness +5%", "Improves low-tier urban safety"],
      }),
      makeCourse("street", 2, {
        id: "reading-intentions",
        name: "Reading Intentions",
        durationDays: 10,
        costGold: 1200,
        description: "Body language, motive reading, and small lies.",
        rewardKind: "shadow",
        prerequisites: ["back-alley-awareness"],
        workingStatRewards: { intelligence: 2 },
        systemEffects: ["Underworld encounter success +3%"],
        summaryLines: ["Underworld encounter success +3%", "Better hostile read quality", "Intelligence +2"],
      }),
      makeCourse("street", 3, {
        id: "cheap-tricks",
        name: "Cheap Tricks",
        durationDays: 11,
        costGold: 1400,
        description: "Distractions, bait, and grubby little advantages.",
        rewardKind: "shadow",
        prerequisites: ["reading-intentions"],
        systemEffects: ["Unlocks petty criminal errands"],
        unlocksSystems: ["petty_crime"],
        summaryLines: ["Unlocks petty criminal errands", "Urban utility progression"],
      }),
      makeCourse("street", 4, {
        id: "street-rumors",
        name: "Street Rumors",
        durationDays: 12,
        costGold: 1500,
        description: "Knowing who knows who matters more than pretending morality is enough.",
        rewardKind: "shadow",
        prerequisites: ["cheap-tricks"],
        workingStatRewards: { intelligence: 1, endurance: 1 },
        unlocksSystems: ["underworld_contacts"],
        summaryLines: ["Unlocks underworld contacts", "Unlocks rumor-based errands", "Intelligence +1, Endurance +1"],
      }),
      makeCourse("street", 5, {
        id: "concealment-basics",
        name: "Concealment Basics",
        durationDays: 13,
        costGold: 1700,
        description: "Stashing, disguising, and not drawing the eye.",
        rewardKind: "shadow",
        prerequisites: ["street-rumors"],
        workingStatRewards: { endurance: 2 },
        systemEffects: ["Stealth +4%"],
        summaryLines: ["Stealth +4%", "Improves concealment behavior", "Endurance +2"],
      }),
      makeCourse("street", 6, {
        id: "illicit-trade-awareness",
        name: "Illicit Trade Awareness",
        durationDays: 14,
        costGold: 1900,
        description: "Recognizing unlawful supply and how it moves.",
        rewardKind: "shadow",
        prerequisites: ["concealment-basics"],
        unlocksSystems: ["illicit_trade"],
        summaryLines: ["Unlocks illicit trade awareness", "Prepares for deeper criminal routes"],
      }),
      makeCourse("street", 7, {
        id: "urban-escape-routes",
        name: "Urban Escape Routes",
        durationDays: 15,
        costGold: 2000,
        description: "Because every plan eventually needs a second door.",
        rewardKind: "shadow",
        prerequisites: ["illicit-trade-awareness"],
        workingStatRewards: { endurance: 2, intelligence: 1 },
        systemEffects: ["Escape chance +5%"],
        summaryLines: ["Escape chance +5%", "Better route withdrawal under pressure", "Endurance +2, Intelligence +1"],
      }),
      makeCourse("street", 8, {
        id: "underworld-etiquette",
        name: "Underworld Etiquette",
        durationDays: 16,
        costGold: 2300,
        description: "Rules, signals, expectations, and the cost of ignorance.",
        rewardKind: "shadow",
        prerequisites: ["urban-escape-routes"],
        unlocksSystems: ["western_shadow_specialization_pathway"],
        summaryLines: ["Completes Street Survival", "Required before Western Academy Shadowcraft specialization"],
      }),
      makeCourse("street", 9, {
        id: "streetwise-mastery",
        name: "Streetwise Mastery",
        durationDays: 20,
        costGold: 3000,
        description: "Full command of urban survival and underworld baseline movement.",
        rewardKind: "shadow",
        prerequisites: ["underworld-etiquette"],
        systemEffects: ["Urban action success +5%"],
        unlocksSystems: ["western_shadow_specialization_ready"],
        summaryLines: ["Prepares Western Shadowcraft specialization", "Urban action success +5%"],
      }),
    ],
  },
  {
    id: "commerce",
    name: "Applied Knowledge",
    description: "Practical scholarship that turns foundations into system access: trade literacy, route planning, permits, investigations, and institutional leverage.",
    courses: [
      makeCourse("commerce", 1, {
        id: "applied-ledgers",
        name: "Applied Ledgers",
        durationDays: 10,
        costGold: 1600,
        description: "Practical bookkeeping for markets, civic offices, and organization treasuries.",
        rewardKind: "economy",
        prerequisites: ["practical-arithmetic"],
        workingStatRewards: { intelligence: 2 },
        systemEffects: ["Market reading +5%", "Unlocks trade ledgers"],
        unlocksSystems: ["trade_ledgers", "market_reading"],
        summaryLines: ["Market reading +5%", "Unlocks trade ledgers", "Intelligence +2"],
      }),
      makeCourse("commerce", 2, {
        id: "route-surveying",
        name: "Route Surveying",
        durationDays: 12,
        costGold: 1900,
        description: "Surveying roads, ports, and dangerous shortcuts without treating maps like decorative paper.",
        rewardKind: "travel",
        prerequisites: ["world-geography"],
        workingStatRewards: { intelligence: 2, endurance: 1 },
        systemEffects: ["Route requirement visibility +1", "Discovery checks +5%"],
        unlocksSystems: ["route_requirements", "regional_discovery"],
        summaryLines: ["Shows clearer route requirements", "Discovery checks +5%", "Intelligence +2, Endurance +1"],
      }),
      makeCourse("commerce", 3, {
        id: "permit-procedure",
        name: "Permit Procedure",
        durationDays: 13,
        costGold: 2100,
        description: "Applications, filings, office etiquette, and the dark art of making paperwork move.",
        rewardKind: "governance",
        prerequisites: ["civic-fundamentals", "applied-ledgers"],
        workingStatRewards: { intelligence: 3 },
        systemEffects: ["Permit handling +5%", "Property Office clarity +1"],
        unlocksSystems: ["property_permits", "organization_filings"],
        summaryLines: ["Improves organization permit handling", "Clarifies Property Office requirements", "Intelligence +3"],
      }),
      makeCourse("commerce", 4, {
        id: "field-investigation",
        name: "Field Investigation",
        durationDays: 14,
        costGold: 2400,
        description: "Evidence handling, witness reading, and knowing when a quiet room is too quiet.",
        rewardKind: "utility",
        prerequisites: ["applied-reasoning", "historical-awareness"],
        workingStatRewards: { intelligence: 2, endurance: 1 },
        systemEffects: ["Investigation success +5%", "Chronicle clue quality +1"],
        unlocksSystems: ["chronicle_clues", "investigation_briefs"],
        summaryLines: ["Investigation success +5%", "Improves Chronicle clue quality", "Intelligence +2, Endurance +1"],
      }),
      makeCourse("commerce", 5, {
        id: "institutional-logistics",
        name: "Institutional Logistics",
        durationDays: 16,
        costGold: 2800,
        description: "Moving people, materials, and obligations through organizations without losing half of them.",
        rewardKind: "economy",
        prerequisites: ["permit-procedure", "route-surveying"],
        workingStatRewards: { manualLabor: 1, intelligence: 3, endurance: 1 },
        systemEffects: ["Consortium logistics +5%", "Builder coordination +5%"],
        unlocksSystems: ["consortium_logistics_bonus", "builder_coordination"],
        summaryLines: ["Consortium logistics +5%", "Builder coordination +5%", "Manual Labor +1, Intelligence +3, Endurance +1"],
      }),
      makeCourse("commerce", 6, {
        id: "applied-mastery",
        name: "Applied Mastery",
        durationDays: 21,
        costGold: 3600,
        description: "A capstone for players who want the world to open because they understand how its systems interlock.",
        rewardKind: "governance",
        prerequisites: ["institutional-logistics", "field-investigation", "general-mastery"],
        workingStatRewards: { intelligence: 4 },
        systemEffects: ["World system unlock hints +1", "Organization planning +5%"],
        unlocksSystems: ["applied_mastery", "world_unlock_hints"],
        summaryLines: ["Improves world unlock hints", "Organization planning +5%", "Requires General Mastery and Applied Knowledge roots"],
      }),
    ],
  },
  {
    id: "trade",
    name: "Commerce & Logistics",
    description: "Trade, ledgers, supply lines, and the noble profession of weaponizing paperwork.",
    courses: [
      makeCourse("trade", 1, {
        id: "ledger-basics",
        name: "Ledger Basics",
        durationDays: 10,
        costGold: 1500,
        description: "Bookkeeping, margins, and not losing coin to stupidity.",
        rewardKind: "economy",
        workingStatRewards: { intelligence: 2 },
        summaryLines: ["Intelligence +2", "Foundation for advanced trade courses"],
      }),
      makeCourse("trade", 2, {
        id: "supply-discipline",
        name: "Supply Discipline",
        durationDays: 11,
        costGold: 1700,
        description: "Storage logic, movement efficiency, and keeping stock where stock belongs.",
        rewardKind: "economy",
        prerequisites: ["ledger-basics"],
        workingStatRewards: { manualLabor: 2, intelligence: 1 },
        systemEffects: ["Storage efficiency +5%"],
        summaryLines: ["Storage efficiency +5%", "Manual Labor +2, Intelligence +1"],
      }),
      makeCourse("trade", 3, {
        id: "caravan-operations",
        name: "Caravan Operations",
        durationDays: 13,
        costGold: 2200,
        description: "Trade routes, convoy pacing, cargo security, and surviving greedy roads.",
        rewardKind: "travel",
        prerequisites: ["supply-discipline"],
        workingStatRewards: { manualLabor: 1, intelligence: 2, endurance: 2 },
        systemEffects: ["Trade route income +4%"],
        summaryLines: ["Trade route income +4%", "Manual Labor +1, Intelligence +2, Endurance +2"],
      }),
      makeCourse("trade", 4, {
        id: "merchant-command",
        name: "Merchant Command",
        durationDays: 16,
        costGold: 3000,
        description: "Negotiation, delegation, and convincing a roomful of traders to respect numbers.",
        rewardKind: "governance",
        prerequisites: ["caravan-operations"],
        workingStatRewards: { intelligence: 3, endurance: 1 },
        systemEffects: ["Consortium income +5%"],
        summaryLines: ["Consortium income +5%", "Intelligence +3, Endurance +1"],
      }),
    ],
  },
  {
    id: "warfare",
    name: "Warfare & Fieldcraft",
    description: "Marching, discipline, tactics, and all the usual reasons soldiers need stronger knees.",
    courses: [
      makeCourse("warfare", 1, {
        id: "drill-square-basics",
        name: "Drill Square Basics",
        durationDays: 10,
        costGold: 1600,
        description: "Formation discipline, footing, and surviving repeated shouted instructions.",
        rewardKind: "combat",
        workingStatRewards: { endurance: 2 },
        statRewards: { defense: 2 },
        summaryLines: ["Defense +2", "Endurance +2"],
      }),
      makeCourse("warfare", 2, {
        id: "weapon-conditioning",
        name: "Weapon Conditioning",
        durationDays: 12,
        costGold: 2000,
        description: "Grip strength, repetition, and learning to enjoy soreness for bad reasons.",
        rewardKind: "combat",
        prerequisites: ["drill-square-basics"],
        workingStatRewards: { manualLabor: 2, endurance: 1 },
        statRewards: { strength: 2 },
        summaryLines: ["Strength +2", "Manual Labor +2, Endurance +1"],
      }),
      makeCourse("warfare", 3, {
        id: "march-survival",
        name: "March Survival",
        durationDays: 14,
        costGold: 2400,
        description: "Carry weight, keep pace, and complain internally like a professional.",
        rewardKind: "travel",
        prerequisites: ["weapon-conditioning"],
        workingStatRewards: { endurance: 3, manualLabor: 1 },
        systemEffects: ["Travel fatigue resistance +5%"],
        summaryLines: ["Travel fatigue resistance +5%", "Endurance +3, Manual Labor +1"],
      }),
      makeCourse("warfare", 4, {
        id: "battlefield-reading",
        name: "Battlefield Reading",
        durationDays: 16,
        costGold: 2800,
        description: "Threat recognition, angle control, and surviving chaos without theatrics.",
        rewardKind: "combat",
        prerequisites: ["march-survival"],
        workingStatRewards: { intelligence: 2, endurance: 1 },
        statRewards: { speed: 1, dexterity: 1 },
        summaryLines: ["Speed +1, Dexterity +1", "Intelligence +2, Endurance +1"],
      }),
    ],
  },
  {
    id: "medicine",
    name: "Medicine & Recovery",
    description: "Field treatment, recovery care, and cleaning up after everyone else's spectacular choices.",
    courses: [
      makeCourse("medicine", 1, {
        id: "field-triage",
        name: "Field Triage",
        durationDays: 9,
        costGold: 1400,
        description: "Stop bleeding, sort priorities, and try not to faint professionally.",
        rewardKind: "utility",
        workingStatRewards: { intelligence: 2, endurance: 1 },
        summaryLines: ["Intelligence +2, Endurance +1", "Foundation for medical study"],
      }),
      makeCourse("medicine", 2, {
        id: "herbal-remedies",
        name: "Herbal Remedies",
        durationDays: 11,
        costGold: 1800,
        description: "Useful plants, useless plants, and plants with revenge issues.",
        rewardKind: "utility",
        prerequisites: ["field-triage"],
        workingStatRewards: { intelligence: 2, manualLabor: 1 },
        systemEffects: ["Hospital recovery speed +4%"],
        summaryLines: ["Hospital recovery speed +4%", "Intelligence +2, Manual Labor +1"],
      }),
      makeCourse("medicine", 3, {
        id: "ward-management",
        name: "Ward Management",
        durationDays: 13,
        costGold: 2200,
        description: "Supplies, patient flow, and the administrative side of human bad luck.",
        rewardKind: "governance",
        prerequisites: ["herbal-remedies"],
        workingStatRewards: { intelligence: 3 },
        systemEffects: ["Medical civic job performance +5%"],
        summaryLines: ["Medical civic job performance +5%", "Intelligence +3"],
      }),
      makeCourse("medicine", 4, {
        id: "restorative-practice",
        name: "Restorative Practice",
        durationDays: 16,
        costGold: 2900,
        description: "Long-form recovery care for when brute force stops being a treatment plan.",
        rewardKind: "utility",
        prerequisites: ["ward-management"],
        workingStatRewards: { intelligence: 2, endurance: 2 },
        systemEffects: ["Hospital time reduced by 5%"],
        summaryLines: ["Hospital time reduced by 5%", "Intelligence +2, Endurance +2"],
      }),
    ],
  },
];

export const educationCourseMap: Record<string, EducationCourse> = Object.fromEntries(
  educationCategories.flatMap((category) => category.courses.map((course) => [course.id, course])),
);

export function getCourseState(
  course: EducationCourse,
  education: {
    activeCourse: { courseId: string } | null;
    isCourseCompleted: (courseId: string) => boolean;
    isCourseLocked: (course: EducationCourse) => boolean;
  },
): "completed" | "current" | "locked" | "available" {
  if (education.isCourseCompleted(course.id)) return "completed";
  if (education.activeCourse?.courseId === course.id) return "current";
  if (education.isCourseLocked(course)) return "locked";
  return "available";
}
