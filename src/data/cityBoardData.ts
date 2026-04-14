export type CityBoardCategory =
  | "civic_jobs"
  | "notices"
  | "opportunities"
  | "bounties"
  | "personals"
  | "properties";

export interface CityBoardListing {
  id: string;
  category: CityBoardCategory;
  title: string;
  summary: string;
  rewardLabel?: string;
  requirementLabel?: string;
  route?: string;
}

export const CITY_BOARD_LISTINGS: CityBoardListing[] = [
  {
    id: "job_guard_recruitment",
    category: "civic_jobs",
    title: "City Guard Recruitment",
    summary: "Steady civic work for recruits willing to patrol, report, and survive the public.",
    rewardLabel: "Daily wages + job points",
    requirementLabel: "Basic combat aptitude",
    route: "/civic-jobs",
  },
  {
    id: "job_medical_hiring",
    category: "civic_jobs",
    title: "Medical Corps Hiring",
    summary: "Support the hospital, tend the injured, and learn to tolerate blood professionally.",
    rewardLabel: "Daily wages + recovery bonuses",
    requirementLabel: "Basic literacy or medical knowledge",
    route: "/civic-jobs",
  },
  {
    id: "notice_market_rules",
    category: "notices",
    title: "Market Notice: Permit Enforcement",
    summary: "Illegal stalls will be seized. Merchants are reminded that regulations exist, however tragically.",
    route: "/market",
  },
  {
    id: "opportunity_archive_runner",
    category: "opportunities",
    title: "Archive Runner Needed",
    summary: "Assist the Archives with records transport and document handling. Discretion preferred.",
    rewardLabel: "Gold + civic standing",
    requirementLabel: "Basic literacy",
    route: "/city-board",
  },
  {
    id: "opportunity_scout_route",
    category: "opportunities",
    title: "Scout Route Opportunity",
    summary: "Short-distance scouting contract available for players with safe travel capability.",
    rewardLabel: "Gold + route knowledge",
    requirementLabel: "World Geography recommended",
    route: "/travel",
  },
  {
    id: "bounty_tunnel_raider",
    category: "bounties",
    title: "Tunnel Raider Bounty",
    summary: "Wanted alive or not-too-liquefied. Activity reported near the lower supply roads.",
    rewardLabel: "1,500 gold",
    requirementLabel: "Combat-ready players",
    route: "/arena",
  },
  {
    id: "personal_roommate",
    category: "personals",
    title: "Room Available Near the Lower Market",
    summary: "Small room, noisy street, excellent stew nearby. Stability not guaranteed.",
    route: "/housing",
  },
  {
    id: "property_cottage_lease",
    category: "properties",
    title: "Cottage Lease Opening",
    summary: "A modest cottage is open for lease in the residential quarter. Better than a shack, allegedly.",
    rewardLabel: "Moderate upkeep",
    route: "/housing",
  },
];

export function groupCityBoardListings() {
  return CITY_BOARD_LISTINGS.reduce<Record<CityBoardCategory, CityBoardListing[]>>(
    (groups, listing) => {
      groups[listing.category].push(listing);
      return groups;
    },
    {
      civic_jobs: [],
      notices: [],
      opportunities: [],
      bounties: [],
      personals: [],
      properties: [],
    },
  );
}
