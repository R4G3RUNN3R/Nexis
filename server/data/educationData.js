function makeCourse(categoryId, index, data) {
  return {
    ...data,
    categoryId,
    code: `${categoryId.slice(0, 3).toUpperCase()}-${String(index).padStart(2, "0")}`,
  };
}

export const educationCategories = [
  {
    id: "general",
    name: "General Studies",
    description: "Broad foundational education that improves world access and overall efficiency.",
    courses: [
      makeCourse("general", 1, {
        id: "basic-literacy",
        name: "Basic Literacy",
        durationDays: 9,
        costGold: 250,
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
    name: "Commerce & Trade / Economics",
    description: "Trade, ledgers, supply lines, demand reading, and city-facing profit work.",
    courses: [
      makeCourse("trade", 1, {
              "id": "ledger-basics",
              "name": "Ledger Basics",
              "durationDays": 10,
              "costGold": 1500,
              "description": "Bookkeeping, margins, and the discipline of knowing where coin went.",
              "rewardKind": "economy",
              "workingStatRewards": {
                      "intelligence": 2
              },
              "systemEffects": [
                      "Trade record clarity +5%"
              ],
              "summaryLines": [
                      "Trade record clarity +5%",
                      "Foundation for advanced trade courses",
                      "Intelligence +2"
              ]
      }),
      makeCourse("trade", 2, {
              "id": "supply-discipline",
              "name": "Supply Discipline",
              "durationDays": 11,
              "costGold": 1700,
              "description": "Storage logic, stock rotation, and moving goods without losing half the manifest.",
              "rewardKind": "economy",
              "prerequisites": [
                      "ledger-basics"
              ],
              "workingStatRewards": {
                      "manualLabor": 2,
                      "intelligence": 1
              },
              "systemEffects": [
                      "Storage efficiency +5%"
              ],
              "summaryLines": [
                      "Storage efficiency +5%",
                      "Manual Labor +2, Intelligence +1"
              ]
      }),
      makeCourse("trade", 3, {
              "id": "caravan-operations",
              "name": "Caravan Operations",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Convoy pacing, cargo security, and choosing routes that do not invite disaster.",
              "rewardKind": "travel",
              "prerequisites": [
                      "supply-discipline",
                      "world-geography"
              ],
              "workingStatRewards": {
                      "manualLabor": 1,
                      "intelligence": 2,
                      "endurance": 2
              },
              "systemEffects": [
                      "Trade route income +4%"
              ],
              "unlocksSystems": [
                      "trade_route_readiness"
              ],
              "summaryLines": [
                      "Trade route income +4%",
                      "Improves cargo route readiness",
                      "Manual Labor +1, Intelligence +2, Endurance +2"
              ]
      }),
      makeCourse("trade", 4, {
              "id": "demand-reading",
              "name": "Demand Reading",
              "durationDays": 14,
              "costGold": 2500,
              "description": "City demand, surplus signals, and when a good is worth hauling instead of hoarding.",
              "rewardKind": "economy",
              "prerequisites": [
                      "caravan-operations",
                      "practical-arithmetic"
              ],
              "workingStatRewards": {
                      "intelligence": 3
              },
              "systemEffects": [
                      "City demand visibility +1"
              ],
              "unlocksSystems": [
                      "city_demand_reading"
              ],
              "summaryLines": [
                      "Improves city demand hints",
                      "Better market opportunity reads",
                      "Intelligence +3"
              ]
      }),
      makeCourse("trade", 5, {
              "id": "merchant-command",
              "name": "Merchant Command",
              "durationDays": 18,
              "costGold": 3400,
              "description": "Delegation, negotiation, and running profitable work without turning every route into a fire drill.",
              "rewardKind": "governance",
              "prerequisites": [
                      "demand-reading",
                      "institutional-logistics"
              ],
              "workingStatRewards": {
                      "intelligence": 3,
                      "endurance": 1
              },
              "systemEffects": [
                      "Consortium income +5%"
              ],
              "unlocksSystems": [
                      "trade_mastery"
              ],
              "summaryLines": [
                      "Consortium income +5%",
                      "Improves company trade planning",
                      "Intelligence +3, Endurance +1"
              ]
      })
    ],
  },
  {
    id: "warfare",
    name: "Combat Training",
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
    name: "Medical & Biology",
    description: "Field treatment, recovery care, practical biology, and hospital-side support.",
    courses: [
      makeCourse("medicine", 1, {
              "id": "field-triage",
              "name": "Field Triage",
              "durationDays": 9,
              "costGold": 1400,
              "description": "Bleeding control, injury sorting, and useful calm when everyone else gets theatrical.",
              "rewardKind": "utility",
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 1
              },
              "systemEffects": [
                      "Field healing clarity +5%"
              ],
              "summaryLines": [
                      "Field healing clarity +5%",
                      "Intelligence +2, Endurance +1"
              ]
      }),
      makeCourse("medicine", 2, {
              "id": "herbal-remedies",
              "name": "Herbal Remedies",
              "durationDays": 11,
              "costGold": 1800,
              "description": "Useful plants, dangerous plants, and which ones belong in medicine instead of stew.",
              "rewardKind": "utility",
              "prerequisites": [
                      "field-triage"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "manualLabor": 1
              },
              "systemEffects": [
                      "Hospital recovery speed +4%"
              ],
              "summaryLines": [
                      "Hospital recovery speed +4%",
                      "Intelligence +2, Manual Labor +1"
              ]
      }),
      makeCourse("medicine", 3, {
              "id": "ward-management",
              "name": "Ward Management",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Supplies, patient flow, and recovery logistics for crowded city wards.",
              "rewardKind": "governance",
              "prerequisites": [
                      "herbal-remedies"
              ],
              "workingStatRewards": {
                      "intelligence": 3
              },
              "systemEffects": [
                      "Medical civic job performance +5%"
              ],
              "summaryLines": [
                      "Medical civic job performance +5%",
                      "Intelligence +3"
              ]
      }),
      makeCourse("medicine", 4, {
              "id": "restorative-practice",
              "name": "Restorative Practice",
              "durationDays": 16,
              "costGold": 2900,
              "description": "Long-form recovery care for serious wounds and exhausting expeditions.",
              "rewardKind": "utility",
              "prerequisites": [
                      "ward-management"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 2
              },
              "systemEffects": [
                      "Hospital time reduced by 5%"
              ],
              "summaryLines": [
                      "Hospital time reduced by 5%",
                      "Intelligence +2, Endurance +2"
              ]
      }),
      makeCourse("medicine", 5, {
              "id": "field-medicine-mastery",
              "name": "Field Medicine Mastery",
              "durationDays": 20,
              "costGold": 3700,
              "description": "A capstone for making medicine matter in expeditions, recovery, and city support work.",
              "rewardKind": "utility",
              "prerequisites": [
                      "restorative-practice",
                      "field-survival"
              ],
              "workingStatRewards": {
                      "intelligence": 3,
                      "endurance": 2
              },
              "systemEffects": [
                      "Medical and recovery outcomes +5%"
              ],
              "unlocksSystems": [
                      "medical_mastery"
              ],
              "summaryLines": [
                      "Medical and recovery outcomes +5%",
                      "Intelligence +3, Endurance +2",
                      "Medical capstone"
              ]
      })
    ],
  },
  {
    id: "physical",
    name: "Physical Conditioning",
    description: "Body conditioning, stamina, recovery, and field durability without pretending this is weapon mastery.",
    courses: [
      makeCourse("physical", 1, {
              "id": "body-conditioning",
              "name": "Body Conditioning",
              "durationDays": 11,
              "costGold": 1700,
              "description": "Baseline strength, posture, and controlled exertion for long-term survivability.",
              "rewardKind": "combat",
              "workingStatRewards": {
                      "endurance": 2
              },
              "systemEffects": [
                      "Recovery readiness +3%"
              ],
              "summaryLines": [
                      "Recovery readiness +3%",
                      "Endurance +2"
              ]
      }),
      makeCourse("physical", 2, {
              "id": "stamina-circuits",
              "name": "Stamina Circuits",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Repeated conditioning circuits that improve sustained action under pressure.",
              "rewardKind": "combat",
              "prerequisites": [
                      "body-conditioning"
              ],
              "workingStatRewards": {
                      "endurance": 2,
                      "manualLabor": 1
              },
              "systemEffects": [
                      "Stamina recovery +3%"
              ],
              "summaryLines": [
                      "Stamina recovery +3%",
                      "Endurance +2, Manual Labor +1"
              ]
      }),
      makeCourse("physical", 3, {
              "id": "recovery-discipline",
              "name": "Recovery Discipline",
              "durationDays": 15,
              "costGold": 2700,
              "description": "Rest cycles, injury management, and returning to duty without heroic stupidity.",
              "rewardKind": "utility",
              "prerequisites": [
                      "stamina-circuits"
              ],
              "workingStatRewards": {
                      "endurance": 3
              },
              "systemEffects": [
                      "Health recovery +4%"
              ],
              "summaryLines": [
                      "Health recovery +4%",
                      "Endurance +3"
              ]
      }),
      makeCourse("physical", 4, {
              "id": "field-load-bearing",
              "name": "Field Load Bearing",
              "durationDays": 16,
              "costGold": 3000,
              "description": "Carrying armor, tools, and supplies while remaining useful at the destination.",
              "rewardKind": "travel",
              "prerequisites": [
                      "recovery-discipline",
                      "field-survival"
              ],
              "workingStatRewards": {
                      "endurance": 3,
                      "manualLabor": 2
              },
              "systemEffects": [
                      "Travel fatigue resistance +5%"
              ],
              "summaryLines": [
                      "Travel fatigue resistance +5%",
                      "Endurance +3, Manual Labor +2"
              ]
      }),
      makeCourse("physical", 5, {
              "id": "conditioning-mastery",
              "name": "Conditioning Mastery",
              "durationDays": 19,
              "costGold": 3600,
              "description": "A capstone for durable characters who want recovery and travel stamina to feel earned.",
              "rewardKind": "combat",
              "prerequisites": [
                      "field-load-bearing"
              ],
              "workingStatRewards": {
                      "endurance": 4
              },
              "systemEffects": [
                      "Recovery and fatigue bonuses +5%"
              ],
              "unlocksSystems": [
                      "conditioning_mastery"
              ],
              "summaryLines": [
                      "Recovery and fatigue bonuses +5%",
                      "Endurance +4",
                      "Conditioning capstone"
              ]
      })
    ],
  },
  {
    id: "history",
    name: "History & Relics",
    description: "Ruins, relic custody, old wars, and atlas interpretation.",
    courses: [
      makeCourse("history", 1, {
              "id": "archive-orientation",
              "name": "Archive Orientation",
              "durationDays": 11,
              "costGold": 1700,
              "description": "Learning how civic archives organize old sites, claims, and sealed reports.",
              "rewardKind": "travel",
              "prerequisites": [
                      "basic-literacy"
              ],
              "workingStatRewards": {
                      "intelligence": 2
              },
              "systemEffects": [
                      "Archive reading +5%"
              ],
              "summaryLines": [
                      "Archive reading +5%",
                      "Intelligence +2"
              ]
      }),
      makeCourse("history", 2, {
              "id": "ruin-provenance",
              "name": "Ruin Provenance",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Identifying who built a ruin, who broke it, and why that matters now.",
              "rewardKind": "travel",
              "prerequisites": [
                      "historical-awareness",
                      "archive-orientation"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 1
              },
              "systemEffects": [
                      "Ruin discovery quality +5%"
              ],
              "unlocksSystems": [
                      "ruin_provenance"
              ],
              "summaryLines": [
                      "Ruin discovery quality +5%",
                      "Intelligence +2, Endurance +1"
              ]
      }),
      makeCourse("history", 3, {
              "id": "relic-custody",
              "name": "Relic Custody",
              "durationDays": 15,
              "costGold": 2700,
              "description": "Handling relic claims, custody chains, and artifacts that should not be pocketed casually.",
              "rewardKind": "governance",
              "prerequisites": [
                      "ruin-provenance"
              ],
              "workingStatRewards": {
                      "intelligence": 3
              },
              "systemEffects": [
                      "Relic contract clarity +5%"
              ],
              "summaryLines": [
                      "Relic contract clarity +5%",
                      "Intelligence +3"
              ]
      }),
      makeCourse("history", 4, {
              "id": "battlefield-context",
              "name": "Battlefield Context",
              "durationDays": 16,
              "costGold": 3000,
              "description": "Reading old battlefields for route danger, claims, and salvage leads.",
              "rewardKind": "travel",
              "prerequisites": [
                      "relic-custody"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 1
              },
              "systemEffects": [
                      "Battlefield discovery quality +5%"
              ],
              "summaryLines": [
                      "Battlefield discovery quality +5%",
                      "Intelligence +2, Endurance +1"
              ]
      }),
      makeCourse("history", 5, {
              "id": "relic-mastery",
              "name": "Relic Mastery",
              "durationDays": 20,
              "costGold": 3800,
              "description": "A capstone for turning old places into safer discoveries, better records, and stronger relic work.",
              "rewardKind": "travel",
              "prerequisites": [
                      "battlefield-context",
                      "field-investigation"
              ],
              "workingStatRewards": {
                      "intelligence": 4
              },
              "systemEffects": [
                      "Relic and ruin outcomes +5%"
              ],
              "unlocksSystems": [
                      "relic_mastery"
              ],
              "summaryLines": [
                      "Relic and ruin outcomes +5%",
                      "Intelligence +4",
                      "History capstone"
              ]
      })
    ],
  },
  {
    id: "law",
    name: "Law & Governance",
    description: "Civic law, warrants, petitions, institutional access, and public authority.",
    courses: [
      makeCourse("law", 1, {
              "id": "legal-literacy",
              "name": "Legal Literacy",
              "durationDays": 11,
              "costGold": 1700,
              "description": "Reading ordinances, warrants, and civic limits without needing a clerk to translate every line.",
              "rewardKind": "governance",
              "prerequisites": [
                      "civic-fundamentals"
              ],
              "workingStatRewards": {
                      "intelligence": 2
              },
              "systemEffects": [
                      "Legal access clarity +5%"
              ],
              "summaryLines": [
                      "Legal access clarity +5%",
                      "Intelligence +2"
              ]
      }),
      makeCourse("law", 2, {
              "id": "petition-routing",
              "name": "Petition Routing",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Knowing which office receives which request before the request becomes a fossil.",
              "rewardKind": "governance",
              "prerequisites": [
                      "legal-literacy"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 1
              },
              "systemEffects": [
                      "Petition handling +5%"
              ],
              "summaryLines": [
                      "Petition handling +5%",
                      "Intelligence +2, Endurance +1"
              ]
      }),
      makeCourse("law", 3, {
              "id": "warrant-procedure",
              "name": "Warrant Procedure",
              "durationDays": 15,
              "costGold": 2700,
              "description": "Formal authority, evidence standards, and lawful pressure inside city systems.",
              "rewardKind": "governance",
              "prerequisites": [
                      "petition-routing"
              ],
              "workingStatRewards": {
                      "intelligence": 3
              },
              "systemEffects": [
                      "Civic contract access +5%"
              ],
              "unlocksSystems": [
                      "advanced_civic_contracts"
              ],
              "summaryLines": [
                      "Civic contract access +5%",
                      "Unlocks stronger civic contract reads",
                      "Intelligence +3"
              ]
      }),
      makeCourse("law", 4, {
              "id": "civic-arbitration",
              "name": "Civic Arbitration",
              "durationDays": 16,
              "costGold": 3100,
              "description": "Resolving disputes between guilds, companies, courts, and citizens without creating a second dispute.",
              "rewardKind": "governance",
              "prerequisites": [
                      "warrant-procedure",
                      "pressure-control"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 2
              },
              "systemEffects": [
                      "Civic dispute success +5%"
              ],
              "summaryLines": [
                      "Civic dispute success +5%",
                      "Intelligence +2, Endurance +2"
              ]
      }),
      makeCourse("law", 5, {
              "id": "governance-mastery",
              "name": "Governance Mastery",
              "durationDays": 20,
              "costGold": 3900,
              "description": "A capstone for players who want authority systems to open because they understand them.",
              "rewardKind": "governance",
              "prerequisites": [
                      "civic-arbitration",
                      "permit-procedure"
              ],
              "workingStatRewards": {
                      "intelligence": 4
              },
              "systemEffects": [
                      "Governance systems +5%"
              ],
              "unlocksSystems": [
                      "governance_mastery"
              ],
              "summaryLines": [
                      "Governance systems +5%",
                      "Intelligence +4",
                      "Law capstone"
              ]
      })
    ],
  },
  {
    id: "psychology",
    name: "Psychology & Influence",
    description: "Motives, morale, pressure, persuasion, and room control.",
    courses: [
      makeCourse("psychology", 1, {
              "id": "motive-reading",
              "name": "Motive Reading",
              "durationDays": 11,
              "costGold": 1700,
              "description": "Reading motive, hesitation, and the difference between fear and bargaining.",
              "rewardKind": "utility",
              "prerequisites": [
                      "basic-literacy"
              ],
              "workingStatRewards": {
                      "intelligence": 2
              },
              "systemEffects": [
                      "Social read quality +5%"
              ],
              "summaryLines": [
                      "Social read quality +5%",
                      "Intelligence +2"
              ]
      }),
      makeCourse("psychology", 2, {
              "id": "pressure-control",
              "name": "Pressure Control",
              "durationDays": 13,
              "costGold": 2200,
              "description": "Keeping control of tense rooms without letting pride drive the cart.",
              "rewardKind": "utility",
              "prerequisites": [
                      "motive-reading"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 1
              },
              "systemEffects": [
                      "Pressure handling +5%"
              ],
              "summaryLines": [
                      "Pressure handling +5%",
                      "Intelligence +2, Endurance +1"
              ]
      }),
      makeCourse("psychology", 3, {
              "id": "crew-morale",
              "name": "Crew Morale",
              "durationDays": 15,
              "costGold": 2700,
              "description": "Maintaining group focus for guild operations, convoy work, and hard travel.",
              "rewardKind": "utility",
              "prerequisites": [
                      "pressure-control"
              ],
              "workingStatRewards": {
                      "intelligence": 2,
                      "endurance": 2
              },
              "systemEffects": [
                      "Group operation stability +5%"
              ],
              "summaryLines": [
                      "Group operation stability +5%",
                      "Intelligence +2, Endurance +2"
              ]
      }),
      makeCourse("psychology", 4, {
              "id": "public-influence",
              "name": "Public Influence",
              "durationDays": 16,
              "costGold": 3100,
              "description": "Public voice, reputation pressure, and getting people to move without a drawn blade.",
              "rewardKind": "governance",
              "prerequisites": [
                      "crew-morale",
                      "civic-fundamentals"
              ],
              "workingStatRewards": {
                      "intelligence": 3
              },
              "systemEffects": [
                      "Public notice influence +5%"
              ],
              "summaryLines": [
                      "Public notice influence +5%",
                      "Intelligence +3"
              ]
      }),
      makeCourse("psychology", 5, {
              "id": "influence-mastery",
              "name": "Influence Mastery",
              "durationDays": 20,
              "costGold": 3900,
              "description": "A capstone for negotiation, morale, and high-pressure social systems.",
              "rewardKind": "utility",
              "prerequisites": [
                      "public-influence",
                      "applied-reasoning"
              ],
              "workingStatRewards": {
                      "intelligence": 4
              },
              "systemEffects": [
                      "Influence systems +5%"
              ],
              "unlocksSystems": [
                      "influence_mastery"
              ],
              "summaryLines": [
                      "Influence systems +5%",
                      "Intelligence +4",
                      "Influence capstone"
              ]
      })
    ],
  },
  {
    id: "melee",
    name: "Melee Arts",
    description: "Close combat, blades, shields, and heavy strikes.",
    courses: [
      makeCourse("melee", 1, { id: "blade-footing", name: "Blade Footing", durationDays: 11, costGold: 1700, description: "Blade Footing provides focused melee arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["drill-square-basics"], workingStatRewards: { endurance: 1 }, systemEffects: ["Melee Arts progress +5%"], summaryLines: ["Blade Footing training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("melee", 2, { id: "guard-breaking", name: "Guard Breaking", durationDays: 13, costGold: 2200, description: "Guard Breaking provides focused melee arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["blade-footing"], workingStatRewards: { endurance: 1 }, systemEffects: ["Melee Arts progress +5%"], summaryLines: ["Guard Breaking training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("melee", 3, { id: "close-quarter-drills", name: "Close-Quarter Drills", durationDays: 15, costGold: 2700, description: "Close-Quarter Drills provides focused melee arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["guard-breaking"], workingStatRewards: { endurance: 1 }, systemEffects: ["Melee Arts progress +5%"], summaryLines: ["Close-Quarter Drills training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("melee", 4, { id: "melee-mastery", name: "Melee Mastery", durationDays: 17, costGold: 3200, description: "Melee Mastery provides focused melee arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["close-quarter-drills"], workingStatRewards: { endurance: 1 }, systemEffects: ["Melee Arts progress +5%"], summaryLines: ["Melee Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  },
  {
    id: "ranged",
    name: "Ranged Arts",
    description: "Bows, crossbows, thrown tools, and line control.",
    courses: [
      makeCourse("ranged", 1, { id: "range-sighting", name: "Range Sighting", durationDays: 11, costGold: 1700, description: "Range Sighting provides focused ranged arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["drill-square-basics"], workingStatRewards: { endurance: 1 }, systemEffects: ["Ranged Arts progress +5%"], summaryLines: ["Range Sighting training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("ranged", 2, { id: "draw-discipline", name: "Draw Discipline", durationDays: 13, costGold: 2200, description: "Draw Discipline provides focused ranged arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["range-sighting"], workingStatRewards: { endurance: 1 }, systemEffects: ["Ranged Arts progress +5%"], summaryLines: ["Draw Discipline training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("ranged", 3, { id: "volley-coordination", name: "Volley Coordination", durationDays: 15, costGold: 2700, description: "Volley Coordination provides focused ranged arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["draw-discipline"], workingStatRewards: { endurance: 1 }, systemEffects: ["Ranged Arts progress +5%"], summaryLines: ["Volley Coordination training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("ranged", 4, { id: "ranged-mastery", name: "Ranged Mastery", durationDays: 17, costGold: 3200, description: "Ranged Mastery provides focused ranged arts training for Nexis progression.", rewardKind: "combat", prerequisites: ["volley-coordination"], workingStatRewards: { endurance: 1 }, systemEffects: ["Ranged Arts progress +5%"], summaryLines: ["Ranged Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  },
  {
    id: "arcane",
    name: "Arcane Studies",
    description: "Wards, sigils, focus discipline, and relic-safe channeling.",
    courses: [
      makeCourse("arcane", 1, { id: "sigil-literacy", name: "Sigil Literacy", durationDays: 11, costGold: 1700, description: "Sigil Literacy provides focused arcane studies training for Nexis progression.", rewardKind: "utility", prerequisites: ["basic-literacy"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Arcane Studies progress +5%"], summaryLines: ["Sigil Literacy training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("arcane", 2, { id: "focus-handling", name: "Focus Handling", durationDays: 13, costGold: 2200, description: "Focus Handling provides focused arcane studies training for Nexis progression.", rewardKind: "utility", prerequisites: ["sigil-literacy"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Arcane Studies progress +5%"], summaryLines: ["Focus Handling training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("arcane", 3, { id: "ward-geometry", name: "Ward Geometry", durationDays: 15, costGold: 2700, description: "Ward Geometry provides focused arcane studies training for Nexis progression.", rewardKind: "utility", prerequisites: ["focus-handling", "world-geography"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Arcane Studies progress +5%"], summaryLines: ["Ward Geometry training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("arcane", 4, { id: "arcane-mastery", name: "Arcane Mastery", durationDays: 17, costGold: 3200, description: "Arcane Mastery provides focused arcane studies training for Nexis progression.", rewardKind: "utility", prerequisites: ["ward-geometry", "historical-awareness"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Arcane Studies progress +5%"], summaryLines: ["Arcane Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  },
  {
    id: "craftsmanship",
    name: "Craftsmanship & Artifice",
    description: "Tools, repairs, materials, mechanisms, and practical artifice.",
    courses: [
      makeCourse("craftsmanship", 1, { id: "tool-use-foundations", name: "Tool Use Foundations", durationDays: 11, costGold: 1700, description: "Tool Use Foundations provides focused craftsmanship & artifice training for Nexis progression.", rewardKind: "economy", prerequisites: ["practical-arithmetic"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Craftsmanship progress +5%"], summaryLines: ["Tool Use Foundations training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("craftsmanship", 2, { id: "material-sorting", name: "Material Sorting", durationDays: 13, costGold: 2200, description: "Material Sorting provides focused craftsmanship & artifice training for Nexis progression.", rewardKind: "economy", prerequisites: ["tool-use-foundations"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Craftsmanship progress +5%"], summaryLines: ["Material Sorting training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("craftsmanship", 3, { id: "repair-discipline", name: "Repair Discipline", durationDays: 15, costGold: 2700, description: "Repair Discipline provides focused craftsmanship & artifice training for Nexis progression.", rewardKind: "economy", prerequisites: ["material-sorting"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Craftsmanship progress +5%"], summaryLines: ["Repair Discipline training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("craftsmanship", 4, { id: "artifice-mastery", name: "Artifice Mastery", durationDays: 17, costGold: 3200, description: "Artifice Mastery provides focused craftsmanship & artifice training for Nexis progression.", rewardKind: "economy", prerequisites: ["repair-discipline", "applied-ledgers"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Craftsmanship progress +5%"], summaryLines: ["Artifice Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  },
  {
    id: "diplomacy",
    name: "Diplomacy & Influence",
    description: "Negotiation, court pressure, public voice, and formal access.",
    courses: [
      makeCourse("diplomacy", 1, { id: "formal-address", name: "Formal Address", durationDays: 11, costGold: 1700, description: "Formal Address provides focused diplomacy & influence training for Nexis progression.", rewardKind: "governance", prerequisites: ["civic-fundamentals"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Diplomacy progress +5%"], summaryLines: ["Formal Address training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("diplomacy", 2, { id: "negotiated-access", name: "Negotiated Access", durationDays: 13, costGold: 2200, description: "Negotiated Access provides focused diplomacy & influence training for Nexis progression.", rewardKind: "governance", prerequisites: ["formal-address"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Diplomacy progress +5%"], summaryLines: ["Negotiated Access training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("diplomacy", 3, { id: "envoy-practice", name: "Envoy Practice", durationDays: 15, costGold: 2700, description: "Envoy Practice provides focused diplomacy & influence training for Nexis progression.", rewardKind: "governance", prerequisites: ["negotiated-access", "world-geography"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Diplomacy progress +5%"], summaryLines: ["Envoy Practice training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("diplomacy", 4, { id: "diplomacy-mastery", name: "Diplomacy Mastery", durationDays: 17, costGold: 3200, description: "Diplomacy Mastery provides focused diplomacy & influence training for Nexis progression.", rewardKind: "governance", prerequisites: ["envoy-practice", "influence-mastery"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Diplomacy progress +5%"], summaryLines: ["Diplomacy Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  },
  {
    id: "maritime",
    name: "Maritime Training",
    description: "Ports, tides, manifests, escort lanes, and Blackharbor travel literacy.",
    courses: [
      makeCourse("maritime", 1, { id: "dock-procedure", name: "Dock Procedure", durationDays: 11, costGold: 1700, description: "Dock Procedure provides focused maritime training training for Nexis progression.", rewardKind: "travel", prerequisites: ["world-geography"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Maritime Training progress +5%"], summaryLines: ["Dock Procedure training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("maritime", 2, { id: "manifest-reading", name: "Manifest Reading", durationDays: 13, costGold: 2200, description: "Manifest Reading provides focused maritime training training for Nexis progression.", rewardKind: "travel", prerequisites: ["dock-procedure", "practical-arithmetic"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Maritime Training progress +5%"], summaryLines: ["Manifest Reading training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("maritime", 3, { id: "escort-lanes", name: "Escort Lanes", durationDays: 15, costGold: 2700, description: "Escort Lanes provides focused maritime training training for Nexis progression.", rewardKind: "travel", prerequisites: ["manifest-reading"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Maritime Training progress +5%"], summaryLines: ["Escort Lanes training progress +5%", "Supports linked unlocks and specialization paths"] }),
      makeCourse("maritime", 4, { id: "maritime-mastery", name: "Maritime Mastery", durationDays: 17, costGold: 3200, description: "Maritime Mastery provides focused maritime training training for Nexis progression.", rewardKind: "travel", prerequisites: ["escort-lanes", "route-surveying"], workingStatRewards: { intelligence: 1, endurance: 1 }, systemEffects: ["Maritime Training progress +5%"], summaryLines: ["Maritime Mastery training progress +5%", "Supports linked unlocks and specialization paths"] }),
    ],
  }
];

export const educationCourseMap = Object.fromEntries(
  educationCategories.flatMap((category) => category.courses.map((course) => [course.id, course])),
);
export function getEducationCourse(courseId) { return educationCourseMap[courseId] ?? null; }
export function getCourseLabel(courseId) { return educationCourseMap[courseId]?.name ?? String(courseId ?? "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
