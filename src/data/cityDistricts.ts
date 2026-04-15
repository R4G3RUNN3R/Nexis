export interface CityDestination {
  id: string;
  name: string;
  route: string;
  description: string;
  locked?: boolean;
  lockReason?: string;
  image?: string;
}

export interface CityDistrict {
  id: string;
  name: string;
  summary: string;
  image?: string;
  destinations: CityDestination[];
}

export const NEXIS_CITY_DISTRICTS: CityDistrict[] = [
  {
    id: "academic",
    name: "Academic District",
    summary: "Learning, archives, and the kind of silence that judges you.",
    image: "/images/districts/academic-district.png",
    destinations: [
      {
        id: "academy",
        name: "Academy",
        route: "/education",
        description: "Core education, specialist studies, and long-term progression.",
      },
      {
        id: "library",
        name: "Library",
        route: "/education",
        description: "Books, research, and future reading progression hooks.",
      },
      {
        id: "archives",
        name: "Archives",
        route: "/city-board",
        description: "Records, lore, city history, and administrative notices.",
      },
    ],
  },
  {
    id: "commercial",
    name: "Commercial District",
    summary: "Money, goods, and people pretending prices are morally neutral.",
    image: "/images/districts/commercial-district.png",
    destinations: [
      {
        id: "market",
        name: "Market",
        route: "/market",
        description: "Primary legal trade hub for goods and commerce.",
      },
      {
        id: "bank",
        name: "Bank",
        route: "/bank",
        description: "Deposits, reserves, and future financial systems.",
      },
      {
        id: "black_market",
        name: "Black Market",
        route: "/black-market",
        description: "Restricted trade for players who unlock shady access later.",
        locked: true,
        lockReason: "Requires Shadowcraft or black market access unlocks.",
      },
    ],
  },
  {
    id: "civic",
    name: "Civic District",
    summary: "Administration, law, healing, and institutional disappointment.",
    image: "/images/districts/civic-district.png",
    destinations: [
      {
        id: "city_board",
        name: "City Board",
        route: "/city-board",
        description: "The Nexis public board for jobs, notices, and opportunities.",
      },
      {
        id: "civic_jobs",
        name: "Civic Jobs",
        route: "/civic-jobs",
        description: "Structured civic employment with ranks, requirements, and daily gains.",
      },
      {
        id: "hospital",
        name: "Hospital",
        route: "/hospital",
        description: "Recovery, treatment, and medical support.",
      },
      {
        id: "jail",
        name: "Jail",
        route: "/hospital",
        description: "Detention, penalties, busting, and inmate tracking.",
      },
    ],
  },
  {
    id: "adventure",
    name: "Adventure District",
    summary: "Risk, violence, contracts, and generally poor survival planning.",
    image: "/images/districts/adventure-district.png",
    destinations: [
      {
        id: "adventure_board",
        name: "Adventure",
        route: "/adventure",
        description: "Contracts, expeditions, and active adventure content.",
      },
      {
        id: "arena",
        name: "Arena",
        route: "/arena",
        description: "Combat training, stat growth, and future ranking hooks.",
      },
      {
        id: "tavern",
        name: "Tavern",
        route: "/tavern",
        description: "Rumors, casual hooks, and future social contract leads.",
      },
    ],
  },
  {
    id: "faction",
    name: "Faction District",
    summary: "Power blocs, group identity, and cooperation until the loot appears.",
    image: "/images/districts/faction-district.png",
    destinations: [
      {
        id: "guilds",
        name: "Guilds",
        route: "/guilds",
        description: "Faction-style cooperative groups, raids, and progression.",
      },
      {
        id: "consortiums",
        name: "Consortiums",
        route: "/consortiums",
        description: "Economic organizations, employees, and vault growth.",
      },
    ],
  },
  {
    id: "residential",
    name: "Residential District",
    summary: "Properties, comfort, security, and expensive ways to sleep better.",
    image: "/images/districts/residential-district.png",
    destinations: [
      {
        id: "housing",
        name: "Housing",
        route: "/housing",
        description: "Property ownership, upgrades, upkeep, and household effects.",
      },
      {
        id: "travel",
        name: "Travel Gate",
        route: "/travel",
        description: "Depart the city, reach new regions, or get lost like a champion.",
      },
    ],
  },
];
