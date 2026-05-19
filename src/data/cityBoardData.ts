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
    summary: "The watch is accepting recruits for patrol, reporting, and sanctioned public protection work.",
    rewardLabel: "Daily wages + job points",
    requirementLabel: "Basic combat aptitude",
    route: "/civic-jobs",
  },
  {
    id: "job_medical_hiring",
    category: "civic_jobs",
    title: "Medical Corps Hiring",
    summary: "Hospital aides are needed for recovery support, triage work, and routine ward duties.",
    rewardLabel: "Daily wages + recovery bonuses",
    requirementLabel: "Basic literacy or medical knowledge",
    route: "/civic-jobs",
  },
  {
    id: "notice_market_rules",
    category: "notices",
    title: "Market Notice: Permit Enforcement",
    summary: "Unlicensed stalls may be closed. Merchants should keep permits visible and current.",
    route: "/market",
  },
  {
    id: "opportunity_archive_runner",
    category: "opportunities",
    title: "Archive Runner Needed",
    summary: "The Archives need careful runners for record transport and sealed document handling.",
    rewardLabel: "Gold + civic standing",
    requirementLabel: "Basic literacy",
  },
  {
    id: "opportunity_scout_route",
    category: "opportunities",
    title: "Scout Route Opportunity",
    summary: "Short-distance scouting work is available for citizens with safe travel capability.",
    rewardLabel: "Gold + route knowledge",
    requirementLabel: "World Geography recommended",
    route: "/travel",
  },
  {
    id: "bounty_tunnel_raider",
    category: "bounties",
    title: "Tunnel Raider Bounty",
    summary: "A sanctioned bounty has been posted for raider activity near the lower supply roads.",
    rewardLabel: "1,500 gold",
    requirementLabel: "Combat-ready players",
    route: "/arena",
  },
  {
    id: "personal_roommate",
    category: "personals",
    title: "Room Available Near the Lower Market",
    summary: "Small room near the lower market. Suitable for citizens who need a cheap local address.",
    route: "/housing",
  },
  {
    id: "property_cottage_lease",
    category: "properties",
    title: "Cottage Lease Opening",
    summary: "A modest cottage is open for lease in the residential quarter with standard upkeep terms.",
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
